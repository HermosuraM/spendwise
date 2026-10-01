import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../data/categories'
import { addDays, addMonths, monthsEnding } from '../lib/dates'
import { categoryChanges, detectAnomalies, detectRecurring, expectedCharges, nthCharge, projectMonthEnd } from '../lib/insights'

let n = 0
const tx = (date, cents, description, categoryId = 'shopping', type = 'expense') =>
  ({ id: `t${(n += 1)}`, date, description, amountCents: cents, type, categoryId, notes: '' })

/** One charge per month on `day`, for the `count` months ending `endKey`. */
const monthly = (description, cents, day, count, endKey, categoryId) =>
  monthsEnding(endKey, count).map((key) => tx(`${key}-${String(day).padStart(2, '0')}`, cents, description, categoryId))

describe('detectRecurring', () => {
  it('finds a monthly charge and predicts the same day next month', () => {
    const rent = monthly('SUNSET APARTMENTS RENT', 145_000, 1, 7, '2026-10', 'housing')
    const [found] = detectRecurring(rent, '2026-10-01')
    expect(found).toMatchObject({
      key: 'SUNSET APARTMENTS RENT', cadence: 'Monthly', count: 7, avgCents: 145_000,
      lastDate: '2026-10-01', nextDate: '2026-11-01', active: true,
    })
  })

  it('groups noisy descriptions of the same merchant', () => {
    const netflix = [
      tx('2026-06-06', 1549, 'NETFLIX.COM 866-579-7172'), tx('2026-07-06', 1549, 'NETFLIX.COM'),
      tx('2026-08-06', 1549, 'NETFLIX.COM 866-579-7172'), tx('2026-09-06', 1549, 'NETFLIX.COM 4029'),
    ]
    expect(detectRecurring(netflix, '2026-09-18').map((r) => r.key)).toEqual(['NETFLIX'])
  })

  it('detects weekly and biweekly cadences', () => {
    const weekly = Array.from({ length: 8 }, (_, i) => tx(addDays('2026-07-03', 7 * i), 1_200, 'BLUE BOTTLE'))
    const biweekly = Array.from({ length: 6 }, (_, i) => tx(addDays('2026-06-05', 14 * i), 4_000, 'CLEANING CO'))
    const cadences = Object.fromEntries(detectRecurring([...weekly, ...biweekly], '2026-08-25').map((r) => [r.key, r.cadence]))
    expect(cadences).toEqual({ 'BLUE BOTTLE': 'Weekly', 'CLEANING CO': 'Every 2 weeks' })
  })

  it('rejects unsteady amounts and irregular timing', () => {
    const groceries = [tx('2026-06-03', 5_000, 'H-E-B #482'), tx('2026-07-03', 9_500, 'H-E-B #482'),
      tx('2026-08-03', 4_800, 'H-E-B #482'), tx('2026-09-03', 8_900, 'H-E-B #482')]
    const irregular = ['2026-01-05', '2026-01-09', '2026-03-28', '2026-04-02', '2026-07-30'].map((d) => tx(d, 2_000, 'ZARA'))
    expect(detectRecurring([...groceries, ...irregular], '2026-09-18')).toEqual([])
  })

  it('marks a charge that missed two cycles as inactive', () => {
    const [gym] = detectRecurring(monthly('PLANET FITNESS', 2_499, 2, 4, '2026-04'), '2026-09-18')
    expect(gym.active).toBe(false)
  })

  it('ignores future-dated (planned) transactions', () => {
    const phone = [...monthly('T-MOBILE', 4_500, 20, 3, '2026-08'), tx('2026-09-20', 4_500, 'T-MOBILE')]
    const [found] = detectRecurring(phone, '2026-09-15')
    expect(found).toMatchObject({ lastDate: '2026-08-20', nextDate: '2026-09-20', count: 3 })
  })
})

