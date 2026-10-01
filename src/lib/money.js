// Money is stored as integer cents (minor units) so sums never drift.

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'INR', 'MXN', 'PHP']

export function toCents(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : NaN
  const cleaned = String(value ?? '').trim().replace(/[,$\s]/g, '')
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(cleaned)) return NaN
  return Math.round(Number(cleaned) * 100)
}

export function fromCents(cents) {
  return (cents / 100).toFixed(2)
}

const cache = new Map()

export function formatMoney(cents, currency = 'USD', { compact = false, signed = false } = {}) {
  const key = `${currency}|${compact}|${signed}`
  if (!cache.has(key)) {
    cache.set(
      key,
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        notation: compact ? 'compact' : 'standard',
        maximumFractionDigits: compact ? 1 : undefined,
        signDisplay: signed ? 'exceptZero' : 'auto',
      }),
    )
  }
  return cache.get(key).format(cents / 100)
}

export function formatPercent(ratio, digits = 0) {
  if (ratio == null || !Number.isFinite(ratio)) return '—'
  return `${(ratio * 100).toFixed(digits)}%`
}
