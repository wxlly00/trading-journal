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

interface HeatCell { weekday: number; hour: number; pnl: number; count: number }

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6h → 21h

function cellColor(pnl: number): string {
  if (pnl === 0) return 'bg-subtle'
  const intensity = Math.min(Math.abs(pnl) / 100, 1)
  if (pnl > 0) {
    const g = Math.round(180 + intensity * 55)
    return `rgba(34,${g},94,${0.2 + intensity * 0.6})`
  }
  const r = Math.round(180 + intensity * 55)
  return `rgba(${r},68,68,${0.2 + intensity * 0.6})`
}

function HeatmapGrid({ data }: { data: HeatCell[] }) {
  const map = new Map(data.map((d) => [`${d.weekday}_${d.hour}`, d]))
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="flex gap-0.5 mb-1 pl-10">
          {HOURS.map((h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted font-medium">{h}h</div>
          ))}
        </div>
        {DAYS.map((day, wi) => (
          <div key={day} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-9 text-[10px] text-muted font-medium text-right pr-2">{day}</div>
            {HOURS.map((h) => {
              const cell = map.get(`${wi}_${h}`)
              const color = cell ? cellColor(cell.pnl) : undefined
              return (
                <div
                  key={h}
                  className={`flex-1 h-7 rounded-md ${!color ? 'bg-subtle' : ''}`}
                  style={color ? { backgroundColor: color } : undefined}
                  title={cell ? `${fmtPnl(cell.pnl)} · ${cell.count} trade${cell.count > 1 ? 's' : ''}` : undefined}
                />
              )
            })}
          </div>
        ))}
        <div className="flex items-center gap-3 mt-3 pl-10">
          <span className="text-[10px] text-muted">Moins</span>
          {[-100, -50, -10, 0, 10, 50, 100].map((v) => (
            <div
              key={v}
              className="w-5 h-3 rounded"
              style={v !== 0 ? { backgroundColor: cellColor(v) } : { backgroundColor: '#e5e5e5' }}
            />
          ))}
          <span className="text-[10px] text-muted">Plus</span>
        </div>
      </div>
    </div>
  )
}

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
      prevEquity = curve[0].equity - (lastEquity - points[0].equity) - (points[0].equity - curve[0].equity)
      prevEquity = points[0].equity
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
    <div className="flex flex-col items-center justify-center bg-card border border-border rounded-xl px-6 py-4">
      <p className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">{label}</p>
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
  const [heatmap, setHeatmap] = useState<HeatCell[]>([])
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
      api.get<HeatCell[]>(`/api/stats/heatmap?${q}`),
    ])
      .then(([c, s, h]) => {
        setCurve(c)
        setSummary(s)
        setHeatmap(h)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeAccountId])

  const monthlyRows = buildMonthlyRows(curve)

  const totalReturn =
    curve.length > 1 && curve[0].equity !== 0
      ? ((curve[curve.length - 1].equity - curve[0].equity) / curve[0].equity) * 100
      : null

  const chartData = curve.map((pt) => ({
    date: fmtDate(pt.date),
    Équité: pt.equity,
    Drawdown: pt.drawdown_pct,
  }))

  if (!activeAccountId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Performance</h1>
        <p className="text-muted text-sm mt-4">Sélectionnez un compte pour voir les performances.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Performance</h1>
        <div className="bg-card border border-border rounded-xl p-5 animate-pulse h-80" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse h-20" />
          ))}
        </div>
        <div className="bg-card border border-border rounded-xl p-5 animate-pulse h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Performance</h1>
        <div className="mt-6 bg-card border border-border rounded-xl p-5 text-[#ef4444]">Erreur : {error}</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <h1 className="text-2xl font-extrabold text-dark">Performance</h1>

      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-[#111] font-semibold mb-4">Courbe de capital</p>
        {curve.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted text-sm">
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

      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-dark mb-1">Heatmap — Heure × Jour</p>
        <p className="text-xs text-muted mb-4">P&L moyen par heure et jour de trading</p>
        {heatmap.length === 0 ? (
          <div className="text-sm text-muted py-4">Pas assez de données</div>
        ) : (
          <HeatmapGrid data={heatmap} />
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f5f5f5]">
          <p className="text-[#111] font-semibold">Breakdown mensuel</p>
        </div>
        {monthlyRows.length === 0 ? (
          <div className="p-5 text-muted text-sm">Aucune donnée mensuelle.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-xs uppercase tracking-wide border-b border-subtle">
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
                    className={idx % 2 === 0 ? 'bg-card' : 'bg-surface'}
                  >
                    <td className="px-5 py-3 font-medium text-[#111]">{row.label}</td>
                    <td className="px-5 py-3 text-right text-muted">{row.trades}</td>
                    <td className="px-5 py-3 text-right text-muted">
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
                <tr className="border-t border-subtle bg-surface">
                  <td className="px-5 py-3 font-semibold text-[#111]">Total</td>
                  <td className="px-5 py-3 text-right text-muted font-medium">
                    {summary?.trades_count ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-muted font-medium">
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
