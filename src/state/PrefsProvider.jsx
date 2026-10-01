import { useEffect, useMemo, useState } from 'react'
import { monthOf, todayISO } from '../lib/dates'
import { PrefsContext } from './contexts'

const KEY = 'spendwise:prefs'
const DEFAULTS = { currency: 'USD', theme: 'system' }

function loadPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs)
  const [month, setMonth] = useState(() => monthOf(todayISO()))

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* storage unavailable: preferences last for this visit only */
    }
  }, [prefs])

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && media?.matches)
      document.documentElement.classList.toggle('dark', Boolean(dark))
    }
    apply()
    media?.addEventListener?.('change', apply)
    return () => media?.removeEventListener?.('change', apply)
  }, [prefs.theme])

  const value = useMemo(
    () => ({ ...prefs, month, setMonth, setPref: (k, v) => setPrefs((p) => ({ ...p, [k]: v })) }),
    [prefs, month],
  )
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}
