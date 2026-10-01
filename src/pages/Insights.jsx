import { useMemo } from 'react'
import Icon from '../components/Icon'
import { Card, CategoryLabel, EmptyState, PageTitle } from '../components/ui'
import { addMonths, daysBetween, formatDay, monthLabel, monthOf, shortMonth, todayISO } from '../lib/dates'
import { categoryChanges, detectAnomalies, detectRecurring } from '../lib/insights'
import { formatMoney, formatPercent } from '../lib/money'
import { useData, usePrefs } from '../state/hooks'

function dueText(nextDate, today) {
  const days = daysBetween(today, nextDate)
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  return days === 1 ? 'Tomorrow' : `In ${days} days`
}

export default function Insights() {
  const { transactions, categories } = useData()
  const { month, currency } = usePrefs()
  const today = todayISO()
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // A month in progress is compared on the same days of the baseline months (Oct 1–12 vs. Jul–Sep 1–12).
  const throughDay = month === monthOf(today) ? Number(today.slice(8, 10)) : 31

  const { recurring, anomalies, changes } = useMemo(() => {
    const found = detectRecurring(transactions, today)
    return {
      recurring: found,
      anomalies: detectAnomalies(transactions, today, found),
      changes: categoryChanges(transactions, month, categories, { throughDay }).slice(0, 6),
    }
  }, [transactions, categories, month, today, throughDay])

  const active = recurring.filter((r) => r.active)
  const lapsed = recurring.filter((r) => !r.active)
  const monthlyTotal = active.reduce((s, r) => s + r.monthlyCents, 0)
  const baseline = `${shortMonth(addMonths(month, -3))}–${shortMonth(addMonths(month, -1))}`
  const comparison = throughDay < 31
    ? `${shortMonth(month)} 1${throughDay > 1 ? `–${throughDay}` : ''} against the average of the same ${throughDay > 1 ? 'days' : 'day'} in ${baseline}.`
    : `${monthLabel(month)} against the average of ${baseline}.`

  return (
    <div className="space-y-6">
      <PageTitle title="Insights" subtitle="Patterns found in your transactions, computed in your browser" />

      <Card title="Recurring charges" action={active.length > 0 && (
        <span className="num text-sm text-ink2">
          <span className="font-medium text-ink">{formatMoney(monthlyTotal, currency)}</span>/month ·{' '}
          <span className="font-medium text-ink">{formatMoney(monthlyTotal * 12, currency)}</span>/year
        </span>
      )}>
        {active.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Active recurring charges</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink2">
                  <th scope="col" className="py-2 font-medium">Merchant</th>
                  <th scope="col" className="hidden py-2 font-medium sm:table-cell">Cadence</th>
                  <th scope="col" className="py-2 text-right font-medium">Typical</th>
                  <th scope="col" className="hidden py-2 text-right font-medium md:table-cell">Per year</th>
                  <th scope="col" className="py-2 text-right font-medium">Next charge</th>
                </tr>
              </thead>
              <tbody>
                {active.map((r) => (
                  <tr key={r.key} className="border-b border-line last:border-0">
                    <td className="py-2.5">
                      <span className="block font-medium text-ink">{r.name}</span>
                      <span className="text-xs"><CategoryLabel category={byId.get(r.categoryId)} /></span>
                    </td>
                    <td className="hidden py-2.5 text-ink2 sm:table-cell">{r.cadence} · {r.count} charges</td>
                    <td className="num py-2.5 text-right text-ink">{formatMoney(r.avgCents, currency)}</td>
                    <td className="num hidden py-2.5 text-right text-ink md:table-cell">{formatMoney(r.annualCents, currency)}</td>
                    <td className="py-2.5 text-right text-ink2">
                      <span className="block text-ink">{formatDay(r.nextDate)}</span>
                      <span className="text-xs">{dueText(r.nextDate, today)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lapsed.length > 0 && (
              <p className="mt-3 text-xs text-ink2">
                Possibly cancelled (no charge for two cycles): {lapsed.map((r) => r.name).join(', ')}.
              </p>
            )}
          </div>
        ) : (
          <EmptyState icon="repeat" title="No recurring charges yet">
            Charges from the same merchant at a regular cadence and a steady amount (3+ times) show up here.
          </EmptyState>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Unusual transactions (last 90 days)">
          {anomalies.length ? (
            <ul className="divide-y divide-line">
              {anomalies.map(({ transaction: t, ratio, typicalCents }) => (
                <li key={t.id} className="flex gap-3 py-3">
                  <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap justify-between gap-x-3 text-sm">
                      <span className="font-medium text-ink">{t.description}</span>
                      <span className="num font-medium text-ink">{formatMoney(t.amountCents, currency)}</span>
                    </p>
                    <p className="text-xs text-ink2">
                      {formatDay(t.date)} · {ratio.toFixed(1)}× your typical {byId.get(t.categoryId)?.name ?? ''} purchase
                      ({formatMoney(typicalCents, currency)})
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="checkCircle" title="Nothing unusual">No purchase stands out from your history in its category.</EmptyState>
          )}
        </Card>

        <Card title="Compared with the last 3 months">
          <p className="-mt-2 mb-2 text-xs text-ink2">{comparison}</p>
          {changes.length ? (
            <ul className="divide-y divide-line">
              {changes.map((r) => {
                const up = r.changeCents > 0
                return (
                  <li key={r.category.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <CategoryLabel category={r.category} />
                    <span className="num text-right">
                      <span className="inline-flex items-center gap-1 font-medium text-ink">
                        {r.changeCents === 0 ? 'Same as usual' : (
                          <>
                            <span aria-hidden="true">{up ? '▲' : '▼'}</span>
                            {formatMoney(Math.abs(r.changeCents), currency)} {up ? 'more' : 'less'}
                          </>
                        )}
                      </span>
                      <span className="block text-xs text-ink2">
                        {formatMoney(r.currentCents, currency)} vs {formatMoney(r.baselineCents, currency)}
                        {r.changeRatio != null && ` (${up ? '+' : ''}${formatPercent(r.changeRatio)})`}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState icon="trendUp" title="Not enough history">Changes appear once there are a few months of spending.</EmptyState>
          )}
        </Card>
      </div>

      <Card title="How these are computed">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink2">
          <li><span className="text-ink">Recurring charges:</span> merchant names are normalized (store numbers, order codes and payment-processor prefixes removed); a merchant charged 3+ times at a weekly, biweekly, monthly, quarterly or yearly rhythm with amounts within 15% of their median counts as recurring.</li>
          <li><span className="text-ink">Unusual transactions:</span> each purchase is scored with a modified z-score on log(amount) against the past year of its category, using the median and median absolute deviation so earlier outliers don’t mask new ones; scores above 3.5 are flagged. Recurring charges are excluded.</li>
          <li><span className="text-ink">Compared with the last 3 months:</span> each category’s spending against its average over the three previous months. While a month is in progress only the same days are compared, so half a month is never measured against whole ones.</li>
          <li><span className="text-ink">Month-end projection</span> (Dashboard): recurring charges still expected this month are added at their typical amount. Everyday spending continues at a daily rate that blends this month’s pace with the median of the last three months, weighted by how much of the month has passed, so one large purchase early in the month isn’t multiplied by 30.</li>
        </ul>
      </Card>
    </div>
  )
}
