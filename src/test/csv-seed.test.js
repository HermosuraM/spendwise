import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES, fallbackCategoryId } from '../data/categories'
import { parseCSV, rowsToTransactions, toCSV, transactionsToCSV } from '../lib/csv'
import { addMonths } from '../lib/dates'
import { detectAnomalies, detectRecurring } from '../lib/insights'
import { generateSampleData } from '../lib/seed'

describe('parseCSV', () => {
  it('handles quotes, escaped quotes, embedded commas and newlines, CRLF and a BOM', () => {
    const text = '﻿date,description,amount\r\n2026-09-01,"Joe\'s ""Diner"", Austin",-12.50\r\n2026-09-02,"two\nlines",3\r\n\r\n'
    expect(parseCSV(text)).toEqual([
      ['date', 'description', 'amount'],
      ['2026-09-01', 'Joe\'s "Diner", Austin', '-12.50'],
      ['2026-09-02', 'two\nlines', '3'],
    ])
  })

  it('round-trips through toCSV', () => {
    const rows = [['a', 'b,c', 'say "hi"'], ['1', '', 'x\ny']]
    expect(parseCSV(toCSV(rows))).toEqual(rows)
  })
})

describe('rowsToTransactions', () => {
  it('imports a typical bank export: signed amounts, US dates, unknown categories to "Other"', () => {
    const rows = parseCSV('Posted Date,Payee,Amount,Category\n09/03/2026,TRADER JOE\'S,-54.20,groceries\n09/05/2026,ACME PAYROLL,"2,150.00",Paycheck\n')
    const { transactions, errors } = rowsToTransactions(rows, DEFAULT_CATEGORIES)
    expect(errors).toEqual([])
    expect(transactions).toEqual([
      { date: '2026-09-03', description: 'TRADER JOE\'S', amountCents: 5420, type: 'expense', categoryId: 'groceries', notes: '' },
      { date: '2026-09-05', description: 'ACME PAYROLL', amountCents: 215000, type: 'income', categoryId: 'other-income', notes: '' },
    ])
  })

  it('reports bad rows by line number and keeps the good ones', () => {
    const rows = parseCSV('date,description,amount\n2026-02-30,X,5\n2026-09-01,,5\n2026-09-01,Y,abc\n2026-09-01,Z,0\n2026-09-02,OK,-1\n')
    const { transactions, errors } = rowsToTransactions(rows, DEFAULT_CATEGORIES)
    expect(transactions).toHaveLength(1)
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5])
  })

  it('requires date, description and amount columns', () => {
    const { errors } = rowsToTransactions([['when', 'what']], DEFAULT_CATEGORIES)
    expect(errors[0].message).toBe('Missing column(s): date, description, amount.')
  })

  it('re-imports its own export', () => {
    const data = generateSampleData({ today: '2026-09-18', months: 2 })
    const { transactions, errors } = rowsToTransactions(parseCSV(transactionsToCSV(data.transactions, data.categories)), data.categories)
    expect(errors).toEqual([])
    const strip = (ts) => ts.map(({ date, description, amountCents, type, categoryId }) => ({ date, description, amountCents, type, categoryId }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description) || a.amountCents - b.amountCents)
    expect(strip(transactions)).toEqual(strip(data.transactions))
  })

  it('falls back to the "Other" category by name when ids are database uuids (Supabase)', () => {
    const remote = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }))
    const other = remote.find((c) => c.name === 'Other')
    expect(fallbackCategoryId(remote, 'expense')).toBe(other.id)
    const { transactions } = rowsToTransactions(parseCSV('date,description,amount\n2026-09-01,MYSTERY,-9\n'), remote)
    expect(transactions[0].categoryId).toBe(other.id)
  })
})

describe('generateSampleData', () => {
  const today = '2026-09-18'
  const data = generateSampleData({ today })

  it('is deterministic and ends today', () => {
    expect(generateSampleData({ today })).toEqual(data)
    expect(data.transactions.every((t) => t.date <= today && t.date >= `${addMonths('2026-09', -11)}-01`)).toBe(true)
  })

  it('only uses known categories and positive integer cents', () => {
    const ids = new Set(data.categories.map((c) => c.id))
    for (const t of data.transactions) {
      expect(ids.has(t.categoryId)).toBe(true)
      expect(Number.isInteger(t.amountCents) && t.amountCents > 0).toBe(true)
      expect(data.categories.find((c) => c.id === t.categoryId).type).toBe(t.type)
    }
  })

  it('contains exactly the patterns the Insights page claims to find', () => {
    const recurring = detectRecurring(data.transactions, today)
    expect(recurring.map((r) => r.key).sort()).toEqual(
      ['APPLE', 'NETFLIX', 'PLANET FITNESS', 'SPECTRUM INTERNET', 'SPOTIFY USA', 'SUNSET APARTMENTS RENT', 'T MOBILE WIRELESS'])
    const unusual = detectAnomalies(data.transactions, today, recurring).map((a) => a.transaction.description)
    expect(unusual).toEqual(['BEST BUY 00431', 'FOGO DE CHAO DALLAS'])
  })
})
