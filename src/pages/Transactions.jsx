import { useId, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Icon from '../components/Icon'
import ImportCsvModal from '../components/ImportCsvModal'
import TransactionModal from '../components/TransactionModal'
import { Card, CategoryLabel, EmptyState, PageTitle } from '../components/ui'
import { transactionsToCSV } from '../lib/csv'
import { formatDay, monthLabel, todayISO } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { useData, usePrefs } from '../state/hooks'

const PAGE = 100

function download(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function SortHeader({ label, field, sort, setSort, className = '' }) {
  const active = sort.field === field
  const next = active && sort.dir === 'desc' ? 'asc' : 'desc'
  return (
    <th scope="col" className={`py-2 font-medium ${className}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort({ field, dir: next })}>
        {label}
        <span aria-hidden="true" className="text-[10px]">{active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  )
}

export default function Transactions() {
  const id = useId()
  const { notify } = useOutletContext()
  const { transactions, categories } = useData()
  const { month, currency } = usePrefs()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [scope, setScope] = useState('month')
  const [sort, setSort] = useState({ field: 'date', dir: 'desc' })
  const [limit, setLimit] = useState(PAGE)
  const [editing, setEditing] = useState(null)
  const [importing, setImporting] = useState(false)
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = transactions.filter(
      (t) =>
        (scope === 'all' || t.date.startsWith(month)) &&
        (type === 'all' || t.type === type) &&
        (categoryId === 'all' || t.categoryId === categoryId) &&
        (!q || t.description.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q)),
    )
    const dir = sort.dir === 'asc' ? 1 : -1
    return rows.sort((a, b) =>
      sort.field === 'amount' ? dir * (a.amountCents - b.amountCents) : dir * a.date.localeCompare(b.date) || dir * a.id.localeCompare(b.id))
  }, [transactions, query, type, categoryId, scope, month, sort])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of filtered) {
      if (t.type === 'income') income += t.amountCents
      else expense += t.amountCents
    }
    return { income, expense }
  }, [filtered])

  const resetLimit = (setter) => (e) => {
    setter(e.target.value)
    setLimit(PAGE)
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Transactions" subtitle={scope === 'month' ? monthLabel(month) : 'All time'}>
        <button type="button" className="btn-outline" onClick={() => setImporting(true)}>
          <Icon name="upload" className="h-4 w-4" /> Import CSV
        </button>
        <button type="button" className="btn-outline" disabled={!filtered.length}
          onClick={() => download(`spendwise-transactions-${todayISO()}.csv`, transactionsToCSV(filtered, categories))}>
          <Icon name="download" className="h-4 w-4" /> Export CSV
        </button>
      </PageTitle>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <label htmlFor={`${id}-q`} className="sr-only">Search transactions</label>
            <Icon name="search" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
            <input id={`${id}-q`} className="field pl-9" placeholder="Search descriptions and notes" value={query} onChange={resetLimit(setQuery)} />
          </div>
          <div>
            <label htmlFor={`${id}-type`} className="sr-only">Type</label>
            <select id={`${id}-type`} className="field" value={type} onChange={resetLimit(setType)}>
              <option value="all">All types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-cat`} className="sr-only">Category</label>
            <select id={`${id}-cat`} className="field" value={categoryId} onChange={resetLimit(setCategoryId)}>
              <option value="all">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-scope`} className="sr-only">Period</label>
            <select id={`${id}-scope`} className="field" value={scope} onChange={resetLimit(setScope)}>
              <option value="month">{monthLabel(month)}</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>

        <p className="mt-4 text-sm text-ink2">
          <span className="num font-medium text-ink">{filtered.length}</span> transactions ·{' '}
          income <span className="num font-medium text-ink">{formatMoney(totals.income, currency)}</span> ·{' '}
          spending <span className="num font-medium text-ink">{formatMoney(totals.expense, currency)}</span>
        </p>

        {filtered.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Transactions</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink2">
                  <SortHeader label="Date" field="date" sort={sort} setSort={setSort} className="w-24" />
                  <th scope="col" className="py-2 font-medium">Description</th>
                  <th scope="col" className="hidden py-2 font-medium md:table-cell">Category</th>
                  <SortHeader label="Amount" field="amount" sort={sort} setSort={setSort} className="text-right" />
                  <th scope="col" className="w-10 py-2"><span className="sr-only">Edit</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, limit).map((t) => (
                  <tr key={t.id} className="border-b border-line last:border-0 hover:bg-sunken/60">
                    <td className="py-2.5 text-ink2">{formatDay(t.date, scope === 'all' ? { month: 'short', day: 'numeric', year: '2-digit' } : undefined)}</td>
                    <td className="py-2.5">
                      <span className="block font-medium text-ink">{t.description}</span>
                      <span className="text-xs md:hidden"><CategoryLabel category={byId.get(t.categoryId)} /></span>
                      {t.notes && <span className="block text-xs text-ink2">{t.notes}</span>}
                    </td>
                    <td className="hidden py-2.5 md:table-cell"><CategoryLabel category={byId.get(t.categoryId)} /></td>
                    <td className="num py-2.5 text-right font-medium text-ink">
                      {formatMoney(t.type === 'income' ? t.amountCents : -t.amountCents, currency, { signed: true })}
                    </td>
                    <td className="py-2.5 text-right">
                      <button type="button" className="btn-ghost px-2" onClick={() => setEditing(t)}>
                        <Icon name="pencil" className="h-4 w-4" label={`Edit ${t.description}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > limit && (
              <div className="mt-3 text-center">
                <button type="button" className="btn-outline" onClick={() => setLimit((n) => n + PAGE)}>
                  Show {Math.min(PAGE, filtered.length - limit)} more
                </button>
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon="search" title="No transactions match">Try a different search, category, or period.</EmptyState>
        )}
      </Card>

      {editing && <TransactionModal transaction={editing} onClose={() => setEditing(null)} onSaved={notify} />}
      {importing && <ImportCsvModal onClose={() => setImporting(false)} onImported={notify} />}
    </div>
  )
}
