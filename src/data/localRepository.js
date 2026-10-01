// Local-first storage: one versioned JSON document in localStorage. Every method is async so the UI treats
// this and the Supabase repository identically.

import { generateSampleData } from '../lib/seed'
import { todayISO } from '../lib/dates'
import { DEFAULT_CATEGORIES } from './categories'

export const STORAGE_KEY = 'spendwise:data'
const VERSION = 1

const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`)

function memoryStorage() {
  const data = new Map()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) }
}

function usableStorage(storage) {
  try {
    const probe = '__spendwise_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return { storage, persistent: true }
  } catch {
    return { storage: memoryStorage(), persistent: false } // private browsing / blocked storage
  }
}

export function createLocalRepository({ storage = globalThis.localStorage, today = todayISO } = {}) {
  const store = usableStorage(storage)
  const sample = () => ({ version: VERSION, ...generateSampleData({ today: today() }) })
  const empty = () => ({ version: VERSION, categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), transactions: [], budgets: [] })

  const read = () => {
    try {
      const doc = JSON.parse(store.storage.getItem(STORAGE_KEY))
      return doc?.version === VERSION ? doc : null
    } catch {
      return null
    }
  }
  const write = (doc) => {
    store.storage.setItem(STORAGE_KEY, JSON.stringify(doc))
    return doc
  }
  const update = (fn) => write(fn(read() ?? sample()))

  return {
    kind: 'local',
    persistent: store.persistent,

    async load() {
      return read() ?? write(sample())
    },

    async addTransactions(items) {
      const created = items.map((t) => ({ ...t, id: t.id ?? newId() }))
      update((doc) => ({ ...doc, transactions: [...created, ...doc.transactions] }))
      return created
    },

    async updateTransaction(id, patch) {
      let saved = null
      update((doc) => ({
        ...doc,
        transactions: doc.transactions.map((t) => (t.id === id ? (saved = { ...t, ...patch, id }) : t)),
      }))
      if (!saved) throw new Error('Transaction not found')
      return saved
    },

    async deleteTransaction(id) {
      update((doc) => ({ ...doc, transactions: doc.transactions.filter((t) => t.id !== id) }))
    },

    /** Upsert the budget for (category, month); a limit of 0 removes it. */
    async setBudget({ categoryId, month, limitCents }) {
      let saved = null
      update((doc) => {
        const others = doc.budgets.filter((b) => !(b.categoryId === categoryId && b.month === month))
        if (!limitCents) return { ...doc, budgets: others }
        const existing = doc.budgets.find((b) => b.categoryId === categoryId && b.month === month)
        saved = { id: existing?.id ?? newId(), categoryId, month, limitCents }
        return { ...doc, budgets: [...others, saved] }
      })
      return saved
    },

    async addCategory(category) {
      const created = { ...category, id: category.id ?? newId() }
      update((doc) => ({ ...doc, categories: [...doc.categories, created] }))
      return created
    },

    /** Replace everything with sample data, or clear transactions and budgets (categories are kept, as in Supabase). */
    async reset({ withSample = true } = {}) {
      if (withSample) return write(sample())
      return write({ ...empty(), categories: read()?.categories ?? empty().categories })
    },
  }
}
