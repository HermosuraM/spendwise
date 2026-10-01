import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { DataContext } from './contexts'

function reducer(state, action) {
  const db = state.db
  switch (action.type) {
    case 'loaded':
      return { status: 'ready', db: action.db, error: null, actionError: null }
    case 'failed':
      return { ...state, status: 'error', error: action.error }
    case 'actionFailed':
      return { ...state, actionError: action.error.message || 'Something went wrong.' }
    case 'clearActionError':
      return { ...state, actionError: null }
    case 'txAdded':
      return { ...state, db: { ...db, transactions: [...action.items, ...db.transactions] } }
    case 'txUpdated':
      return { ...state, db: { ...db, transactions: db.transactions.map((t) => (t.id === action.item.id ? action.item : t)) } }
    case 'txDeleted':
      return { ...state, db: { ...db, transactions: db.transactions.filter((t) => t.id !== action.id) } }
    case 'budgetSet': {
      const { categoryId, month } = action.key
      const others = db.budgets.filter((b) => !(b.categoryId === categoryId && b.month === month))
      return { ...state, db: { ...db, budgets: action.item ? [...others, action.item] : others } }
    }
    case 'categoryAdded':
      return { ...state, db: { ...db, categories: [...db.categories, action.item] } }
    default:
      return state
  }
}

export function DataProvider({ repository, children }) {
  const [state, dispatch] = useReducer(reducer, { status: 'loading', db: null, error: null, actionError: null })

  useEffect(() => {
    let alive = true
    repository
      .load()
      .then((db) => alive && dispatch({ type: 'loaded', db }))
      .catch((error) => alive && dispatch({ type: 'failed', error }))
    return () => {
      alive = false
    }
  }, [repository])

  // A failed save is reported (and re-thrown so forms stay open) without tearing down the app.
  const run = useCallback(async (fn) => {
    try {
      return await fn()
    } catch (error) {
      dispatch({ type: 'actionFailed', error })
      throw error
    }
  }, [])

  const actions = useMemo(
    () => ({
      addTransactions: (items) => run(async () => {
        const created = await repository.addTransactions(items)
        dispatch({ type: 'txAdded', items: created })
        return created
      }),
      updateTransaction: (id, patch) => run(async () => {
        const item = await repository.updateTransaction(id, patch)
        dispatch({ type: 'txUpdated', item })
        return item
      }),
      deleteTransaction: (id) => run(async () => {
        await repository.deleteTransaction(id)
        dispatch({ type: 'txDeleted', id })
      }),
      setBudget: (key) => run(async () => {
        const item = await repository.setBudget(key)
        dispatch({ type: 'budgetSet', key, item })
        return item
      }),
      addCategory: (category) => run(async () => {
        const item = await repository.addCategory(category)
        dispatch({ type: 'categoryAdded', item })
        return item
      }),
      reset: (opts) => run(async () => {
        const db = await repository.reset(opts)
        dispatch({ type: 'loaded', db })
      }),
      clearError: () => dispatch({ type: 'clearActionError' }),
    }),
    [repository, run],
  )

  const value = useMemo(
    () => ({ ...state, ...(state.db ?? { transactions: [], categories: [], budgets: [] }), actions, backend: repository.kind,
      persistent: repository.persistent }),
    [state, actions, repository],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
