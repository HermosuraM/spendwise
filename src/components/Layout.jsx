import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { addMonths, monthLabel, monthOf, todayISO } from '../lib/dates'
import { useData, usePrefs, useSession } from '../state/hooks'
import Icon from './Icon'
import TransactionModal from './TransactionModal'

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/transactions', label: 'Transactions', icon: 'list' },
  { to: '/budgets', label: 'Budgets', icon: 'target' },
  { to: '/insights', label: 'Insights', icon: 'bulb' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
]

function Logo({ compact = false }) {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight text-ink">
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <rect x="7" y="17" width="4" height="8" rx="1.5" fill="#fff" opacity=".75" />
        <rect x="14" y="12" width="4" height="13" rx="1.5" fill="#fff" opacity=".9" />
        <rect x="21" y="7" width="4" height="18" rx="1.5" fill="#fff" />
      </svg>
      {/* phones keep just the mark so the month picker and actions fit on one row */}
      <span className={compact ? 'hidden sm:inline' : undefined}>SpendWise</span>
    </span>
  )
}

function MonthPicker() {
  const { month, setMonth } = usePrefs()
  const current = monthOf(todayISO())
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Month">
      <button type="button" className="btn-ghost px-2" onClick={() => setMonth(addMonths(month, -1))}>
        <Icon name="chevronLeft" label="Previous month" />
      </button>
      <span className="min-w-[5.5rem] text-center text-sm font-medium text-ink sm:min-w-[8.5rem]" aria-live="polite">
        <span className="sm:hidden">{monthLabel(month, 'short')}</span>
        <span className="hidden sm:inline">{monthLabel(month)}</span>
      </span>
      <button type="button" className="btn-ghost px-2" onClick={() => setMonth(addMonths(month, 1))} disabled={month >= current}>
        <Icon name="chevronRight" label="Next month" />
      </button>
      {month !== current && (
        <button type="button" className="btn-ghost hidden px-2 text-xs sm:inline-flex" onClick={() => setMonth(current)}>This month</button>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { theme, setPref } = usePrefs()
  const next = { system: 'light', light: 'dark', dark: 'system' }[theme]
  const icon = { system: 'monitor', light: 'sun', dark: 'moon' }[theme]
  return (
    <button type="button" className="btn-ghost px-2" onClick={() => setPref('theme', next)} title={`Theme: ${theme}`}>
      <Icon name={icon} label={`Theme: ${theme}. Switch to ${next}`} />
    </button>
  )
}

function Toast({ message, onDone }) {
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(onDone, 3500)
    return () => clearTimeout(timer)
  }, [message, onDone])
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-6">
      {message && <p className="card pointer-events-auto px-4 py-2.5 text-sm text-ink shadow-lg">{message}</p>}
    </div>
  )
}

export default function Layout() {
  const { status, error, actionError, actions, backend, persistent } = useData()
  const session = useSession()
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState(null)
  const message = toast ?? actionError
  const clearToast = useCallback(() => {
    setToast(null)
    actions.clearError()
  }, [actions])

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[232px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-svh flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-3"><Logo /></div>
        <nav aria-label="Main" className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-accent/10 text-ink' : 'text-ink2 hover:bg-sunken hover:text-ink'}`}>
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-lg bg-sunken px-3 py-2.5 text-xs text-ink2">
          {backend === 'supabase' ? (
            <>
              <p className="font-medium text-ink">Synced with Supabase</p>
              <p className="truncate">{session?.email}</p>
              <button type="button" className="mt-1 inline-flex items-center gap-1 hover:text-ink" onClick={session?.signOut}>
                <Icon name="logout" className="h-3.5 w-3.5" /> Sign out
              </button>
            </>
          ) : (
            <>
              <p className="font-medium text-ink">Demo mode</p>
              <p>{persistent ? 'Data stays in this browser.' : 'Storage is blocked; changes last until you close the tab.'}</p>
            </>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-page/90 px-4 py-2.5 backdrop-blur lg:px-8">
          <span className="mr-1 lg:hidden"><Logo compact /></span>
          <MonthPicker />
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <button type="button" className="btn-primary" onClick={() => setAdding(true)} disabled={status !== 'ready'} aria-label="Add transaction">
              <Icon name="plus" className="h-4 w-4" />
              <span className="hidden sm:inline">Add transaction</span>
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 lg:px-8 lg:pb-10">
          {status === 'loading' && <p className="text-ink2" role="status">Loading your data…</p>}
          {status === 'error' && (
            <div className="card p-5">
              <p className="font-medium text-ink">Couldn’t load your data.</p>
              <p className="mt-1 text-sm text-ink2">{error?.message}</p>
            </div>
          )}
          {status === 'ready' && <Outlet context={{ notify: setToast }} />}
        </main>
      </div>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface lg:hidden">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-ink2'}`}>
            <Icon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {adding && <TransactionModal onClose={() => setAdding(false)} onSaved={setToast} />}
      <Toast message={message} onDone={clearToast} />
    </div>
  )
}
