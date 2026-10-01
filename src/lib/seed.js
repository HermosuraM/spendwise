// Deterministic sample data: twelve months of a plausible student-budget ledger ending today, so the demo
// shows real patterns (paychecks, rent, subscriptions, seasonal utilities) and two genuine outliers.

import { DEFAULT_CATEGORIES } from '../data/categories'
import { addDays, addMonths, daysInMonth, monthOf, pad, parseISO } from './dates'

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateSampleData({ today, months = 12, seed = 7 } = {}) {
  const rand = mulberry32(seed)
  const between = (lo, hi) => Math.round((lo + rand() * (hi - lo)) * 100)
  const pick = (xs) => xs[Math.floor(rand() * xs.length)]
  const endKey = monthOf(today)
  const startKey = addMonths(endKey, -(months - 1))
  const transactions = []
  let n = 0
  const add = (date, description, amountCents, categoryId, type = 'expense') => {
    if (date > today) return
    n += 1
    transactions.push({ id: `sample-${String(n).padStart(4, '0')}`, date, description, amountCents, categoryId, type, notes: '' })
  }

  // Paychecks every other Friday, starting from the first Friday of the window.
  let payday = `${startKey}-01`
  while (parseISO(payday).getDay() !== 5) payday = addDays(payday, 1)
  for (; payday <= today; payday = addDays(payday, 14)) add(payday, 'ACME ANALYTICS PAYROLL', 215_000, 'salary', 'income')

  for (let m = 0; m < months; m += 1) {
    const key = addMonths(startKey, m)
    const days = daysInMonth(key)
    const day = (d) => `${key}-${pad(Math.min(d, days))}`
    const monthNum = Number(key.slice(5))
    const summer = monthNum >= 6 && monthNum <= 9

    add(day(1), 'SUNSET APARTMENTS RENT', 145_000, 'housing')
    add(day(4), 'SPECTRUM INTERNET', 6_499, 'utilities')
    add(day(9), 'T-MOBILE WIRELESS', 4_500, 'utilities')
    add(day(14), 'TXU ENERGY', summer ? between(118, 152) : between(68, 96), 'utilities')
    add(day(6), 'NETFLIX.COM', 1_549, 'subscriptions')
    add(day(11), 'SPOTIFY USA', 1_199, 'subscriptions')
    add(day(2), 'PLANET FITNESS', 2_499, 'subscriptions')
    add(day(19), 'APPLE.COM/BILL ICLOUD', 299, 'subscriptions')

    for (let d = 2 + Math.floor(rand() * 4); d <= days; d += 6 + Math.floor(rand() * 3)) {
      add(day(d), pick(['H-E-B #482', 'TRADER JOE\'S #211', 'COSTCO WHSE #1066', 'WHOLE FOODS MKT']), between(38, 128), 'groceries')
    }
    for (let i = 0, count = 6 + Math.floor(rand() * 5); i < count; i += 1) {
      add(day(1 + Math.floor(rand() * days)), pick(['CHIPOTLE 2210', 'STARBUCKS #10293', 'SQ *TACO DELI', 'TST* PHO 95', 'SHAKE SHACK']), between(7, 38), 'dining')
    }
    for (let d = 3 + Math.floor(rand() * 5); d <= days; d += 9 + Math.floor(rand() * 4)) {
      add(day(d), pick(['SHELL OIL 5741', 'QT 892', 'EXXONMOBIL 4402']), between(32, 54), 'transport')
    }
    if (rand() < 0.6) add(day(1 + Math.floor(rand() * days)), 'UBER *TRIP', between(12, 31), 'transport')
    for (let i = 0, count = 2 + Math.floor(rand() * 3); i < count; i += 1) {
      add(day(1 + Math.floor(rand() * days)), pick(['AMAZON.COM*2K4L', 'TARGET 00012', 'UNIQLO DALLAS']), between(14, 96), 'shopping')
    }
    if (rand() < 0.5) add(day(1 + Math.floor(rand() * days)), 'CVS/PHARMACY #1123', between(9, 34), 'health')
    if (rand() < 0.55) add(day(1 + Math.floor(rand() * days)), pick(['AMC THEATRES', 'TICKETMASTER', 'STEAM GAMES']), between(14, 72), 'entertainment')
    if (rand() < 0.45) add(day(1 + Math.floor(rand() * days)), 'UPWORK FREELANCE PAYOUT', between(240, 720), 'freelance', 'income')
    if (monthNum === 7) {
      add(day(12), 'SOUTHWEST AIRLINES', 38_400, 'travel')
      add(day(19), 'HILTON GARDEN INN', 24_650, 'travel')
    }
  }

  // Two genuine outliers for the "unusual transactions" insight.
  const recent = addDays(today, -Math.min(20, Number(today.slice(8, 10)) + 10))
  add(recent, 'BEST BUY 00431', 129_999, 'shopping')
  add(addDays(today, -45), 'FOGO DE CHAO DALLAS', 18_640, 'dining')

  const budgets = [
    ['housing', 145_000], ['groceries', 45_000], ['dining', 22_000], ['transport', 20_000], ['utilities', 26_000],
    ['shopping', 25_000], ['subscriptions', 7_000], ['health', 8_000], ['entertainment', 10_000],
  ].map(([categoryId, limitCents]) => ({ id: `budget-${categoryId}`, categoryId, month: startKey, limitCents }))

  transactions.sort((a, b) => b.date.localeCompare(a.date))
  return { categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), transactions, budgets }
}
