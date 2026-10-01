// Default categories. The eight largest spending categories own a palette slot (fixed color);
// the rest share the neutral "Other" color and fold into "Other" in charts.
export const DEFAULT_CATEGORIES = [
  { id: 'housing', name: 'Housing', type: 'expense', colorSlot: 0 },
  { id: 'groceries', name: 'Groceries', type: 'expense', colorSlot: 1 },
  { id: 'dining', name: 'Dining', type: 'expense', colorSlot: 2 },
  { id: 'transport', name: 'Transport', type: 'expense', colorSlot: 3 },
  { id: 'utilities', name: 'Utilities', type: 'expense', colorSlot: 4 },
  { id: 'shopping', name: 'Shopping', type: 'expense', colorSlot: 5 },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', colorSlot: 6 },
  { id: 'health', name: 'Health', type: 'expense', colorSlot: 7 },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', colorSlot: null },
  { id: 'travel', name: 'Travel', type: 'expense', colorSlot: null },
  { id: 'other', name: 'Other', type: 'expense', colorSlot: null },
  { id: 'salary', name: 'Salary', type: 'income', colorSlot: null },
  { id: 'freelance', name: 'Freelance', type: 'income', colorSlot: null },
  { id: 'other-income', name: 'Other income', type: 'income', colorSlot: null },
]

export const FALLBACK_CATEGORY = { expense: 'other', income: 'other-income' }

/**
 * Where uncategorized imports go: the "Other" category of that type. Matched by slug locally and by name in
 * Supabase, where the same defaults get database-generated uuids.
 */
export function fallbackCategoryId(categories, type) {
  const name = type === 'income' ? 'other income' : 'other'
  const match = categories.find((c) => c.id === FALLBACK_CATEGORY[type])
    ?? categories.find((c) => c.type === type && c.name.toLowerCase() === name)
    ?? categories.find((c) => c.type === type)
  return match?.id ?? null
}
