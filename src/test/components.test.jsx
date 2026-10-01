import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import TransactionForm from '../components/TransactionForm'
import { DEFAULT_CATEGORIES } from '../data/categories'

// Tests always run against the local (browser storage) backend, even if a developer has Supabase configured.
vi.mock('../data/backend', () => ({ isSupabaseConfigured: false, getSupabaseClient: async () => null, supabaseConfig: {} }))

describe('TransactionForm', () => {
  const setup = (onSubmit = vi.fn()) => {
    render(<TransactionForm categories={DEFAULT_CATEGORIES} onSubmit={onSubmit} onCancel={() => {}} />)
    return { user: userEvent.setup(), onSubmit }
  }

  it('flags invalid fields and does not submit', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Amount')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription('Enter an amount greater than 0.')
    expect(screen.getByLabelText('Description')).toHaveAccessibleDescription('Add a short description.')
  })

  it('submits cents and trimmed text, with income categories after switching type', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('radio', { name: 'income' }))
    expect(screen.getByLabelText('Category')).toHaveValue('salary')
    expect(within(screen.getByLabelText('Category')).queryByRole('option', { name: 'Groceries' })).toBeNull()
    await user.type(screen.getByLabelText('Amount'), '2,150.00')
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-05' } })
    await user.type(screen.getByLabelText('Description'), '  Paycheck  ')
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    expect(onSubmit).toHaveBeenCalledWith({
      date: '2026-09-05', description: 'Paycheck', amountCents: 215_000, type: 'income', categoryId: 'salary', notes: '',
    })
  })

  it('stays open and usable when saving fails', async () => {
    const { user, onSubmit } = setup(vi.fn().mockRejectedValue(new Error('offline')))
    await user.type(screen.getByLabelText('Amount'), '4.50')
    await user.type(screen.getByLabelText('Description'), 'Tea')
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeEnabled()
    expect(screen.getByLabelText('Description')).toHaveValue('Tea')
  })
})

describe('App (local demo mode)', () => {
  const nav = (user, name) => user.click(screen.getAllByRole('link', { name })[0])

  it('loads sample data and renders every page', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Demo mode')
    await nav(user, 'Dashboard')
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Month-end outlook' })).toBeInTheDocument()

    await nav(user, 'Insights')
    expect(await screen.findByRole('heading', { level: 1, name: 'Insights' })).toBeInTheDocument()
    expect(screen.getByText('SUNSET APARTMENTS RENT')).toBeInTheDocument()
    expect(screen.getByText('BEST BUY 00431')).toBeInTheDocument()

    await nav(user, 'Budgets')
    expect(await screen.findByRole('heading', { level: 1, name: 'Budgets' })).toBeInTheDocument()
    expect(screen.getByLabelText('Monthly budget for Housing (USD)')).toHaveValue('1450.00')

    await nav(user, 'Settings')
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })

  it('adds a transaction from the header and lists it', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Demo mode')
    await user.click(screen.getByRole('button', { name: 'Add transaction' }))
    const dialog = screen.getByRole('dialog', { name: 'Add transaction' })
    await user.type(within(dialog).getByLabelText('Amount'), '12.34')
    await user.type(within(dialog).getByLabelText('Description'), 'Test coffee')
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }))
    expect(await screen.findByText('Transaction added.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()

    await nav(user, 'Transactions')
    expect(await screen.findByText('Test coffee')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('spendwise:data')).transactions[0].description).toBe('Test coffee')
  })
})
