import { useId, useState } from 'react'
import { todayISO } from '../lib/dates'
import { fromCents } from '../lib/money'
import { validateTransaction } from '../lib/validation'

function firstOfType(categories, type) {
  return categories.find((c) => c.type === type)?.id ?? ''
}

export default function TransactionForm({ initial, categories, onSubmit, onCancel, onDelete }) {
  const id = useId()
  const [form, setForm] = useState(() => ({
    type: initial?.type ?? 'expense',
    amount: initial ? fromCents(initial.amountCents) : '',
    date: initial?.date ?? todayISO(),
    description: initial?.description ?? '',
    categoryId: initial?.categoryId ?? firstOfType(categories, initial?.type ?? 'expense'),
    notes: initial?.notes ?? '',
  }))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const options = categories.filter((c) => c.type === form.type)
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const setType = (type) =>
    setForm((f) => ({
      ...f,
      type,
      categoryId: categories.some((c) => c.id === f.categoryId && c.type === type) ? f.categoryId : firstOfType(categories, type),
    }))

  async function submit(e) {
    e.preventDefault()
    const { errors: found, cents } = validateTransaction(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      await onSubmit({
        date: form.date,
        description: form.description.trim(),
        amountCents: cents,
        type: form.type,
        categoryId: form.categoryId,
        notes: form.notes.trim(),
      })
    } catch {
      // the data layer reports the failure; keep the form open with the user's input
    } finally {
      setSaving(false)
    }
  }

  const field = (name) => ({
    id: `${id}-${name}`,
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${id}-${name}-error` : undefined,
  })
  const error = (name) =>
    errors[name] && (
      <p id={`${id}-${name}-error`} className="mt-1 text-sm text-bad">
        {errors[name]}
      </p>
    )

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset>
        <legend className="label">Type</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-sunken p-1">
          {['expense', 'income'].map((type) => (
            <label key={type} className={`cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium capitalize ${
              form.type === type ? 'bg-surface text-ink shadow-sm' : 'text-ink2'}`}>
              <input type="radio" name="type" value={type} checked={form.type === type} onChange={() => setType(type)} className="sr-only" />
              {type}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${id}-amount`} className="label">Amount</label>
          <input {...field('amount')} className="field num" inputMode="decimal" placeholder="0.00" value={form.amount} onChange={set('amount')} />
          {error('amount')}
        </div>
        <div>
          <label htmlFor={`${id}-date`} className="label">Date</label>
          <input {...field('date')} type="date" className="field" value={form.date} onChange={set('date')} />
          {error('date')}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-description`} className="label">Description</label>
        <input {...field('description')} className="field" placeholder="e.g. Trader Joe's" maxLength={200} value={form.description}
          onChange={set('description')} />
        {error('description')}
      </div>

      <div>
        <label htmlFor={`${id}-categoryId`} className="label">Category</label>
        <select {...field('categoryId')} className="field" value={form.categoryId} onChange={set('categoryId')}>
          {options.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {error('categoryId')}
      </div>

      <div>
        <label htmlFor={`${id}-notes`} className="label">Notes <span className="font-normal text-muted">(optional)</span></label>
        <textarea id={`${id}-notes`} className="field" rows={2} value={form.notes} onChange={set('notes')} />
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        {onDelete ? (
          <button type="button" className="btn-ghost text-bad hover:text-bad" onClick={onDelete}>Delete</button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Add transaction'}</button>
        </div>
      </div>
    </form>
  )
}
