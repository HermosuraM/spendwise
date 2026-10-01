import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { shortMonth, monthLabel } from '../lib/dates'
import { formatMoney, formatPercent } from '../lib/money'
import { CHROME, SERIES, slotColor } from '../lib/palette'
import { useThemeMode } from '../state/useThemeMode'
import { CategoryDot } from './ui'

function Swatch({ color }) {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
}

/** Tooltip: values in ink, identity carried by the swatch beside them. */
function TooltipCard({ active, payload, label, currency, title }) {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink">{title ? title(label, payload) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} className="flex items-center gap-2 text-ink2">
          <Swatch color={p.payload?.fill ?? p.color ?? p.fill} />
          <span>{p.name}</span>
          <span className="num ml-auto pl-4 font-medium text-ink">{formatMoney(Math.round(p.value * 100), currency)}</span>
        </p>
      ))}
    </div>
  )
}

export function CategoryDonut({ rows, totalCents, currency }) {
  const mode = useThemeMode()
  const data = rows.map((r) => ({ ...r, value: r.cents / 100, fill: slotColor(r.colorSlot, mode) }))
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" startAngle={90} endAngle={-270}
              paddingAngle={data.length > 1 ? 1 : 0} stroke={CHROME[mode].surface} strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.categoryId} fill={d.fill} />)}
            </Pie>
            <Tooltip content={<TooltipCard currency={currency} title={(_l, p) => p[0]?.name} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-xs text-ink2">Spent</p>
            <p className="num text-lg font-semibold text-ink">{formatMoney(totalCents, currency, { compact: true })}</p>
          </div>
        </div>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Spending by category</caption>
        <thead className="sr-only">
          <tr><th>Category</th><th>Amount</th><th>Share</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.categoryId} className="border-b border-line last:border-0">
              <td className="py-1.5">
                <span className="flex items-center gap-2 text-ink2" title={r.members?.length ? r.members.join(', ') : undefined}>
                  <CategoryDot slot={r.colorSlot} />
                  {r.name}
                </span>
              </td>
              <td className="num py-1.5 text-right font-medium text-ink">{formatMoney(r.cents, currency)}</td>
              <td className="num w-14 py-1.5 text-right text-ink2">{formatPercent(r.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CashflowChart({ series, currency }) {
  const mode = useThemeMode()
  const chrome = CHROME[mode]
  const [incomeColor, spendColor] = [SERIES[mode][0], SERIES[mode][1]]
  const data = series.map((m) => ({ key: m.key, label: shortMonth(m.key), income: m.incomeCents / 100, spending: m.expenseCents / 100 }))
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-ink2" aria-hidden="true">
        <span className="flex items-center gap-1.5"><Swatch color={incomeColor} />Income</span>
        <span className="flex items-center gap-1.5"><Swatch color={spendColor} />Spending</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={chrome.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: chrome.axis }} tick={{ fill: chrome.ink2, fontSize: 12 }} />
            <YAxis width={52} tickLine={false} axisLine={false} tick={{ fill: chrome.muted, fontSize: 12 }}
              tickFormatter={(v) => formatMoney(v * 100, currency, { compact: true })} />
            <Tooltip cursor={{ fill: chrome.grid, opacity: 0.5 }}
              content={<TooltipCard currency={currency} title={(_l, p) => monthLabel(p[0]?.payload?.key ?? '')} />} />
            <Bar dataKey="income" name="Income" fill={incomeColor} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            <Bar dataKey="spending" name="Spending" fill={spendColor} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink2 hover:text-ink">View as table</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left text-xs text-ink2">
              <th scope="col" className="py-1 font-medium">Month</th>
              <th scope="col" className="py-1 text-right font-medium">Income</th>
              <th scope="col" className="py-1 text-right font-medium">Spending</th>
              <th scope="col" className="py-1 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {series.map((m) => (
              <tr key={m.key} className="border-t border-line">
                <td className="py-1 text-ink2">{monthLabel(m.key)}</td>
                <td className="num py-1 text-right">{formatMoney(m.incomeCents, currency)}</td>
                <td className="num py-1 text-right">{formatMoney(m.expenseCents, currency)}</td>
                <td className="num py-1 text-right font-medium">{formatMoney(m.netCents, currency, { signed: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
