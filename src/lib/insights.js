// Explainable "insights" computed in the browser: recurring-charge detection, unusual transactions,
// category trends and the month-end forecast. Plain statistics, no black boxes: every number on screen
// can be explained in one sentence.

import { addDays, addMonths, addMonthsToDate, daysBetween, daysInMonth, monthOf, monthsEnding, pad } from './dates'
import { normalizeMerchant } from './merchant'

const median = (xs) => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const dayOf = (isoDate) => Number(isoDate.slice(8, 10))

// Monthly and longer cadences step by calendar months (rent on the 1st is next due on the 1st, not 30.44 days later).
const CADENCES = [
  { name: 'Weekly', days: 7, tolerance: 2 },
  { name: 'Every 2 weeks', days: 14, tolerance: 3 },
  { name: 'Monthly', days: 30.44, tolerance: 4, months: 1 },
  { name: 'Quarterly', days: 91.3, tolerance: 10, months: 3 },
  { name: 'Yearly', days: 365.25, tolerance: 15, months: 12 },
]
const CADENCE_BY_NAME = new Map(CADENCES.map((c) => [c.name, c]))

/** The n-th expected charge after `date` for a cadence name ("Monthly", "Weekly", ...). */
export function nthCharge(date, cadenceName, n = 1) {
  const c = CADENCE_BY_NAME.get(cadenceName)
  return c.months ? addMonthsToDate(date, c.months * n) : addDays(date, c.days * n)
}

/** Dates in [from, to] when a recurring charge is expected but not yet recorded (anything after its last charge). */
export function expectedCharges(recurring, from, to) {
  const dates = []
  for (let n = 1, d = nthCharge(recurring.lastDate, recurring.cadence); d <= to; n += 1, d = nthCharge(recurring.lastDate, recurring.cadence, n)) {
    if (d >= from) dates.push(d)
  }
  return dates
}

/**
 * Recurring charges: the same normalized merchant at a regular cadence with a stable amount.
 * Requires 3+ charges, intervals within the cadence's tolerance, and amounts within 15% of their median.
 */
export function detectRecurring(transactions, today, { minCount = 3, amountTolerance = 0.15 } = {}) {
  const groups = new Map()
  for (const t of transactions) {
    if (t.type !== 'expense' || t.date > today) continue
    const key = normalizeMerchant(t.description)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }
  const found = []
  for (const [key, txns] of groups) {
    if (txns.length < minCount) continue
    txns.sort((a, b) => a.date.localeCompare(b.date))
    const gaps = txns.slice(1).map((t, i) => daysBetween(txns[i].date, t.date))
    const typicalGap = median(gaps)
    const cadence = CADENCES.find((c) => Math.abs(typicalGap - c.days) <= c.tolerance)
    if (!cadence) continue
    const regular = gaps.filter((g) => Math.abs(g - cadence.days) <= cadence.tolerance * 1.5).length / gaps.length
    if (regular < 0.75) continue
    const amounts = txns.map((t) => t.amountCents)
    const typicalAmount = median(amounts)
    if (amounts.some((a) => Math.abs(a - typicalAmount) > amountTolerance * typicalAmount)) continue
    const last = txns[txns.length - 1]
    found.push({
      key,
      name: last.description,
      categoryId: last.categoryId,
      cadence: cadence.name,
      count: txns.length,
      avgCents: Math.round(typicalAmount),
      monthlyCents: Math.round(typicalAmount * (30.44 / cadence.days)),
      annualCents: Math.round(typicalAmount * (365.25 / cadence.days)),
      lastDate: last.date,
      nextDate: nthCharge(last.date, cadence.name),
      // a charge that missed two cycles is probably cancelled
      active: daysBetween(last.date, today) <= cadence.days * 2,
    })
  }
  return found.sort((a, b) => b.monthlyCents - a.monthlyCents)
}

/**
 * Unusual transactions: modified z-score (Iglewicz & Hoaglin) of log(amount) against the same category's
 * history, using the median and MAD so a few big purchases cannot hide each other. |z| > 3.5 is flagged.
 * Recurring charges are excluded (rent is large but expected).
 */
