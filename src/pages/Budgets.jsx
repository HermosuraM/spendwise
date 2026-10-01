import { useId, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Icon from '../components/Icon'
import { Card, CategoryDot, CategoryLabel, Modal, PageTitle, ProgressBar, StatusBadge } from '../components/ui'
import { budgetRows, budgetStatus } from '../lib/analytics'
import { monthLabel } from '../lib/dates'
import { formatMoney, fromCents, toCents } from '../lib/money'
import { useData, usePrefs } from '../state/hooks'

function BudgetEditor({ row, month, currency, onSave }) {
  const id = useId()
  const [value, setValue] = useState(row.limitCents ? fromCents(row.limitCents) : '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    const cents = value.trim() === '' ? 0 : toCents(value)
    if (!Number.isFinite(cents) || cents < 0) return setError('Enter a positive amount, or leave empty to remove.')
    setError('')
    setSaving(true)
    try {
      await onSave({ categoryId: row.category.id, month, limitCents: cents })
    } catch {
      // reported by the data layer
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex items-start gap-2">
      <div>
        <label htmlFor={`${id}-limit`} className="sr-only">Monthly budget for {row.category.name} ({currency})</label>
        <input id={`${id}-limit`} className="field num w-28" inputMode="decimal" placeholder="No limit" value={value}
          onChange={(e) => setValue(e.target.value)} aria-invalid={error ? true : undefined} />
        {error && <p className="mt-1 max-w-[12rem] text-xs text-bad">{error}</p>}
      </div>
      <button type="submit" className="btn-outline px-2.5" disabled={saving}>
        <Icon name="check" className="h-4 w-4" label={`Save ${row.category.name} budget`} />
      </button>
    </form>
  )
}

function NewCategoryModal({ categories, onClose, onCreate }) {
  const id = useId()
  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [slot, setSlot] = useState('none')
  const [error, setError] = useState('')
  const taken = new Set(categories.map((c) => c.name.toLowerCase()))

  async function submit(e) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Name the category.')
    if (taken.has(clean.toLowerCase())) return setError('That category already exists.')
    try {
      await onCreate({ name: clean, type, colorSlot: slot === 'none' ? null : Number(slot) })
      onClose()
    } catch {
      // reported by the data layer; keep the dialog open
    }
  }

  return (
    <Modal title="New category" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label htmlFor={`${id}-name`} className="label">Name</label>
          <input id={`${id}-name`} className="field" maxLength={40} value={name} onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} />
          {error && <p id={`${id}-err`} className="mt-1 text-sm text-bad">{error}</p>}
        </div>
        <div>
          <label htmlFor={`${id}-type`} className="label">Type</label>
          <select id={`${id}-type`} className="field" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <fieldset>
          <legend className="label">Chart color</legend>
          <p className="mb-2 text-xs text-ink2">Colors come from a fixed colorblind-safe set; “Neutral” groups the category into “Other” in charts.</p>
          <div className="flex flex-wrap gap-2">
            {['none', 0, 1, 2, 3, 4, 5, 6, 7].map((s) => (
              <label key={s} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                String(slot) === String(s) ? 'border-accent text-ink' : 'border-line text-ink2'}`}>
                <input type="radio" name="slot" className="sr-only" checked={String(slot) === String(s)} onChange={() => setSlot(String(s))} />
                <CategoryDot slot={s === 'none' ? null : s} />
                {s === 'none' ? 'Neutral' : `Color ${s + 1}`}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Create</button>
        </div>
      </form>
    </Modal>
  )
}

export default function Budgets() {
  const { notify } = useOutletContext()
  const { transactions, budgets, categories, actions } = useData()
  const { month, currency } = usePrefs()
  const [creating, setCreating] = useState(false)
  const rows = useMemo(() => budgetRows(transactions, budgets, categories, month), [transactions, budgets, categories, month])
  const budgeted = rows.filter((r) => r.limitCents > 0)
  const totalLimit = budgeted.reduce((s, r) => s + r.limitCents, 0)
  const totalSpent = budgeted.reduce((s, r) => s + r.spentCents, 0)
  const unbudgetedSpend = rows.filter((r) => !r.limitCents).reduce((s, r) => s + r.spentCents, 0)
  const overall = budgetStatus(totalSpent, totalLimit)

  async function save(key) {
    await actions.setBudget(key)
    notify(key.limitCents ? 'Budget saved.' : 'Budget removed.')
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Budgets" subtitle={`${monthLabel(month)} · budgets carry forward to later months until you change them`}>
        <button type="button" className="btn-outline" onClick={() => setCreating(true)}>
          <Icon name="plus" className="h-4 w-4" /> New category
        </button>
      </PageTitle>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-ink2">Spent against budgeted categories</p>
            <p className="num text-2xl font-semibold text-ink">
              {formatMoney(totalSpent, currency)} <span className="text-base font-normal text-ink2">of {formatMoney(totalLimit, currency)}</span>
            </p>
          </div>
          <StatusBadge status={overall} />
        </div>
        <div className="mt-3">
          <ProgressBar ratio={totalLimit ? totalSpent / totalLimit : 0} status={overall} label="Total budget used" />
        </div>
        {unbudgetedSpend > 0 && (
          <p className="mt-3 text-sm text-ink2">Plus {formatMoney(unbudgetedSpend, currency)} in categories without a budget.</p>
        )}
      </Card>

      <Card title="By category">
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.category.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium"><CategoryLabel category={r.category} /></span>
                  <StatusBadge status={r.status} />
                </div>
                <ProgressBar ratio={r.ratio} status={r.status} label={`${r.category.name} budget used`} />
                <p className="num text-xs text-ink2">
                  {formatMoney(r.spentCents, currency)} spent
                  {r.limitCents > 0 && (
                    <> of {formatMoney(r.limitCents, currency)} · {r.remainingCents >= 0
                      ? `${formatMoney(r.remainingCents, currency)} left`
                      : `${formatMoney(-r.remainingCents, currency)} over`}</>
                  )}
                  {r.inherited && <> · carried over from {monthLabel(r.budget.month, 'short')}</>}
                </p>
              </div>
              <BudgetEditor key={`${r.category.id}-${month}-${r.limitCents}`} row={r} month={month} currency={currency} onSave={save} />
            </li>
          ))}
        </ul>
      </Card>

      {creating && (
        <NewCategoryModal categories={categories} onClose={() => setCreating(false)}
          onCreate={async (c) => { await actions.addCategory(c); notify(`Category “${c.name}” added.`) }} />
      )}
    </div>
  )
}
