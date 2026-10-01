// CSV import/export. Import accepts SpendWise's own export and typical bank exports
// (signed amounts, MM/DD/YYYY dates, "Description"/"Memo"/"Merchant" columns).

import { fallbackCategoryId } from '../data/categories'
import { isValidISODate, pad } from './dates'
import { fromCents, toCents } from './money'

/** RFC 4180-style parser: quoted fields, escaped quotes (""), commas and newlines inside quotes, BOM. */
export function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/^\uFEFF/, '') // byte-order mark from Excel exports
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]
    if (inQuotes) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (ch === '"') inQuotes = false
      else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

const quote = (value) => {
  const v = String(value ?? '')
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCSV(rows) {
  return rows.map((r) => r.map(quote).join(',')).join('\n') + '\n'
}

export function transactionsToCSV(transactions, categories) {
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  return toCSV([
    ['date', 'description', 'amount', 'type', 'category', 'notes'],
    ...sorted.map((t) => [t.date, t.description, fromCents(t.amountCents), t.type, names.get(t.categoryId) ?? '', t.notes ?? '']),
  ])
}

const HEADERS = {
  date: ['date', 'transaction date', 'posted date', 'posting date'],
  description: ['description', 'merchant', 'name', 'memo', 'payee'],
  amount: ['amount', 'value'],
  type: ['type', 'transaction type'],
  category: ['category'],
  notes: ['notes', 'note'],
}

function normalizeDate(value) {
  const v = value.trim()
  if (isValidISODate(v)) return v
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (us) {
    const iso = `${us[3]}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`
    return isValidISODate(iso) ? iso : null
  }
  return null
}

/**
 * Turn parsed CSV rows into transactions. Without a "type" column, negative amounts are expenses and
 * positive amounts income (the usual bank-export convention).
 */
export function rowsToTransactions(rows, categories) {
  if (!rows.length) return { transactions: [], errors: [{ line: 1, message: 'The file is empty.' }] }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = Object.fromEntries(Object.entries(HEADERS).map(([field, names]) => [field, header.findIndex((h) => names.includes(h))]))
  const missing = ['date', 'description', 'amount'].filter((f) => col[f] < 0)
  if (missing.length) {
    return { transactions: [], errors: [{ line: 1, message: `Missing column(s): ${missing.join(', ')}.` }] }
  }
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]))
  const fallback = { expense: fallbackCategoryId(categories, 'expense'), income: fallbackCategoryId(categories, 'income') }
  const transactions = []
  const errors = []
  rows.slice(1).forEach((r, i) => {
    const line = i + 2
    const date = normalizeDate(r[col.date] ?? '')
    const description = (r[col.description] ?? '').trim()
    const raw = toCents(r[col.amount] ?? '')
    if (!date) return errors.push({ line, message: `Unrecognized date "${r[col.date] ?? ''}".` })
    if (!description) return errors.push({ line, message: 'Missing description.' })
    if (!Number.isFinite(raw) || raw === 0) return errors.push({ line, message: `Invalid amount "${r[col.amount] ?? ''}".` })
    const typeCell = col.type >= 0 ? (r[col.type] ?? '').trim().toLowerCase() : ''
    const type = typeCell === 'income' || typeCell === 'expense' ? typeCell : raw < 0 ? 'expense' : 'income'
    const named = col.category >= 0 ? byName.get((r[col.category] ?? '').trim().toLowerCase()) : null
    const categoryId = named && named.type === type ? named.id : fallback[type]
    transactions.push({ date, description, amountCents: Math.abs(raw), type, categoryId, notes: col.notes >= 0 ? (r[col.notes] ?? '').trim() : '' })
  })
  return { transactions, errors }
}
