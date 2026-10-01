import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../data/categories'
import { budgetFor, budgetRows, budgetStatus, monthlySeries, spendingByCategory, summarizeMonth } from '../lib/analytics'

let n = 0
const tx = (date, cents, categoryId = 'groceries', type = 'expense', description = 'STORE') =>
  ({ id: `t${(n += 1)}`, date, description, amountCents: cents, type, categoryId, notes: '' })

describe('summarizeMonth', () => {
  const txns = [
    tx('2026-09-01', 300_000, 'salary', 'income'),
    tx('2026-09-02', 50_000),
    tx('2026-09-20', 25_000),
    tx('2026-08-31', 99_999),
  ]

  it('totals income, spending, net and savings rate for one month', () => {
    expect(summarizeMonth(txns, '2026-09')).toEqual({
      incomeCents: 300_000, expenseCents: 75_000, netCents: 225_000, savingsRate: 0.75, count: 3,
    })
  })

  it('limits to days 1..N for month-to-date comparisons', () => {
    expect(summarizeMonth(txns, '2026-09', { throughDay: 10 }).expenseCents).toBe(50_000)
  })

  it('has no savings rate without income', () => {
    expect(summarizeMonth([tx('2026-09-02', 100)], '2026-09').savingsRate).toBeNull()
  })
})

describe('spendingByCategory', () => {
  it('keeps palette categories and folds the rest into "Other"', () => {
    const txns = [tx('2026-09-01', 145_000, 'housing'), tx('2026-09-03', 40_000, 'groceries'),
      tx('2026-09-04', 6_000, 'entertainment'), tx('2026-09-05', 4_000, 'travel'), tx('2026-08-04', 1, 'dining')]
    const { totalCents, rows } = spendingByCategory(txns, '2026-09', DEFAULT_CATEGORIES)
    expect(totalCents).toBe(195_000)
    expect(rows.map((r) => r.name)).toEqual(['Housing', 'Groceries', 'Other'])
    expect(rows.at(-1)).toMatchObject({ categoryId: '__other__', cents: 10_000, members: ['Entertainment', 'Travel'] })
    expect(rows.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1)
  })

  it('never needs more than maxSlices colors', () => {
    const txns = DEFAULT_CATEGORIES.filter((c) => c.colorSlot != null).map((c, i) => tx('2026-09-02', 1000 + i, c.id))
    const { rows } = spendingByCategory(txns, '2026-09', DEFAULT_CATEGORIES, { maxSlices: 5 })
    expect(rows).toHaveLength(6)
    expect(rows.at(-1).name).toBe('Other')
  })
})

describe('budgets', () => {
  const budgets = [
    { id: 'b1', categoryId: 'dining', month: '2026-01', limitCents: 20_000 },
    { id: 'b2', categoryId: 'dining', month: '2026-06', limitCents: 25_000 },
  ]

  it('carries the latest earlier budget forward', () => {
    expect(budgetFor(budgets, 'dining', '2025-12')).toBeNull()
    expect(budgetFor(budgets, 'dining', '2026-03').limitCents).toBe(20_000)
    expect(budgetFor(budgets, 'dining', '2026-09').limitCents).toBe(25_000)
  })

  it('classifies status at 85% and 100%', () => {
    expect(budgetStatus(100, 0)).toBe('none')
    expect(budgetStatus(84, 100)).toBe('ok')
    expect(budgetStatus(85, 100)).toBe('warning')
    expect(budgetStatus(100, 100)).toBe('warning')
    expect(budgetStatus(101, 100)).toBe('over')
  })

  it('builds rows with spent, remaining and inherited flags', () => {
    const rows = budgetRows([tx('2026-09-05', 27_500, 'dining')], budgets, DEFAULT_CATEGORIES, '2026-09')
    const dining = rows.find((r) => r.category.id === 'dining')
    expect(dining).toMatchObject({ spentCents: 27_500, limitCents: 25_000, remainingCents: -2_500, status: 'over', inherited: true })
    expect(rows.every((r) => r.category.type === 'expense')).toBe(true)
  })
})

describe('monthlySeries', () => {
  it('returns every month in the window, including empty ones', () => {
    const series = monthlySeries([tx('2026-07-10', 500), tx('2026-09-01', 900, 'salary', 'income')], '2026-09', 3)
    expect(series).toEqual([
      { key: '2026-07', incomeCents: 0, expenseCents: 500, netCents: -500 },
      { key: '2026-08', incomeCents: 0, expenseCents: 0, netCents: 0 },
      { key: '2026-09', incomeCents: 900, expenseCents: 0, netCents: 900 },
    ])
  })
})
