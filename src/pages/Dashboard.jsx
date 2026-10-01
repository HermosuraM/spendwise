import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { CashflowChart, CategoryDonut } from '../components/charts'
import TransactionModal from '../components/TransactionModal'
import { Card, CategoryLabel, EmptyState, PageTitle, ProgressBar, StatCard, StatusBadge } from '../components/ui'
import { budgetRows, budgetStatus, monthlySeries, spendingByCategory, summarizeMonth } from '../lib/analytics'
import { addMonths, daysInMonth, formatDay, monthLabel, monthOf, shortMonth, todayISO } from '../lib/dates'
import { detectRecurring, projectMonthEnd } from '../lib/insights'
import { formatMoney, formatPercent } from '../lib/money'
import { useData, usePrefs } from '../state/hooks'

/** Change between two values: relative for money, percentage points for rates; null without a base to compare to. */
function change(now, before, { invert = false, points = false } = {}) {
  if (now == null || before == null || (!points && !before)) return null
  const diff = points ? (now - before) * 100 : (now - before) / before
  const sign = diff > 0 ? '+' : ''
  return {
    text: points ? `${sign}${diff.toFixed(1)} pts` : `${sign}${formatPercent(diff, Math.abs(diff) < 0.1 ? 1 : 0)}`,
    direction: Math.sign(diff),
    good: invert ? diff <= 0 : diff >= 0,
  }
}