export function detectAnomalies(transactions, today, recurring = [], { lookbackDays = 365, threshold = 3.5, minHistory = 8, windowDays = 90 } = {}) {
  const recurringKeys = new Set(recurring.map((r) => r.key))
  const since = addDays(today, -lookbackDays)
  const flaggedSince = addDays(today, -windowDays)
  const byCategory = new Map()
  for (const t of transactions) {
    if (t.type !== 'expense' || t.date < since || t.date > today) continue
    if (recurringKeys.has(normalizeMerchant(t.description))) continue
    if (!byCategory.has(t.categoryId)) byCategory.set(t.categoryId, [])
    byCategory.get(t.categoryId).push(t)
  }
  const flagged = []
  for (const txns of byCategory.values()) {
    if (txns.length < minHistory) continue
    const logs = txns.map((t) => Math.log(t.amountCents))
    const med = median(logs)
    const mad = Math.max(median(logs.map((x) => Math.abs(x - med))), 0.1)
    for (const t of txns) {
      const z = (0.6745 * (Math.log(t.amountCents) - med)) / mad
      if (z > threshold && t.date >= flaggedSince) {
        flagged.push({ transaction: t, z, typicalCents: Math.round(Math.exp(med)), ratio: t.amountCents / Math.exp(med) })
      }
    }
  }
  return flagged.sort((a, b) => b.transaction.date.localeCompare(a.transaction.date))
}

/**
 * Spending per category in a month vs. the average of the previous `baselineMonths` months. For a month in
 * progress pass `throughDay`: both sides then cover days 1..N only, so half a month isn't compared to whole ones.
 */
export function categoryChanges(transactions, key, categories, { baselineMonths = 3, throughDay = 31 } = {}) {
  const baselineKeys = new Set(monthsEnding(addMonths(key, -1), baselineMonths))
  const now = new Map()
  const base = new Map()
  for (const t of transactions) {
    if (t.type !== 'expense' || dayOf(t.date) > throughDay) continue
    const month = monthOf(t.date)
    if (month === key) now.set(t.categoryId, (now.get(t.categoryId) ?? 0) + t.amountCents)
    else if (baselineKeys.has(month)) base.set(t.categoryId, (base.get(t.categoryId) ?? 0) + t.amountCents)
  }
  return categories
    .filter((c) => c.type === 'expense')
    .map((c) => {
      const current = now.get(c.id) ?? 0
      const baseline = Math.round((base.get(c.id) ?? 0) / baselineMonths)
      return { category: c, currentCents: current, baselineCents: baseline, changeCents: current - baseline,
        changeRatio: baseline ? (current - baseline) / baseline : null }
    })
    .filter((r) => r.currentCents || r.baselineCents)
    .sort((a, b) => Math.abs(b.changeCents) - Math.abs(a.changeCents))
}

/**
 * Month-end spending forecast. Recurring charges still expected this month are added at their typical amount.
 * Everyday (non-recurring) spending continues at a daily rate that blends this month's pace with the median
 * pace of the previous `baselineMonths` months, weighted by the share of the month already elapsed: early on
 * the forecast leans on history (one big purchase on the 2nd isn't multiplied by 30), late in the month on
 * the month itself. Completed months return actuals.
 */
export function projectMonthEnd(transactions, key, today, recurring = [], { baselineMonths = 3 } = {}) {
  const todayKey = monthOf(today)
  if (key > todayKey) return null
  const days = daysInMonth(key)
  const dayOfMonth = key === todayKey ? dayOf(today) : days
  const recurringKeys = new Set(recurring.map((r) => r.key))
  const isEveryday = (t) => t.type === 'expense' && !recurringKeys.has(normalizeMerchant(t.description))

  let spentSoFar = 0
  let everydaySoFar = 0
  for (const t of transactions) {
    if (t.type !== 'expense' || monthOf(t.date) !== key || t.date > today) continue
    spentSoFar += t.amountCents
    if (isEveryday(t)) everydaySoFar += t.amountCents
  }
  const remainingDays = days - dayOfMonth
  const result = { spentSoFar, projectedCents: spentSoFar, recurringRemaining: 0, everydayRemaining: 0, baselineMonths: 0, dayOfMonth, days }
  if (remainingDays === 0) return { ...result, complete: true }

  const baselineKeys = monthsEnding(addMonths(key, -1), baselineMonths)
  const totals = new Map()
  for (const t of transactions) {
    const month = monthOf(t.date)
    if (!baselineKeys.includes(month)) continue
    totals.set(month, (totals.get(month) ?? 0) + (isEveryday(t) ? t.amountCents : 0))
  }
  // only months with any activity: a new user's empty history shouldn't drag the forecast to zero
  const rates = [...totals].map(([month, cents]) => cents / daysInMonth(month))
  const pace = everydaySoFar / dayOfMonth
  const weight = dayOfMonth / days
  const dailyRate = rates.length ? weight * pace + (1 - weight) * median(rates) : pace
  const everydayRemaining = Math.round(dailyRate * remainingDays)

  const recurringRemaining = recurring
    .filter((r) => r.active)
    .reduce((sum, r) => sum + expectedCharges(r, `${key}-01`, `${key}-${pad(days)}`).length * r.avgCents, 0)

  return {
    ...result,
    projectedCents: spentSoFar + recurringRemaining + everydayRemaining,
    recurringRemaining,
    everydayRemaining,
    baselineMonths: rates.length,
    complete: false,
  }
}
