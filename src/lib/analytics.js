// Pure aggregation functions over transactions: { id, date, description, amountCents, type, categoryId }.
// Amounts are always positive; `type` ("expense" | "income") carries the direction.

import { monthOf, monthsEnding } from './dates'

export const inMonth = (t, key) => t.date.startsWith(key)

/** Month totals. `throughDay` keeps only days 1..N, for like-for-like comparisons with a month in progress. */
export function summarizeMonth(transactions, key, { throughDay = 31 } = {}) {
  let incomeCents = 0
  let expenseCents = 0
  let count = 0
  for (const t of transactions) {
    if (!inMonth(t, key) || Number(t.date.slice(8, 10)) > throughDay) continue
    count += 1
    if (t.type === 'income') incomeCents += t.amountCents
    else expenseCents += t.amountCents
  }
  const netCents = incomeCents - expenseCents
  return { incomeCents, expenseCents, netCents, savingsRate: incomeCents > 0 ? netCents / incomeCents : null, count }
}

function spentByCategory(transactions, key) {
  const totals = new Map()
  for (const t of transactions) {
    if (t.type === 'expense' && inMonth(t, key)) totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountCents)
  }
  return totals
}

/**
 * Spending by category for one month, largest first. Categories without a palette slot (and anything
 * beyond `maxSlices`) fold into a single "Other" row so a chart never needs a generated color.
 */
export function spendingByCategory(transactions, key, categories, { maxSlices = 8 } = {}) {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const all = [...spentByCategory(transactions, key)]
    .map(([categoryId, cents]) => ({
      categoryId,
      name: byId.get(categoryId)?.name ?? 'Uncategorized',
      colorSlot: byId.get(categoryId)?.colorSlot ?? null,
      cents,
    }))
    .sort((a, b) => b.cents - a.cents)
  const totalCents = all.reduce((sum, r) => sum + r.cents, 0)
  const rows = []
  const other = { categoryId: '__other__', name: 'Other', colorSlot: null, cents: 0, members: [] }
  for (const r of all) {
    if (r.colorSlot != null && rows.length < maxSlices) rows.push(r)
    else {
      other.cents += r.cents
      other.members.push(r.name)
    }
  }
  if (other.cents > 0) rows.push(other)
  return { totalCents, rows: rows.map((r) => ({ ...r, share: totalCents ? r.cents / totalCents : 0 })), all }
}

export function monthlySeries(transactions, endKey, count) {
  const keys = monthsEnding(endKey, count)
  const index = new Map(keys.map((k, i) => [k, i]))
  const rows = keys.map((key) => ({ key, incomeCents: 0, expenseCents: 0 }))
  for (const t of transactions) {
    const i = index.get(monthOf(t.date))
    if (i === undefined) continue
    if (t.type === 'income') rows[i].incomeCents += t.amountCents
    else rows[i].expenseCents += t.amountCents
  }
  return rows.map((r) => ({ ...r, netCents: r.incomeCents - r.expenseCents }))
}

/** The budget in force for a category and month: its own, or the most recent earlier one (carry-forward). */
export function budgetFor(budgets, categoryId, key) {
  let best = null
  for (const b of budgets) {
    if (b.categoryId === categoryId && b.month <= key && (!best || b.month > best.month)) best = b
  }
  return best
}

export const WARN_AT = 0.85

export function budgetStatus(spentCents, limitCents) {
  if (!limitCents) return 'none'
  const ratio = spentCents / limitCents
  if (ratio > 1) return 'over'
  return ratio >= WARN_AT ? 'warning' : 'ok'
}

export function budgetRows(transactions, budgets, categories, key) {
  const spent = spentByCategory(transactions, key)
  return categories
    .filter((c) => c.type === 'expense')
    .map((category) => {
      const budget = budgetFor(budgets, category.id, key)
      const limitCents = budget?.limitCents ?? 0
      const spentCents = spent.get(category.id) ?? 0
      return {
        category,
        budget,
        inherited: Boolean(budget && budget.month !== key),
        limitCents,
        spentCents,
        remainingCents: limitCents - spentCents,
        ratio: limitCents ? spentCents / limitCents : null,
        status: budgetStatus(spentCents, limitCents),
      }
    })
}
