import { useId, useState } from 'react'
import { parseCSV, rowsToTransactions } from '../lib/csv'
import { formatDay } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { useData, usePrefs } from '../state/hooks'
import { Modal } from './ui'

export default function ImportCsvModal({ onClose, onImported }) {
  const id = useId()
  const { categories, actions } = useData()
  const { currency } = usePrefs()
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function readFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setResult({ name: file.name, ...rowsToTransactions(parseCSV(text), categories) })
  }

  async function confirm() {
    setBusy(true)
    try {
      await actions.addTransactions(result.transactions)
      onImported(`Imported ${result.transactions.length} transactions.`)
      onClose()
    } catch {
      // reported by the data layer; keep the preview open so the import can be retried
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Import transactions from CSV" onClose={onClose} wide>
      <div className="space-y-4">
        <p className="text-sm text-ink2">
          Needs <code className="rounded bg-sunken px-1">date</code>, <code className="rounded bg-sunken px-1">description</code> and{' '}
          <code className="rounded bg-sunken px-1">amount</code> columns. Without a <code className="rounded bg-sunken px-1">type</code> column,
          negative amounts are imported as expenses and positive amounts as income. Unknown categories go to “Other”.
        </p>
        <div>
          <label htmlFor={`${id}-file`} className="label">CSV file</label>
          <input id={`${id}-file`} type="file" accept=".csv,text/csv" onChange={readFile}
            className="block w-full text-sm text-ink2 file:mr-3 file:rounded-lg file:border-0 file:bg-sunken file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink" />
        </div>

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              <span className="font-medium">{result.transactions.length}</span> transactions ready
              {result.errors.length > 0 && <>, <span className="font-medium">{result.errors.length}</span> rows skipped</>}.
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-28 overflow-y-auto rounded-lg bg-sunken p-3 text-xs text-ink2">
                {result.errors.slice(0, 20).map((err) => (
                  <li key={`${err.line}-${err.message}`}>Line {err.line}: {err.message}</li>
                ))}
              </ul>
            )}
            {result.transactions.length > 0 && (
              <table className="w-full text-sm">
                <caption className="sr-only">First rows to import</caption>
                <tbody>
                  {result.transactions.slice(0, 5).map((t, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="py-1.5 text-ink2">{formatDay(t.date, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="py-1.5 text-ink">{t.description}</td>
                      <td className="num py-1.5 text-right text-ink">
                        {formatMoney(t.type === 'income' ? t.amountCents : -t.amountCents, currency, { signed: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={!result?.transactions.length || busy} onClick={confirm}>
            {busy ? 'Importing…' : `Import ${result?.transactions.length ?? ''} transactions`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
