import { describe, expect, it } from 'vitest'
import { addDays, addMonths, addMonthsToDate, daysBetween, daysInMonth, isValidISODate, monthsEnding } from '../lib/dates'
import { formatMoney, formatPercent, fromCents, toCents } from '../lib/money'
import { normalizeMerchant } from '../lib/merchant'
import { validateTransaction } from '../lib/validation'

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isValidISODate('2024-02-29')).toBe(true)
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2026-13-01')).toBe(false)
    expect(isValidISODate('10/01/2026')).toBe(false)
    expect(isValidISODate(null)).toBe(false)
  })

  it('steps months across year boundaries', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(monthsEnding('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
  })

  it('keeps the day of month when adding months, clamped to short months', () => {
    expect(addMonthsToDate('2026-10-01', 1)).toBe('2026-11-01')
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsToDate('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonthsToDate('2026-11-15', 3)).toBe('2027-02-15')
  })

  it('counts calendar days across daylight-saving changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('money', () => {
  it('parses user input into integer cents', () => {
    expect(toCents('12.34')).toBe(1234)
    expect(toCents('$1,234.5')).toBe(123450)
    expect(toCents('-5')).toBe(-500)
    expect(toCents('.5')).toBe(50)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents('abc')).toBeNaN()
    expect(toCents('1.2.3')).toBeNaN()
    expect(toCents('')).toBeNaN()
    expect(fromCents(123450)).toBe('1234.50')
  })

  it('formats currency, signs and percentages', () => {
    expect(formatMoney(123456)).toBe('$1,234.56')
    expect(formatMoney(-500, 'USD', { signed: true })).toBe('-$5.00')
    expect(formatMoney(500, 'USD', { signed: true })).toBe('+$5.00')
    expect(formatMoney(150000, 'USD', { compact: true })).toBe('$1.5K')
    expect(formatMoney(123456, 'EUR')).toBe('€1,234.56')
    expect(formatPercent(0.256)).toBe('26%')
    expect(formatPercent(null)).toBe('—')
  })
})

describe('normalizeMerchant', () => {
  it.each([
    ['SQ *TACO DELI', 'TACO DELI'],
    ['TST* PHO 95', 'PHO'],
    ['NETFLIX.COM 866-579-7172', 'NETFLIX'],
    ['APPLE.COM/BILL ICLOUD', 'APPLE'],
    ['AMAZON.COM*2K4L', 'AMAZON'],
    ['COSTCO WHSE #1066', 'COSTCO WHSE'],
    ['Trader Joe\'s #211', 'TRADER JOE S'],
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected)
  })

  it('groups the same merchant across store numbers', () => {
    expect(normalizeMerchant('SHELL OIL 5741')).toBe(normalizeMerchant('SHELL OIL 1209'))
  })
})

describe('validateTransaction', () => {
  const valid = { amount: '12.50', date: '2026-09-18', description: ' Coffee ', categoryId: 'dining' }

  it('accepts a complete form and returns cents', () => {
    expect(validateTransaction(valid)).toEqual({ errors: {}, cents: 1250 })
  })

  it('reports each invalid field', () => {
    const { errors } = validateTransaction({ amount: '0', date: '2026-02-30', description: '  ', categoryId: '' })
    expect(Object.keys(errors).sort()).toEqual(['amount', 'categoryId', 'date', 'description'])
    expect(validateTransaction({ ...valid, amount: '-3' }).errors.amount).toMatch(/greater than 0/)
    expect(validateTransaction({ ...valid, amount: '2000000' }).errors.amount).toMatch(/too large/)
    expect(validateTransaction({ ...valid, description: 'x'.repeat(201) }).errors.description).toMatch(/200/)
  })
})
