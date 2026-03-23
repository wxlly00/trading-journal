import { useEffect, useState } from 'react'
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { fmtPnl, fmtPct, fmtDate } from '../lib/formatters'

interface EquityPoint {
  date: string
  equity: number
  drawdown_pct: number
}

interface Summary {
  trades_count: number
  wins: number
  losses: number
  win_rate: number
  total_pnl: number
  avg_win: number
  avg_loss: number
  profit_factor: number
  avg_rr: number
  expected_value: number
  sharpe: number
  max_drawdown_pct: number
}

interface MonthRow {
  month: string        // "2025-03"
  label: string        // "Mars 2025"
  trades: number
  win_rate: number
  pnl: number
  pct: number
}

const MONTH_NAMES_FR = [
  'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc',
]

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-')
  return `${MONTH_NAMES_FR[parseInt(month, 10) - 1]} ${year}`
}

// Group equity curve by month and compute monthly P&L / returns
function buildMonthlyRows(curve: EquityPoint[]): MonthRow[] {
  if (curve.length === 0) return []

  const byMonth: Record<string, EquityPoint[]> = {}
  for (const pt of curve) {
    const ym = pt.date.slice(0, 7)
    if (!byMonth[ym]) byMonth[ym] = []
    byMonth[ym].push(pt)
  }

  const months = Object.keys(byMonth).sort()

  return months.map((ym, idx) => {
    const points = byMonth[ym]
    const lastEquity = points[points.length - 1].equity
    let prevEquity: number

    if (idx === 0) {
      // First month: use first point of curve as baseline
      prevEquity = curve[0].equity - (lastEquity - points[0].equity) - (points[0].equity - curve[0].equity)
      // Simplified: equity at start of first month
      prevEquity = points[0].equity
      // Actually compute change within the month
      prevEquity = points[0].equity
    } else {
      const prevMonth = months[idx - 1]
      const prevPoints = byMonth[prevMonth]
      prevEquity = prevPoints[prevPoints.length - 1].equity
    }

    const pnl = lastEquity - prevEquity
    const pct = prevEquity !== 0 ? (pnl / prevEquity) * 100 : 0
    const trades = points.length
    const wins = points.filter((p, i) => {
      if (i === 0) return false
      return p.equity > points[i - 1].equity
    }).length
    const win_rate = trades > 1 ? (wins / (trades - 1)) * 100 : 0

    return {
      month: ym,
      label: formatMonthLabel(ym),
      trades,
      win_rate,
      pnl,
      pct,
    }
  })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="bg-[#111] text-white text-xs rounded-xl px-3 py-2 shadow-xl space-y-1">
      <p className="font-semibold text-[#999] mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-semibold">
            {p.name === 'Drawdown' ? fmtPct(-p.value) : fmtPnl(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

function SummaryTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center bg-[#f5f5f5] rounded-2xl px-6 py-4">
      <p className="text-[10px] uppercase tracking-wider text-[#888] font-medium mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color: color ?? '#111' }}>
        {value}
      </p>
    </div>
  )
}

export default function Performance() {
  const { activeAccountId } = useAccountStore()
  const [curve, setCurve] = useState<EquityPoint[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeAccountId) return
    setLoading(true)
    setError(null)

    const q = `account_id=${activeAccountId}`

    Promise.all([
      api.get<EquityPoint[]>(`/api/stats/equity-curve?${q}`),
      api.get<Summary>(`/api/stats/summary?${q}`),
    ])
      .then(([c, s]) => {
        setCurve(c)
        setSummary(s)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeAccountId])

  const monthlyRows = buildMonthlyRows(curve)

  // Compute total return %
  const totalReturn =
    curve.length > 1 && curve[0].equity !== 0
      ? ((curve[curve.length - 1].equity - curve[0].equity) / curve[0].equity) * 100
      : null

  // Format chart data — sample if too many points
  const chartData = curve.map((pt) => ({
    date: fmtDate(pt.date),
    Équité: pt.equity,
    Drawdown: pt.drawdown_pct,
  }))

  if (!activeAccountId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Performance</h1>
        <p className="text-[#888] text-sm mt-4">Sélectionnez un compte pour voir les performances.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Performance</h1>
        <div className="bg-white rounded-2xl p-5 animate-pulse h-80" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-20" />
          ))}
        </div>
        <div className="bg-white rounded-2xl p-5 animate-pulse h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Performance</h1>
        <div className="mt-6 bg-white rounded-2xl p-5 text-[#ef4444]">Erreur : {error}</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-extrabold text-[#111]">Performance</h1>

      {/* Equity curve chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <p className="text-[#111] font-semibold mb-4">Courbe de capital</p>
        {curve.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-[#888] text-sm">
            Aucune donnée disponible.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 48, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#999' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="equity"
                orientation="left"
                tick={{ fontSize: 11, fill: '#999' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v as number).toLocaleString()}`}
              />
              <YAxis
                yAxisId="dd"
                orientation="right"
                tick={{ fontSize: 11, fill: '#999' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v as number).toFixed(1)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="circle"
              />
              <Area
                yAxisId="equity"
                type="monotone"
                dataKey="Équité"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.12}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Bar
                yAxisId="dd"
                dataKey="Drawdown"
                fill="#ef4444"
                fillOpacity={0.5}
                radius={[2, 2, 0, 0]}
                maxBarSize={8}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryTile
          label="Total P&L"
          value={fmtPnl(summary?.total_pnl)}
          color={summary?.total_pnl != null ? (summary.total_pnl >= 0 ? '#22c55e' : '#ef4444') : '#111'}
        />
        <SummaryTile
          label="Rendement"
          value={totalReturn != null ? fmtPct(totalReturn) : '—'}
          color={totalReturn != null ? (totalReturn >= 0 ? '#22c55e' : '#ef4444') : '#111'}
        />
        <SummaryTile
          label="Sharpe Ratio"
          value={summary?.sharpe != null ? summary.sharpe.toFixed(2) : '—'}
          color={summary?.sharpe != null ? (summary.sharpe >= 1 ? '#22c55e' : summary.sharpe >= 0 ? '#111' : '#ef4444') : '#111'}
        />
        <SummaryTile
          label="Max Drawdown"
          value={summary?.max_drawdown_pct != null ? fmtPct(-summary.max_drawdown_pct) : '—'}
          color="#ef4444"
        />
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f5f5f5]">
          <p className="text-[#111] font-semibold">Breakdown mensuel</p>
        </div>
        {monthlyRows.length === 0 ? (
          <div className="p-5 text-[#888] text-sm">Aucune donnée mensuelle.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#888] text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Mois</th>
                  <th className="px-5 py-3 text-right font-medium">Trades</th>
                  <th className="px-5 py-3 text-right font-medium">Win Rate</th>
                  <th className="px-5 py-3 text-right font-medium">P&L</th>
                  <th className="px-5 py-3 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row, idx) => (
                  <tr
                    key={row.month}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}
                  >
                    <td className="px-5 py-3 font-medium text-[#111]">{row.label}</td>
                    <td className="px-5 py-3 text-right text-[#888]">{row.trades}</td>
                    <td className="px-5 py-3 text-right text-[#888]">
                      {row.trades > 1 ? fmtPct(row.win_rate) : '—'}
                    </td>
                    <td
                      className="px-5 py-3 text-right font-semibold"
                      style={{ color: row.pnl >= 0 ? '#22c55e' : '#ef4444' }}
                    >
                      {fmtPnl(row.pnl)}
                    </td>
                    <td
                      className="px-5 py-3 text-right font-semibold"
                      style={{ color: row.pct >= 0 ? '#22c55e' : '#ef4444' }}
                    >
                      {fmtPct(row.pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#f0f0f0] bg-[#fafafa]">
                  <td className="px-5 py-3 font-semibold text-[#111]">Total</td>
                  <td className="px-5 py-3 text-right text-[#888] font-medium">
                    {summary?.trades_count ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-[#888] font-medium">
                    {summary?.win_rate != null ? fmtPct(summary.win_rate * 100) : '—'}
                  </td>
                  <td
                    className="px-5 py-3 text-right font-bold"
                    style={{
                      color:
                        summary?.total_pnl != null
                          ? summary.total_pnl >= 0
                            ? '#22c55e'
                            : '#ef4444'
                          : '#111',
                    }}
                  >
                    {fmtPnl(summary?.total_pnl)}
                  </td>
                  <td
                    className="px-5 py-3 text-right font-bold"
                    style={{
                      color:
                        totalReturn != null
                          ? totalReturn >= 0
                            ? '#22c55e'
                            : '#ef4444'
                          : '#111',
                    }}
                  >
                    {totalReturn != null ? fmtPct(totalReturn) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
