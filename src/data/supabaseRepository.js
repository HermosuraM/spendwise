// Supabase storage: Postgres tables protected by row-level security (see supabase/schema.sql), so every
// query is automatically scoped to the signed-in user. Same interface as the local repository.

import { DEFAULT_CATEGORIES } from './categories'

const toTxn = (r) => ({ id: r.id, date: r.date, description: r.description, amountCents: r.amount_cents, type: r.type,
  categoryId: r.category_id, notes: r.notes ?? '' })
const fromTxn = (t) => ({ ...(t.id ? { id: t.id } : {}), date: t.date, description: t.description,
  amount_cents: t.amountCents, type: t.type, category_id: t.categoryId, notes: t.notes ?? '' })
const toBudget = (r) => ({ id: r.id, categoryId: r.category_id, month: r.month, limitCents: r.limit_cents })
const toCategory = (r) => ({ id: r.id, name: r.name, type: r.type, colorSlot: r.color_slot })
const fromCategory = (c) => ({ ...(c.id ? { id: c.id } : {}), name: c.name, type: c.type, color_slot: c.colorSlot ?? null })

export const mappers = { toTxn, fromTxn, toBudget, toCategory, fromCategory }

function check({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export function createSupabaseRepository(client) {
  return {
    kind: 'supabase',
    persistent: true,

    async load() {
      let categories = check(await client.from('categories').select('*').order('created_at'))
      if (!categories.length) {
        // first sign-in: give the account the default category set
        const defaults = DEFAULT_CATEGORIES.map((c) => fromCategory({ ...c, id: undefined })) // slugs -> database uuids
        categories = check(await client.from('categories').insert(defaults).select())
      }
      const transactions = check(await client.from('transactions').select('*').order('date', { ascending: false }))
      const budgets = check(await client.from('budgets').select('*'))
      return { version: 1, categories: categories.map(toCategory), transactions: transactions.map(toTxn), budgets: budgets.map(toBudget) }
    },

    async addTransactions(items) {
      const rows = check(await client.from('transactions').insert(items.map(fromTxn)).select())
      return rows.map(toTxn)
    },

    async updateTransaction(id, patch) {
      const row = check(await client.from('transactions').update(fromTxn({ ...patch, id: undefined })).eq('id', id).select().single())
      return toTxn(row)
    },

    async deleteTransaction(id) {
      check(await client.from('transactions').delete().eq('id', id))
    },

    async setBudget({ categoryId, month, limitCents }) {
      if (!limitCents) {
        check(await client.from('budgets').delete().eq('category_id', categoryId).eq('month', month))
        return null
      }
      const row = check(await client.from('budgets')
        .upsert({ category_id: categoryId, month, limit_cents: limitCents }, { onConflict: 'user_id,category_id,month' })
        .select().single())
      return toBudget(row)
    },

    async addCategory(category) {
      return toCategory(check(await client.from('categories').insert(fromCategory(category)).select().single()))
    },

    async reset() {
      check(await client.from('transactions').delete().not('id', 'is', null))
      check(await client.from('budgets').delete().not('id', 'is', null))
      return this.load()
    },
  }
}
