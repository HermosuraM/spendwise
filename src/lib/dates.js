// Dates are plain ISO strings (YYYY-MM-DD) in local time; months are keys like "2026-09".

export const pad = (n) => String(n).padStart(2, '0')

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO() {
  // Dev-only time travel for checking month boundaries, e.g. http://localhost:5173/?today=2026-09-18
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const override = new URLSearchParams(window.location.search).get('today')
    if (isValidISODate(override)) return override
  }
  return toISODate(new Date())
}

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toISODate(parseISO(s)) === s
}

export const monthOf = (isoDate) => isoDate.slice(0, 7)

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthsEnding(endKey, count) {
  return Array.from({ length: count }, (_, i) => addMonths(endKey, i - count + 1))
}

export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function monthLabel(key, month = 'long') {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month, year: 'numeric' })
}

export function shortMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

export function formatDay(isoDate, opts = { month: 'short', day: 'numeric' }) {
  return parseISO(isoDate).toLocaleDateString('en-US', opts)
}

/** Same day-of-month `n` months later, clamped to that month's length (Jan 31 + 1 month = Feb 28). */
export function addMonthsToDate(isoDate, n) {
  const key = addMonths(monthOf(isoDate), n)
  return `${key}-${pad(Math.min(Number(isoDate.slice(8, 10)), daysInMonth(key)))}`
}

export function addDays(isoDate, n) {
  const d = parseISO(isoDate)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86_400_000)
}
