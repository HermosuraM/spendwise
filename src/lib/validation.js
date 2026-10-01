import { isValidISODate } from './dates'
import { toCents } from './money'

export const MAX_CENTS = 100_000_000 // $1,000,000

/** Validate the transaction form. Returns { errors, cents } where errors maps field -> message. */
export function validateTransaction(form) {
  const errors = {}
  const cents = toCents(form.amount)
  if (!Number.isFinite(cents) || cents <= 0) errors.amount = 'Enter an amount greater than 0.'
  else if (cents > MAX_CENTS) errors.amount = 'That amount is too large.'
  if (!isValidISODate(form.date)) errors.date = 'Enter a valid date.'
  if (!form.description.trim()) errors.description = 'Add a short description.'
  else if (form.description.trim().length > 200) errors.description = 'Keep the description under 200 characters.'
  if (!form.categoryId) errors.categoryId = 'Choose a category.'
  return { errors, cents }
}