describe('charge schedule', () => {
  it('steps monthly cadences by calendar month without drifting', () => {
    expect(nthCharge('2026-01-31', 'Monthly', 1)).toBe('2026-02-28')
    expect(nthCharge('2026-01-31', 'Monthly', 2)).toBe('2026-03-31')
    expect(nthCharge('2026-01-15', 'Quarterly')).toBe('2026-04-15')
    expect(nthCharge('2025-02-10', 'Yearly')).toBe('2026-02-10')
    expect(nthCharge('2026-09-01', 'Every 2 weeks')).toBe('2026-09-15')
  })

  it('lists every expected weekly charge in a window', () => {
    const weekly = { lastDate: '2026-09-28', cadence: 'Weekly' }
    expect(expectedCharges(weekly, '2026-10-01', '2026-10-31')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
  })
})

describe('detectAnomalies', () => {
  const history = Array.from({ length: 20 }, (_, i) => tx(addDays('2026-09-10', -15 * i), 4_000 + (i % 5) * 500, `H-E-B #${i}`, 'groceries'))
  const spike = tx('2026-09-05', 100_000, 'COSTCO WHSE #1066', 'groceries')
  const oldSpike = tx('2026-01-02', 90_000, 'COSTCO WHSE #1066', 'groceries')

  it('flags a recent purchase far above its category typical, robustly to older outliers', () => {
    const flagged = detectAnomalies([...history, spike, oldSpike], '2026-09-18')
    expect(flagged.map((f) => f.transaction.id)).toEqual([spike.id])
    expect(flagged[0].ratio).toBeGreaterThan(15)
    expect(flagged[0].typicalCents).toBeGreaterThan(4_000)
    expect(flagged[0].typicalCents).toBeLessThan(6_000)
  })

  it('skips recurring merchants and thin categories', () => {
    expect(detectAnomalies([...history, spike], '2026-09-18', [{ key: 'COSTCO WHSE' }])).toEqual([])
    expect(detectAnomalies([...history.slice(0, 5), spike], '2026-09-18')).toEqual([])
  })
})

describe('categoryChanges', () => {
  const baseline = ['2026-07', '2026-08', '2026-09'].flatMap((key) => [
    tx(`${key}-05`, 10_000, 'CHIPOTLE', 'dining'), tx(`${key}-25`, 30_000, 'FOGO DE CHAO', 'dining')])
  const october = [tx('2026-10-05', 15_000, 'SHAKE SHACK', 'dining')]

  it('compares a whole month with the 3-month average', () => {
    const [dining] = categoryChanges([...baseline, ...october], '2026-10', DEFAULT_CATEGORIES)
    expect(dining).toMatchObject({ currentCents: 15_000, baselineCents: 40_000, changeCents: -25_000 })
  })

  it('compares only the same days while a month is in progress', () => {
    const [dining] = categoryChanges([...baseline, ...october], '2026-10', DEFAULT_CATEGORIES, { throughDay: 10 })
    expect(dining).toMatchObject({ currentCents: 15_000, baselineCents: 10_000, changeCents: 5_000, changeRatio: 0.5 })
  })
})

describe('projectMonthEnd', () => {
  it('does not count a monthly charge again after it was paid (rent on the 1st)', () => {
    const txns = [...monthly('SUNSET APARTMENTS RENT', 145_000, 1, 7, '2026-10', 'housing'),
      ...monthly('SPECTRUM INTERNET', 6_499, 4, 6, '2026-09', 'utilities')]
    const today = '2026-10-01'
    const p = projectMonthEnd(txns, '2026-10', today, detectRecurring(txns, today))
    expect(p.recurringRemaining).toBe(6_499) // internet on the 4th is still due; rent is not
    expect(p.spentSoFar).toBe(145_000)
  })

  // Everyday spending averaged $10/day for three months; then a $300 purchase on the 2nd.
  const history = [tx('2026-07-12', 31_000, 'TARGET'), tx('2026-08-09', 31_000, 'COSTCO'), tx('2026-09-14', 30_000, 'IKEA')]
  const bigPurchase = tx('2026-10-02', 30_000, 'BEST BUY')

  it('blends an early-month pace with the usual pace instead of multiplying it by 30', () => {
    const p = projectMonthEnd([...history, bigPurchase], '2026-10', '2026-10-02')
    // rate = 2/31 * $150/day + 29/31 * $10/day, for the 29 remaining days
    expect(p.everydayRemaining).toBe(Math.round((59_000 / 31) * 29))
    expect(p.baselineMonths).toBe(3)
    expect(p.projectedCents).toBe(30_000 + Math.round((59_000 / 31) * 29))
    expect(p.complete).toBe(false)
  })

  it('falls back to the current pace without history', () => {
    const p = projectMonthEnd([bigPurchase], '2026-10', '2026-10-02')
    expect(p.everydayRemaining).toBe(15_000 * 29)
    expect(p.baselineMonths).toBe(0)
  })

  it('returns actuals for a finished month and nothing for a future one', () => {
    const p = projectMonthEnd([...history, bigPurchase], '2026-09', '2026-10-02')
    expect(p).toMatchObject({ complete: true, spentSoFar: 30_000, projectedCents: 30_000, recurringRemaining: 0 })
    expect(projectMonthEnd(history, addMonths('2026-10', 1), '2026-10-02')).toBeNull()
  })
})