function Breakdown({ rows }) {
  return (
    <dl className="space-y-1 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3">
          <dt className="text-ink2">{label}</dt>
          <dd className="num text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function Dashboard() {
  const { transactions, categories, budgets } = useData()
  const { month, currency } = usePrefs()
  const { notify } = useOutletContext()
  const [editing, setEditing] = useState(null)
  const today = todayISO()
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const view = useMemo(() => {
    const prevKey = addMonths(month, -1)
    // A month in progress is compared with the same days of the previous month, not the whole of it.
    const inProgress = month === monthOf(today)
    const throughDay = inProgress ? Math.min(Number(today.slice(8, 10)), daysInMonth(prevKey)) : 31
    const recurring = detectRecurring(transactions, today)
    const budgetsNow = budgetRows(transactions, budgets, categories, month).filter((r) => r.limitCents > 0)
    return {
      summary: summarizeMonth(transactions, month),
      previous: summarizeMonth(transactions, prevKey, { throughDay }),
      period: inProgress ? `${shortMonth(prevKey)} 1${throughDay > 1 ? `–${throughDay}` : ''}` : shortMonth(prevKey),
      spending: spendingByCategory(transactions, month, categories),
      series: monthlySeries(transactions, month, 6),
      projection: projectMonthEnd(transactions, month, today, recurring),
      budgetsNow: [...budgetsNow].sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)),
      budgetTotal: budgetsNow.reduce((s, r) => s + r.limitCents, 0),
      recent: transactions.filter((t) => t.date.startsWith(month)).slice(0, 6),
    }
  }, [transactions, categories, budgets, month, today])

  const { summary, previous, period, projection } = view
  const income = change(summary.incomeCents, previous.incomeCents)
  const spend = change(summary.expenseCents, previous.expenseCents, { invert: true })
  const rate = change(summary.savingsRate, previous.savingsRate, { points: true })
  const projected = projection ? (projection.complete ? projection.spentSoFar : projection.projectedCents) : 0
  const projectedStatus = budgetStatus(projected, view.budgetTotal)
  const money = (cents) => formatMoney(cents, currency)

  return (
    <div className="space-y-6">
      <PageTitle title="Dashboard" subtitle={monthLabel(month)} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Income" value={money(summary.incomeCents)} change={income}
          hint={income ? `vs ${period}` : `${period}: ${money(previous.incomeCents)}`} />
        <StatCard label="Spending" value={money(summary.expenseCents)} change={spend}
          hint={spend ? `vs ${period}` : `${period}: ${money(previous.expenseCents)}`} />
        <StatCard label="Net cash flow" value={formatMoney(summary.netCents, currency, { signed: true })}
          hint={`${summary.count} transaction${summary.count === 1 ? '' : 's'}`} />
        <StatCard label="Savings rate" value={formatPercent(summary.savingsRate)} change={rate}
          hint={rate ? `vs ${period}` : summary.savingsRate == null ? 'No income yet' : `${period}: no income`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Spending by category" className="lg:col-span-3">
          {view.spending.totalCents ? (
            <CategoryDonut rows={view.spending.rows} totalCents={view.spending.totalCents} currency={currency} />
          ) : (
            <EmptyState icon="wallet" title="No spending this month">Add a transaction to see where your money goes.</EmptyState>
          )}
        </Card>

        <Card title="Month-end outlook" className="lg:col-span-2">
          {projection && view.budgetTotal > 0 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-ink2">{projection.complete ? 'Spent this month' : `Projected by ${shortMonth(month)} ${projection.days}`}</p>
                <p className="num text-2xl font-semibold text-ink">
                  {money(projected)}
                  <span className="ml-1 text-sm font-normal text-ink2">of {money(view.budgetTotal)} budgeted</span>
                </p>
                <ProgressBar ratio={projected / view.budgetTotal} status={projectedStatus} label="Projected spending against total budget" />
                <StatusBadge status={projectedStatus} />
                {!projection.complete && (
                  <>
                    <Breakdown rows={[
                      [`Spent through ${formatDay(today)}`, money(projection.spentSoFar)],
                      ['Recurring charges still expected', money(projection.recurringRemaining)],
                      ['Everyday spending, estimated', money(projection.everydayRemaining)],
                    ]} />
                    <p className="text-xs text-muted">
                      {projection.baselineMonths
                        ? `Everyday spending follows this month's pace, blended with your last ${projection.baselineMonths === 1 ? 'month' : `${projection.baselineMonths} months`} while the month is young.`
                        : "Everyday spending follows this month's pace so far."}
                    </p>
                  </>
                )}
              </div>
              <ul className="space-y-3 border-t border-line pt-3">
                {view.budgetsNow.slice(0, 4).map((r) => (
                  <li key={r.category.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <CategoryLabel category={r.category} />
                      <span className="num text-ink2">{money(r.spentCents)} / {money(r.limitCents)}</span>
                    </div>
                    <ProgressBar ratio={r.ratio} status={r.status} label={`${r.category.name} budget used`} />
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={r.status} />
                      <span className="num text-xs text-ink2">
                        {r.remainingCents >= 0 ? `${money(r.remainingCents)} left` : `${money(-r.remainingCents)} over`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <Link to="/budgets" className="text-sm font-medium text-accent hover:underline">Manage budgets</Link>
            </div>
          ) : (
            <EmptyState icon="target" title="No budgets yet">
              <Link to="/budgets" className="font-medium text-accent hover:underline">Set monthly budgets</Link> to see a month-end projection.
            </EmptyState>
          )}
        </Card>
      </div>

      <Card title="Cash flow, last 6 months">
        <CashflowChart series={view.series} currency={currency} />
      </Card>

      <Card title="Recent transactions" action={<Link to="/transactions" className="text-sm font-medium text-accent hover:underline">View all</Link>}>
        {view.recent.length ? (
          <ul className="divide-y divide-line">
            {view.recent.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setEditing(t)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-sunken/60">
                  <span className="w-14 shrink-0 text-xs text-ink2">{formatDay(t.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{t.description}</span>
                    <span className="text-xs"><CategoryLabel category={byId.get(t.categoryId)} /></span>
                  </span>
                  <span className="num text-sm font-medium text-ink">
                    {formatMoney(t.type === 'income' ? t.amountCents : -t.amountCents, currency, { signed: true })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing recorded this month" />
        )}
      </Card>

      {editing && <TransactionModal transaction={editing} onClose={() => setEditing(null)} onSaved={notify} />}
    </div>
  )
}
