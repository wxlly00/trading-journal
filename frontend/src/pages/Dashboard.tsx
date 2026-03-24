import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { KpiCard } from '../components/ui/KpiCard'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Badge } from '../components/ui/Badge'
import { fmtPnl, fmtPct, fmtDate, fmtPrice, fmtDuration } from '../lib/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface EquityPoint {
  date: string
  equity: number
  drawdown_pct: number
}

interface SymbolStat {
  symbol: string
  pnl: number
  win_rate: number
  trades: number
}

interface Trade {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  open_time: string
  close_time: string
  open_price: number
  close_price: number
  sl: number | null
  tp: number | null
  lots: number
  pnl_net: number
  rr_realized: number | null
  duration_min: number | null
  session: string | null
  status: string
  note: string | null
  tag: string | null
}

type Period = 'day' | 'week' | 'month' | 'year'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDateRange(period: Period): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString()
  const from = new Date(now)

  if (period === 'day') {
    from.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    const day = from.getDay()
    const diff = day === 0 ? 6 : day - 1
    from.setDate(from.getDate() - diff)
    from.setHours(0, 0, 0, 0)
  } else if (period === 'month') {
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  } else {
    from.setMonth(0, 1)
    from.setHours(0, 0, 0, 0)
  }

  return { from: from.toISOString(), to }
}

function getPrevDateRange(period: Period): { from: string; to: string } {
  const now = new Date()
  const pFrom = new Date(now)
  const pTo = new Date(now)

  if (period === 'day') {
    pFrom.setDate(pFrom.getDate() - 1)
    pFrom.setHours(0, 0, 0, 0)
    pTo.setDate(pTo.getDate() - 1)
    pTo.setHours(23, 59, 59, 999)
  } else if (period === 'week') {
    const day = pFrom.getDay()
    const diff = day === 0 ? 6 : day - 1
    pFrom.setDate(pFrom.getDate() - diff - 7)
    pFrom.setHours(0, 0, 0, 0)
    pTo.setDate(pFrom.getDate() + 6)
    pTo.setHours(23, 59, 59, 999)
  } else if (period === 'month') {
    pFrom.setMonth(pFrom.getMonth() - 1, 1)
    pFrom.setHours(0, 0, 0, 0)
    pTo.setDate(0) // last day of prev month
    pTo.setHours(23, 59, 59, 999)
  } else {
    pFrom.setFullYear(pFrom.getFullYear() - 1, 0, 1)
    pFrom.setHours(0, 0, 0, 0)
    pTo.setFullYear(pTo.getFullYear() - 1, 11, 31)
    pTo.setHours(23, 59, 59, 999)
  }

  return { from: pFrom.toISOString(), to: pTo.toISOString() }
}

