import { useEffect, useRef } from 'react'
import { slotColor } from '../lib/palette'
import Icon from './Icon'

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink2">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

export function Card({ title, action, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** Category identity is a colored dot *beside* text; text itself stays in ink colors. */
export function CategoryDot({ slot, className = '' }) {
  return (
    <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}>
      <span className="block h-full w-full rounded-full dark:hidden" style={{ background: slotColor(slot, 'light') }} />
      <span className="hidden h-full w-full rounded-full dark:block" style={{ background: slotColor(slot, 'dark') }} />
    </span>
  )
}

export function CategoryLabel({ category }) {
  return (
    <span className="inline-flex items-center gap-2 text-ink2">
      <CategoryDot slot={category?.colorSlot ?? null} />
      {category?.name ?? 'Uncategorized'}
    </span>
  )
}

const STATUS = {
  ok: { icon: 'checkCircle', label: 'On track', bar: 'bg-good', text: 'text-ink2' },
  warning: { icon: 'alertCircle', label: 'Near limit', bar: 'bg-warn', text: 'text-ink' },
  over: { icon: 'alert', label: 'Over budget', bar: 'bg-bad', text: 'text-ink' },
  none: { icon: 'target', label: 'No budget', bar: 'bg-muted', text: 'text-ink2' },
}

/** Budget state is never color alone: icon + label + the bar. */
export function StatusBadge({ status }) {
  const s = STATUS[status] ?? STATUS.none
  const color = { ok: 'text-good', warning: 'text-warn', over: 'text-bad', none: 'text-muted' }[status] ?? 'text-muted'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <Icon name={s.icon} className={`h-4 w-4 ${color}`} />
      {s.label}
    </span>
  )
}

export function ProgressBar({ ratio, status, label }) {
  const s = STATUS[status] ?? STATUS.none
  const pct = Math.max(0, Math.min(1, ratio ?? 0)) * 100
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-sunken"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((ratio ?? 0) * 100)}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function EmptyState({ icon = 'list', title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-sunken text-ink2">
        <Icon name={icon} />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink2">{children}</div>}
    </div>
  )
}

/** Accessible modal: labelled dialog, Escape and backdrop close, focus moves in and is restored on close. */
export function Modal({ title, onClose, children, wide = false }) {
  const panel = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    panel.current?.querySelector('input, select, textarea, button')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`card max-h-[92svh] w-full overflow-y-auto rounded-b-none p-5 shadow-xl sm:rounded-xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold text-ink">{title}</h2>
          <button type="button" className="btn-ghost -mr-2 px-2" onClick={onClose}>
            <Icon name="x" label="Close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * A headline number. `change` is { text, direction: -1 | 0 | 1, good }: the arrow shows which way the value
 * moved and its color whether that is good for this metric (spending down is good), spelled out for screen readers.
 */
export function StatCard({ label, value, change, hint }) {
  const icon = change && (change.direction > 0 ? 'trendUp' : change.direction < 0 ? 'trendDown' : 'minus')
  const tone = change && (change.direction === 0 ? 'text-muted' : change.good ? 'text-good' : 'text-bad')
  return (
    <div className="card p-4">
      <p className="text-sm text-ink2">{label}</p>
      <p className="num mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {(change || hint) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink2">
          {change && (
            <span className="inline-flex items-center gap-1 font-medium text-ink">
              <Icon name={icon} className={`h-3.5 w-3.5 ${tone}`} />
              {change.text}
              {change.direction !== 0 && <span className="sr-only">({change.good ? 'better' : 'worse'})</span>}
            </span>
          )}
          {hint}
        </p>
      )}
    </div>
  )
}
