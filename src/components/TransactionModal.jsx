import { useState } from 'react'
import { useData } from '../state/hooks'
import TransactionForm from './TransactionForm'
import { Modal } from './ui'

/** Add (no `transaction`) or edit/delete an existing transaction. */
export default function TransactionModal({ transaction, onClose, onSaved }) {
  const { categories, actions } = useData()
  const [confirming, setConfirming] = useState(false)

  async function save(values) {
    if (transaction) await actions.updateTransaction(transaction.id, values)
    else await actions.addTransactions([values])
    onSaved?.(transaction ? 'Transaction updated.' : 'Transaction added.')
    onClose()
  }

  async function remove() {
    try {
      await actions.deleteTransaction(transaction.id)
    } catch {
      return // reported by the data layer; keep the dialog open
    }
    onSaved?.('Transaction deleted.')
    onClose()
  }

  return (
    <Modal title={transaction ? 'Edit transaction' : 'Add transaction'} onClose={onClose}>
      {confirming ? (
        <div className="space-y-4">
          <p className="text-ink2">Delete “{transaction.description}”? This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setConfirming(false)}>Keep it</button>
            <button type="button" className="btn-danger" onClick={remove}>Delete</button>
          </div>
        </div>
      ) : (
        <TransactionForm
          initial={transaction}
          categories={categories}
          onSubmit={save}
          onCancel={onClose}
          onDelete={transaction ? () => setConfirming(true) : undefined}
        />
      )}
    </Modal>
  )
}