function periodLabel(period: Period): string {
  const { from } = getDateRange(period)
  const d = new Date(from)
  const now = new Date()

  if (period === 'day') {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  if (period === 'week') {
    return `Sem. ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
  }
  if (period === 'month') {
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  }
  return d.getFullYear().toString()
}

function prevPeriodLabel(period: Period): string {
  if (period === 'day') return 'hier'
  if (period === 'week') return 'sem. préc.'
  if (period === 'month') return 'mois préc.'
  return 'année préc.'
}

function fmtDelta(delta: number, format: 'pnl' | 'pct' | 'count'): string {
  const sign = delta >= 0 ? '+' : ''
  if (format === 'pnl') return `${sign}$${delta.toFixed(0)}`
  if (format === 'pct') return `${sign}${delta.toFixed(1)}%`
  return `${sign}${delta}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function KpiSkeleton({ dark }: { dark?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 animate-pulse ${dark ? 'bg-dark' : 'bg-card'}`}>
      <div className={`h-3 w-20 rounded mb-3 ${dark ? 'bg-white/10' : 'bg-subtle'}`} />
      <div className={`h-9 w-28 rounded ${dark ? 'bg-white/10' : 'bg-subtle'}`} />
    </div>
  )
}

// ─── Comparison row ───────────────────────────────────────────────────────────

function DeltaBadge({
  label, delta, format,
}: {
  label: string
  delta: number
  format: 'pnl' | 'pct' | 'count'
}) {
  const positive = delta >= 0
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
      positive ? 'bg-green/10 text-green' : 'bg-red/10 text-red'
    }`}>
      <span>{positive ? '▲' : '▼'}</span>
      <span>{fmtDelta(delta, format)}</span>
      <span className="text-[10px] opacity-60 font-normal">{label}</span>
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function EquityTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark text-white text-xs rounded-xl px-3 py-2 shadow-lg">
      <p className="text-[#666] mb-0.5">{fmtDate(label)}</p>
      <p className="font-bold">${payload[0].value.toFixed(2)}</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { activeAccountId } = useAccountStore()

  const [period, setPeriod] = useState<Period>('month')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [prevSummary, setPrevSummary] = useState<Summary | null>(null)
  const [equity, setEquity] = useState<EquityPoint[]>([])
  const [symbols, setSymbols] = useState<SymbolStat[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(Date.now())

  const fetchAll = useCallback(async () => {
    if (!activeAccountId) return
    setLoading(true)
    setError(null)

    const { from, to } = getDateRange(period)
    const qs = `account_id=${activeAccountId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`

    const { from: pFrom, to: pTo } = getPrevDateRange(period)
    const prevQs = `account_id=${activeAccountId}&from=${encodeURIComponent(pFrom)}&to=${encodeURIComponent(pTo)}`

    try {
      const [summaryData, prevSummaryData, equityData, symbolsData, tradesData] = await Promise.all([
        api.get<Summary>(`/api/stats/summary?${qs}`),
        api.get<Summary>(`/api/stats/summary?${prevQs}`),
        api.get<EquityPoint[]>(`/api/stats/equity-curve?${qs}`),
        api.get<SymbolStat[]>(`/api/stats/by-symbol?${qs}`),
        api.get<Trade[]>(`/api/trades?account_id=${activeAccountId}&limit=10&offset=0`),
      ])
      setSummary(summaryData)
      setPrevSummary(prevSummaryData)
      setEquity(equityData)
      setSymbols(symbolsData.slice(0, 8))
      setTrades(tradesData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [activeAccountId, period])

  // Initial + period-change fetch
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!activeAccountId) return
    const interval = setInterval(() => setLastRefresh(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [activeAccountId])

  useEffect(() => {
    if (lastRefresh === Date.now()) return // skip the initial mount (fetchAll handles it)
    fetchAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefresh])

  // ── No account ──────────────────────────────────────────────────────────────

  if (!activeAccountId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-subtle flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-muted">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
        </div>
        <div>
          <p className="text-dark font-semibold">Aucun compte selectionne</p>
          <p className="text-muted text-sm mt-1">Configurez un compte pour voir vos statistiques</p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="px-4 py-2 bg-dark text-white text-sm font-medium rounded-xl hover:opacity-80 transition-opacity"
        >
          Aller aux parametres
        </button>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-3">
        <p className="text-red font-semibold">Erreur de chargement</p>
        <p className="text-muted text-sm">{error}</p>
        <button
          onClick={fetchAll}
          className="px-4 py-2 bg-dark text-white text-sm font-medium rounded-xl hover:opacity-80 transition-opacity"
        >
          Reessayer
        </button>
      </div>
    )
  }

  // ── Symbols bar chart ────────────────────────────────────────────────────────

  const maxAbsPnl = symbols.length > 0 ? Math.max(...symbols.map((s) => Math.abs(s.pnl))) : 1

  // ── Deltas ───────────────────────────────────────────────────────────────────

  const showComparison = summary && prevSummary && prevSummary.trades_count > 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-dark">Dashboard</h1>
          <p className="text-muted text-sm mt-0.5 capitalize">{periodLabel(period)}</p>
        </div>
        <SegmentedControl
          value={period}
          onChange={(v) => setPeriod(v as Period)}
          options={[
            { label: 'Jour', value: 'day' },
            { label: 'Sem.', value: 'week' },
            { label: 'Mois', value: 'month' },
            { label: 'An', value: 'year' },
          ]}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {loading ? (
          <>
            <KpiSkeleton dark />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              dark
              label="P&L Total"
              value={fmtPnl(summary?.total_pnl ?? null)}
              change={summary ? `${summary.trades_count} trades` : undefined}
              valuePositive={summary ? summary.total_pnl >= 0 : undefined}
            />
            <KpiCard
              label="Win Rate"
              value={fmtPct(summary?.win_rate ?? null)}
              change={summary ? `${summary.wins}W / ${summary.losses}L` : undefined}
              changePositive={summary ? summary.win_rate >= 50 : undefined}
            />
            <KpiCard
              label="R:R Moyen"
              value={summary?.avg_rr != null ? summary.avg_rr.toFixed(2) : '—'}
              change={summary ? `EV ${fmtPnl(summary.expected_value)}` : undefined}
              changePositive={summary ? summary.avg_rr >= 1 : undefined}
            />
            <KpiCard
              label="Drawdown Max"
              value={summary?.max_drawdown_pct != null ? `${summary.max_drawdown_pct.toFixed(1)}%` : '—'}
              change={summary ? `Sharpe ${summary.sharpe?.toFixed(2) ?? '—'}` : undefined}
              changePositive={summary ? summary.max_drawdown_pct < 10 : undefined}
            />
          </>
        )}
      </div>

      {/* Comparison vs prev period */}
      {showComparison && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[11px] text-muted font-medium">vs {prevPeriodLabel(period)} :</span>
          <DeltaBadge
            label="P&L"
            delta={summary!.total_pnl - prevSummary!.total_pnl}
            format="pnl"
          />
          <DeltaBadge
            label="Win Rate"
            delta={summary!.win_rate - prevSummary!.win_rate}
            format="pct"
          />
          <DeltaBadge
            label="Trades"
            delta={summary!.trades_count - prevSummary!.trades_count}
            format="count"
          />
          {summary!.avg_rr != null && prevSummary!.avg_rr != null && (
            <DeltaBadge
              label="R:R"
              delta={summary!.avg_rr - prevSummary!.avg_rr}
              format="pct"
            />
          )}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Equity Curve – 2/3 */}
        <div className="md:col-span-2 bg-card rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Courbe d&apos;equite</p>
          {loading ? (
            <div className="h-44 md:h-52 bg-subtle rounded-xl animate-pulse" />
          ) : equity.length === 0 ? (
            <div className="h-44 md:h-52 flex items-center justify-center text-muted text-sm">Pas de donnees</div>
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart data={equity} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 11, fill: '#999' }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#999' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                  width={56}
                />
                <Tooltip content={<EquityTooltip />} />
                <Area
                  type="monotone"
                  dataKey="equity"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#equityGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#22c55e', stroke: 'white', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* By-symbol – 1/3 */}
        <div className="bg-card rounded-2xl p-5">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Par paire</p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-2 w-14 bg-subtle rounded mb-1.5" />
                  <div className="h-5 bg-subtle rounded-lg" style={{ width: `${60 + i * 7}%` }} />
                </div>
              ))}
            </div>
          ) : symbols.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-muted text-sm">Pas de donnees</div>
          ) : (
            <div className="space-y-2.5">
              {symbols.map((s) => {
                const pct = (Math.abs(s.pnl) / maxAbsPnl) * 100
                const positive = s.pnl >= 0
                return (
                  <div key={s.symbol}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-dark">{s.symbol}</span>
                      <span className={`text-xs font-bold ${positive ? 'text-green' : 'text-red'}`}>
                        {fmtPnl(s.pnl)}
                      </span>
                    </div>
                    <div className="h-4 bg-subtle rounded-lg overflow-hidden">
                      <div
                        className={`h-full rounded-lg transition-all ${positive ? 'bg-green/20' : 'bg-red/20'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted mt-0.5">{s.trades} trades · {fmtPct(s.win_rate)} WR</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Last trades */}
      <div className="bg-card rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
          <p className="text-sm font-semibold text-dark">Derniers trades</p>
          <button
            onClick={() => navigate('/journal')}
            className="text-xs text-muted hover:text-dark transition-colors font-medium"
          >
            Voir tout →
          </button>
        </div>

        {loading ? (
          <div className="divide-y divide-subtle">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-5 py-3.5 animate-pulse flex items-center gap-4">
                <div className="h-3 w-16 bg-subtle rounded" />
                <div className="h-5 w-10 bg-subtle rounded-full" />
                <div className="flex-1 h-3 bg-subtle rounded" />
                <div className="h-3 w-16 bg-subtle rounded" />
              </div>
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted text-sm">Aucun trade enregistre</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-subtle">
                  {['Paire', 'Dir.', 'P&L', 'R:R', 'Duree', 'Statut'].map((col) => (
                    <th key={col} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                    Entree
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                    Lots
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {trades.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/journal/${t.id}`)}
                    className="hover:bg-surface cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-semibold text-dark">{t.symbol}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.type === 'buy' ? 'buy' : 'sell'} label={t.type.toUpperCase()} />
                    </td>
                    <td className={`px-4 py-3 text-sm font-bold ${t.pnl_net >= 0 ? 'text-green' : 'text-red'}`}>
                      {fmtPnl(t.pnl_net)}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {t.rr_realized != null ? t.rr_realized.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{fmtDuration(t.duration_min)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={t.status === 'win' ? 'win' : t.status === 'loss' ? 'loss' : 'neutral'}
                        label={t.status.toUpperCase()}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted hidden md:table-cell">{fmtPrice(t.open_price)}</td>
                    <td className="px-4 py-3 text-sm text-muted hidden md:table-cell">{t.lots}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
