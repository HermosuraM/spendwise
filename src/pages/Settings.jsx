import { useId, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Card, Modal, PageTitle } from '../components/ui'
import { todayISO } from '../lib/dates'
import { CURRENCIES } from '../lib/money'
import { useData, usePrefs, useSession } from '../state/hooks'

function Confirm({ title, children, action, danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      setBusy(false) // reported by the data layer; keep the dialog open
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-ink2">{children}</div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={confirm} disabled={busy}>
            {action}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function Settings() {
  const id = useId()
  const { notify } = useOutletContext()
  const { transactions, categories, budgets, backend, persistent, actions } = useData()
  const { currency, theme, setPref } = usePrefs()
  const session = useSession()
  const [confirm, setConfirm] = useState(null)

  function exportBackup() {
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), categories, transactions, budgets }, null, 2)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `spendwise-backup-${todayISO()}.json` })
    document.body.append(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Settings" />

      <Card title="Preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-currency`} className="label">Currency</label>
            <select id={`${id}-currency`} className="field" value={currency} onChange={(e) => setPref('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <fieldset>
            <legend className="label">Theme</legend>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-sunken p-1">
              {['system', 'light', 'dark'].map((t) => (
                <label key={t} className={`cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium capitalize ${
                  theme === t ? 'bg-surface text-ink shadow-sm' : 'text-ink2'}`}>
                  <input type="radio" name="theme" value={t} checked={theme === t} onChange={() => setPref('theme', t)} className="sr-only" />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      <Card title="Your data">
        <p className="text-sm text-ink2">
          {backend === 'supabase'
            ? `Stored in your Supabase project and visible only to ${session?.email ?? 'your account'} (row-level security).`
            : persistent
              ? 'Demo mode: everything is stored in this browser’s local storage. Nothing is sent to a server.'
              : 'Demo mode, but this browser blocks storage: changes last until you close the tab.'}
        </p>
        <p className="num mt-2 text-sm text-ink2">
          {transactions.length} transactions · {budgets.length} budgets · {categories.length} categories
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-outline" onClick={exportBackup}>Download backup (JSON)</button>
          {backend === 'local' && (
            <button type="button" className="btn-outline" onClick={() => setConfirm('sample')}>Reset to sample data</button>
          )}
          <button type="button" className="btn-outline text-bad" onClick={() => setConfirm('empty')}>Delete transactions and budgets</button>
          {backend === 'supabase' && <button type="button" className="btn-outline" onClick={session?.signOut}>Sign out</button>}
        </div>
      </Card>

      {backend === 'local' && (
        <Card title="Sync across devices (optional)">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink2">
            <li>Create a free project at supabase.com and run <code className="rounded bg-sunken px-1">supabase/schema.sql</code> in its SQL editor.</li>
            <li>Copy <code className="rounded bg-sunken px-1">.env.example</code> to <code className="rounded bg-sunken px-1">.env.local</code> and fill in the project URL and anon key.</li>
            <li>Restart the dev server: SpendWise switches to email sign-in with cloud storage.</li>
          </ol>
        </Card>
      )}

      {confirm === 'sample' && (
        <Confirm title="Reset to sample data?" action="Reset" onClose={() => setConfirm(null)}
          onConfirm={async () => { await actions.reset({ withSample: true }); notify('Sample data restored.') }}>
          This replaces everything stored in this browser with twelve months of sample transactions and budgets.
        </Confirm>
      )}
      {confirm === 'empty' && (
        <Confirm title="Delete transactions and budgets?" action="Delete" danger onClose={() => setConfirm(null)}
          onConfirm={async () => { await actions.reset({ withSample: false }); notify('Transactions and budgets deleted.') }}>
          Every transaction and budget will be removed{backend === 'supabase' ? ' from your Supabase project' : ' from this browser'};
          your categories stay. Download a backup first if you might want them back.
        </Confirm>
      )}
    </div>
  )
}
