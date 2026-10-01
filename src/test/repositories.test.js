import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from '../data/categories'
import { createLocalRepository, STORAGE_KEY } from '../data/localRepository'
import { createSupabaseRepository, mappers } from '../data/supabaseRepository'

function memory() {
  const data = new Map()
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) }
}

const today = () => '2026-09-18'

describe('local repository', () => {
  it('seeds sample data on first load and persists it', async () => {
    const storage = memory()
    const db = await createLocalRepository({ storage, today }).load()
    expect(db.transactions.length).toBeGreaterThan(200)
    expect(JSON.parse(storage.getItem(STORAGE_KEY)).transactions).toHaveLength(db.transactions.length)
  })

  it('persists adds, edits, deletes and budgets across instances', async () => {
    const storage = memory()
    const repo = createLocalRepository({ storage, today })
    await repo.reset({ withSample: false })
    const [created] = await repo.addTransactions([{ date: '2026-09-02', description: 'Coffee', amountCents: 450, type: 'expense', categoryId: 'dining', notes: '' }])
    expect(created.id).toBeTruthy()
    await repo.updateTransaction(created.id, { amountCents: 500 })
    await repo.setBudget({ categoryId: 'dining', month: '2026-09', limitCents: 20_000 })
    await repo.setBudget({ categoryId: 'dining', month: '2026-09', limitCents: 25_000 })

    let db = await createLocalRepository({ storage, today }).load()
    expect(db.transactions).toEqual([{ ...created, amountCents: 500 }])
    expect(db.budgets).toEqual([expect.objectContaining({ categoryId: 'dining', month: '2026-09', limitCents: 25_000 })])

    await repo.deleteTransaction(created.id)
    await repo.setBudget({ categoryId: 'dining', month: '2026-09', limitCents: 0 })
    db = await repo.load()
    expect(db.transactions).toEqual([])
    expect(db.budgets).toEqual([])
    expect(db.categories).toEqual(DEFAULT_CATEGORIES)
  })

  it('clears transactions and budgets but keeps custom categories', async () => {
    const repo = createLocalRepository({ storage: memory(), today })
    await repo.load()
    const pets = await repo.addCategory({ name: 'Pets', type: 'expense', colorSlot: null })
    const db = await repo.reset({ withSample: false })
    expect(db.transactions).toEqual([])
    expect(db.budgets).toEqual([])
    expect(db.categories).toContainEqual(pets)
  })

  it('rejects edits to a missing transaction', async () => {
    await expect(createLocalRepository({ storage: memory(), today }).updateTransaction('nope', {})).rejects.toThrow('not found')
  })

  it('recovers from corrupt storage', async () => {
    const storage = memory()
    storage.setItem(STORAGE_KEY, '{not json')
    const db = await createLocalRepository({ storage, today }).load()
    expect(db.version).toBe(1)
    expect(db.transactions.length).toBeGreaterThan(0)
  })

  it('falls back to memory when storage is blocked', async () => {
    const blocked = { getItem: () => null, setItem: () => { throw new Error('SecurityError') }, removeItem: () => {} }
    const repo = createLocalRepository({ storage: blocked, today })
    expect(repo.persistent).toBe(false)
    const [t] = await repo.addTransactions([{ date: '2026-09-02', description: 'Tea', amountCents: 300, type: 'expense', categoryId: 'dining', notes: '' }])
    expect((await repo.load()).transactions[0]).toEqual(t)
  })
})

/** A stand-in for the supabase-js query builder: records each query and answers from `respond`. */
function fakeClient(respond) {
  const queries = []
  return {
    queries,
    from(table) {
      const q = { table, op: 'select', filters: [] }
      const builder = {
        select: () => builder,
        order: () => builder,
        single: () => { q.single = true; return builder },
        insert: (payload) => { Object.assign(q, { op: 'insert', payload }); return builder },
        update: (payload) => { Object.assign(q, { op: 'update', payload }); return builder },
        upsert: (payload, options) => { Object.assign(q, { op: 'upsert', payload, options }); return builder },
        delete: () => { q.op = 'delete'; return builder },
        eq: (column, value) => { q.filters.push([column, value]); return builder },
        not: () => builder,
        then: (resolve, reject) => {
          queries.push(q)
          return Promise.resolve(respond(q)).then(resolve, reject)
        },
      }
      return builder
    },
  }
}

describe('supabase repository', () => {
  it('maps rows to the app model and back', () => {
    const row = { id: 'u1', date: '2026-09-01', description: 'Rent', amount_cents: 145_000, type: 'expense', category_id: 'c1', notes: null }
    const txn = mappers.toTxn(row)
    expect(txn).toEqual({ id: 'u1', date: '2026-09-01', description: 'Rent', amountCents: 145_000, type: 'expense', categoryId: 'c1', notes: '' })
    expect(mappers.fromTxn(txn)).toEqual({ ...row, notes: '' })
    expect(mappers.fromTxn({ ...txn, id: undefined })).not.toHaveProperty('id')
  })

  it('gives a new account the default categories, letting the database assign ids', async () => {
    const client = fakeClient((q) => {
      if (q.table === 'categories' && q.op === 'select') return { data: [], error: null }
      if (q.op === 'insert') return { data: q.payload.map((c, i) => ({ ...c, id: `uuid-${i}` })), error: null }
      return { data: [], error: null }
    })
    const db = await createSupabaseRepository(client).load()
    const insert = client.queries.find((q) => q.op === 'insert')
    expect(insert.payload).toHaveLength(DEFAULT_CATEGORIES.length)
    expect(insert.payload.every((c) => !('id' in c))).toBe(true)
    expect(db.categories[0]).toEqual({ id: 'uuid-0', name: 'Housing', type: 'expense', colorSlot: 0 })
  })

  it('upserts budgets per (user, category, month) and deletes on zero', async () => {
    const client = fakeClient((q) => ({ data: q.op === 'upsert' ? { id: 'b1', ...q.payload } : null, error: null }))
    const repo = createSupabaseRepository(client)
    expect(await repo.setBudget({ categoryId: 'c1', month: '2026-09', limitCents: 20_000 }))
      .toEqual({ id: 'b1', categoryId: 'c1', month: '2026-09', limitCents: 20_000 })
    expect(client.queries[0].options).toEqual({ onConflict: 'user_id,category_id,month' })
    expect(await repo.setBudget({ categoryId: 'c1', month: '2026-09', limitCents: 0 })).toBeNull()
    expect(client.queries[1]).toMatchObject({ op: 'delete', filters: [['category_id', 'c1'], ['month', '2026-09']] })
  })

  it('surfaces database errors', async () => {
    const client = fakeClient(() => ({ data: null, error: { message: 'new row violates row-level security policy' } }))
    await expect(createSupabaseRepository(client).deleteTransaction('x')).rejects.toThrow('row-level security')
  })
})
