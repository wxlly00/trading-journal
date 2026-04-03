import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { KpiCard } from '../components/ui/KpiCard'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Badge } from '../components/ui/Badge'
import { fmtPnl, fmtPct, fmtDate, fmtDatetime, fmtDuration } from '../lib/formatters'

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

function KpiSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
      <div className="h-3 w-20 rounded mb-3 bg-subtle" />
      <div className="h-9 w-28 rounded bg-subtle" />
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
  const [violations, setViolations] = useState(0)

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

  // Violations fetch
  useEffect(() => {
    api.get<{ total_violations: number }>('/api/rules/stats')
      .then(d => setViolations(d.total_violations ?? 0))
      .catch(() => {})
  }, [])

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

  // ── Derived values ────────────────────────────────────────────────────────────

  const maxAbsPnl = symbols.length > 0 ? Math.max(...symbols.map((s) => Math.abs(s.pnl))) : 1
  const showComparison = summary && prevSummary && prevSummary.trades_count > 0

  // P&L delta vs prev period
  const pnlDelta = showComparison
    ? summary!.total_pnl - prevSummary!.total_pnl
    : null
  const pnlDeltaStr = pnlDelta != null
    ? `${fmtDelta(pnlDelta, 'pnl')} vs ${prevPeriodLabel(period)}`
    : undefined

  // Profit factor quality label
  const pfDelta = summary
    ? summary.profit_factor >= 1.5
      ? 'Excellent'
      : summary.profit_factor >= 1
      ? 'Correct'
      : 'Faible'
    : undefined
  const pfDeltaPositive = summary
    ? summary.profit_factor >= 1.5
      ? true
      : summary.profit_factor >= 1
      ? undefined
      : false
    : undefined

  // Drawdown delta label
  const ddDelta = summary
    ? `Limite : ${summary.max_drawdown_pct < 5 ? '5' : '10'}%`
    : undefined

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 md:p-7 space-y-5">

      {/* Violation banner */}
      {violations > 0 && (
        <div className="flex items-start gap-3 bg-amber-bg border border-amber/30 rounded-xl p-3.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-4 h-4 text-amber flex-shrink-0 mt-0.5"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-[12.5px] text-amber">
            <strong className="font-semibold">{violations} violation{violations > 1 ? 's' : ''} de règles</strong>{' '}
            détectée{violations > 1 ? 's' : ''} ce mois.{' '}
            <button
              onClick={() => navigate('/rules')}
              className="font-semibold underline"
            >
              Voir les règles →
            </button>
          </p>
        </div>
      )}

      {/* Period tabs + page header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-dark tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-muted capitalize mt-0.5">{periodLabel(period)}</p>
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

      {/* KPI 4-col grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-3.5">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-3.5">
          {/* P&L Net */}
          <KpiCard
            label="P&L Net"
            value={fmtPnl(summary?.total_pnl ?? null)}
            delta={pnlDeltaStr}
            deltaPositive={pnlDelta != null ? pnlDelta >= 0 : undefined}
            valuePositive={summary ? summary.total_pnl >= 0 : undefined}
          />

          {/* Win Rate */}
          <KpiCard
            label="Win Rate"
            value={fmtPct(summary?.win_rate ?? null)}
            progressPct={summary?.win_rate}
            progressColor="green"
            subtext={summary ? `${summary.wins}W / ${summary.losses}L` : undefined}
          />

          {/* Profit Factor */}
          <KpiCard
            label="Profit Factor"
            value={summary?.profit_factor != null ? summary.profit_factor.toFixed(2) : '—'}
            delta={pfDelta}
            deltaPositive={pfDeltaPositive}
          />

          {/* Drawdown max */}
          <KpiCard
            label="Drawdown max"
            value={summary?.max_drawdown_pct != null ? `-${summary.max_drawdown_pct.toFixed(1)}%` : '—'}
            delta={ddDelta}
            deltaPositive={false}
            valuePositive={false}
          />
        </div>
      )}

      {/* Daily goals (today only) */}
      {period === 'day' && (() => {
        const target = parseFloat(localStorage.getItem('tj-daily-target') ?? '')
        const maxLoss = parseFloat(localStorage.getItem('tj-daily-maxloss') ?? '')
        const pnl = summary?.total_pnl ?? 0
        if (!target && !maxLoss) return null
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {target > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted">Objectif du jour</p>
                  <span className={`text-xs font-bold ${pnl >= target ? 'text-green' : 'text-dark'}`}>
                    {fmtPnl(pnl)} / {fmtPnl(target)}
                  </span>
                </div>
                <div className="h-2 bg-subtle rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green transition-all"
                    style={{ width: `${Math.min((pnl / target) * 100, 100)}%` }}
                  />
                </div>
                {pnl >= target && <p className="text-[10px] text-green font-semibold mt-1">Objectif atteint !</p>}
              </div>
            )}
            {maxLoss > 0 && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted">Perte max / jour</p>
                  <span className={`text-xs font-bold ${pnl < -maxLoss ? 'text-red' : 'text-dark'}`}>
                    {fmtPnl(Math.min(pnl, 0))} / -{fmtPnl(maxLoss)}
                  </span>
                </div>
                <div className="h-2 bg-subtle rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red transition-all"
                    style={{ width: `${Math.min((Math.abs(Math.min(pnl, 0)) / maxLoss) * 100, 100)}%` }}
                  />
                </div>
                {pnl < -maxLoss && <p className="text-[10px] text-red font-semibold mt-1">Limite atteinte — arrêtez de trader !</p>}
              </div>
            )}
          </div>
        )
      })()}

      {/* Charts row — equity 2/3 + quick stats 1/3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">

        {/* Equity curve — 2/3 */}
        <div className="md:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-dark">Courbe d&apos;équité</p>
            {summary != null && (
              <span className={`text-[17px] font-extrabold ${summary.total_pnl >= 0 ? 'text-green' : 'text-red'}`}>
                {fmtPnl(summary.total_pnl)}
              </span>
            )}
          </div>
          {loading ? (
            <div className="h-44 md:h-52 bg-subtle rounded-xl animate-pulse" />
          ) : equity.length === 0 ? (
            <div className="h-44 md:h-52 flex items-center justify-center text-muted text-sm">Pas de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={208}>
              <AreaChart data={equity} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
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
                  stroke="#16a34a"
                  strokeWidth={2}
                  fill="url(#equityGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#16a34a', stroke: 'white', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick stats — 1/3 */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-[13px] font-bold text-dark mb-3">Résumé</p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-2.5">
                  <div className="h-3 w-24 bg-subtle rounded" />
                  <div className="h-3 w-16 bg-subtle rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between py-2.5 border-b border-border">
                <span className="text-[12.5px] text-text2">Gain moyen</span>
                <span className={`text-[13px] font-bold ${summary?.avg_win != null && summary.avg_win >= 0 ? 'text-green' : 'text-dark'}`}>
                  {fmtPnl(summary?.avg_win ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border">
                <span className="text-[12.5px] text-text2">Perte moyenne</span>
                <span className="text-[13px] font-bold text-red">
                  {fmtPnl(summary?.avg_loss ?? null)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border">
                <span className="text-[12.5px] text-text2">Ratio R:R</span>
                <span className="text-[13px] font-bold text-dark">
                  {summary?.avg_rr != null ? summary.avg_rr.toFixed(2) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border">
                <span className="text-[12.5px] text-text2">Trades</span>
                <span className="text-[13px] font-bold text-dark">
                  {summary?.trades_count ?? '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border">
                <span className="text-[12.5px] text-text2">Sharpe</span>
                <span className="text-[13px] font-bold text-dark">
                  {summary?.sharpe != null ? summary.sharpe.toFixed(2) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-[12.5px] text-text2">Profit Factor</span>
                <span className="text-[13px] font-bold text-dark">
                  {summary?.profit_factor != null ? summary.profit_factor.toFixed(2) : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* By-symbol */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-[13px] font-bold text-dark mb-4">Par paire</p>
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
          <div className="h-24 flex items-center justify-center text-muted text-sm">Pas de données</div>
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

      {/* Last trades */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-[13px] font-bold text-dark">Derniers trades</p>
          <button
            onClick={() => navigate('/journal')}
            className="text-[12.5px] font-semibold text-muted hover:text-dark transition-colors"
          >
            Voir tout →
          </button>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-5 py-3.5 animate-pulse flex items-center gap-4">
                <div className="h-7 w-7 bg-subtle rounded-md" />
                <div className="h-3 w-20 bg-subtle rounded" />
                <div className="h-5 w-10 bg-subtle rounded" />
                <div className="flex-1 h-3 bg-subtle rounded" />
                <div className="h-3 w-16 bg-subtle rounded" />
              </div>
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="px-5 py-10 text-center text-muted text-sm">Aucun trade enregistré</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-border">
                  {['Instrument', 'Direction', 'Ouverture', 'Fermeture', 'Durée', 'R:R', 'P&L Net', 'État'].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2.5 text-left text-[10.5px] font-bold text-muted uppercase tracking-[.06em] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const rrVal = t.rr_realized
                  const rrColor =
                    rrVal == null
                      ? 'text-dark'
                      : rrVal >= 1.5
                      ? 'text-green'
                      : rrVal < 1
                      ? 'text-red'
                      : 'text-dark'

                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/journal/${t.id}`)}
                      className="border-b border-border last:border-0 hover:bg-subtle cursor-pointer transition-colors"
                    >
                      {/* Instrument */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-subtle border border-border rounded-md flex items-center justify-center text-[9px] font-black text-text2 tracking-tight flex-shrink-0">
                            {t.symbol.slice(0, 3)}
                          </div>
                          <div>
                            <div className="text-[13.5px] font-bold text-dark">{t.symbol}</div>
                          </div>
                        </div>
                      </td>
                      {/* Direction */}
                      <td className="px-4 py-3">
                        <Badge variant={t.type === 'buy' ? 'buy' : 'sell'} label={t.type.toUpperCase()} />
                      </td>
                      {/* Open */}
                      <td className="px-4 py-3 text-[12px] text-text2 whitespace-nowrap">
                        {fmtDatetime(t.open_time)}
                      </td>
                      {/* Close */}
                      <td className="px-4 py-3 text-[12px] text-text2 whitespace-nowrap">
                        {t.close_time ? fmtDatetime(t.close_time) : '—'}
                      </td>
                      {/* Duration */}
                      <td className="px-4 py-3 text-[13px] text-muted">
                        {fmtDuration(t.duration_min)}
                      </td>
                      {/* R:R */}
                      <td className={`px-4 py-3 text-[13px] font-bold ${rrColor}`}>
                        {rrVal != null ? `${rrVal.toFixed(2)}R` : '—'}
                      </td>
                      {/* P&L */}
                      <td className={`px-4 py-3 text-[13px] font-bold ${t.pnl_net >= 0 ? 'text-green' : 'text-red'}`}>
                        {fmtPnl(t.pnl_net)}
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge
                          variant={t.status === 'win' ? 'win' : t.status === 'loss' ? 'loss' : 'open'}
                          label={t.status.toUpperCase()}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
