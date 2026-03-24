import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { Badge } from '../components/ui/Badge'
import { fmtPnl, fmtDate, fmtDuration } from '../lib/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

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

type PeriodFilter = 'today' | 'week' | 'month' | 'all'
type DirectionFilter = 'all' | 'buy' | 'sell'
type ResultFilter = 'all' | 'win' | 'loss'
type SortKey = 'open_time' | 'symbol' | 'pnl_net' | 'rr_realized' | 'duration_min' | 'lots'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPeriodDates(period: PeriodFilter): { from?: string; to?: string } {
  if (period === 'all') return {}

  const now = new Date()
  const from = new Date(now)

  if (period === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (period === 'week') {
    const day = from.getDay()
    const diff = day === 0 ? 6 : day - 1
    from.setDate(from.getDate() - diff)
    from.setHours(0, 0, 0, 0)
  } else if (period === 'month') {
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  }

  return { from: from.toISOString(), to: now.toISOString() }
}

function buildQuery(
  accountId: string,
  periodFilter: PeriodFilter,
  symbol: string,
  direction: DirectionFilter,
  result: ResultFilter,
  offset: number,
): string {
  const params = new URLSearchParams({ account_id: accountId, limit: String(PAGE_SIZE), offset: String(offset) })
  const { from, to } = getPeriodDates(periodFilter)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (symbol.trim()) params.set('symbol', symbol.trim().toUpperCase())
  if (direction !== 'all') params.set('direction', direction)
  if (result !== 'all') params.set('result', result)
  return `/api/trades?${params.toString()}`
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function sortTrades(trades: Trade[], key: SortKey, dir: SortDir): Trade[] {
  return [...trades].sort((a, b) => {
    let av: number | string, bv: number | string
    if (key === 'open_time') { av = a.open_time; bv = b.open_time }
    else if (key === 'symbol') { av = a.symbol; bv = b.symbol }
    else if (key === 'pnl_net') { av = a.pnl_net; bv = b.pnl_net }
    else if (key === 'rr_realized') { av = a.rr_realized ?? -Infinity; bv = b.rr_realized ?? -Infinity }
    else if (key === 'duration_min') { av = a.duration_min ?? -1; bv = b.duration_min ?? -1 }
    else { av = a.lots; bv = b.lots }

    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        active ? 'bg-dark text-white' : 'bg-card text-[#888] hover:text-dark'
      }`}
    >
      {label}
    </button>
  )
}

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
}) {
  const active = sortKey === currentKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-dark transition-colors"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            {currentDir === 'asc' ? (
              <path d="M8 3l4 6H4l4-6z" />
            ) : (
              <path d="M8 13L4 7h8l-4 6z" />
            )}
          </svg>
        )}
      </span>
    </th>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Journal() {
  const navigate = useNavigate()
  const { activeAccountId } = useAccountStore()

  // Filters
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [symbolInput, setSymbolInput] = useState('')
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')

  // Data
  const [trades, setTrades] = useState<Trade[]>([])
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('open_time')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Debounce symbol input
  const symbolDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSymbol, setDebouncedSymbol] = useState('')

  useEffect(() => {
    if (symbolDebounce.current) clearTimeout(symbolDebounce.current)
    symbolDebounce.current = setTimeout(() => setDebouncedSymbol(symbolInput), 400)
    return () => {
      if (symbolDebounce.current) clearTimeout(symbolDebounce.current)
    }
  }, [symbolInput])

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0)
    setTrades([])
  }, [periodFilter, debouncedSymbol, directionFilter, resultFilter])

  const fetchTrades = useCallback(
    async (currentOffset: number, append = false) => {
      if (!activeAccountId) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      const url = buildQuery(activeAccountId, periodFilter, debouncedSymbol, directionFilter, resultFilter, currentOffset)

      try {
        const data = await api.get<Trade[]>(url)
        if (append) {
          setTrades((prev) => [...prev, ...data])
        } else {
          setTrades(data)
          setTotalCount(null)
        }
        setHasMore(data.length === PAGE_SIZE)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [activeAccountId, periodFilter, debouncedSymbol, directionFilter, resultFilter],
  )

  useEffect(() => {
    fetchTrades(0, false)
  }, [fetchTrades])

  function handleLoadMore() {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchTrades(next, true)
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = sortTrades(trades, sortKey, sortDir)

  function exportCSV() {
    if (sorted.length === 0) return
    const headers = ['Symbol','Direction','Open Time','Close Time','Open Price','Close Price','Lots','PnL Net','R:R','Duration (min)','Session','Status','Note']
    const rows = sorted.map((t) => [
      t.symbol, t.type,
      t.open_time ? new Date(t.open_time).toLocaleString('fr-FR') : '',
      t.close_time ? new Date(t.close_time).toLocaleString('fr-FR') : '',
      t.open_price, t.close_price, t.lots,
      t.pnl_net, t.rr_realized ?? '', t.duration_min ?? '',
      t.session ?? '', t.status, (t.note ?? '').replace(/"/g, '""'),
    ])
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `trades_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  // ── No account ──────────────────────────────────────────────────────────────

  if (!activeAccountId) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-subtle flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-[#888]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div>
          <p className="text-dark font-semibold">Aucun compte selectionne</p>
          <p className="text-[#888] text-sm mt-1">Configurez un compte pour voir vos trades</p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="px-4 py-2 bg-dark text-white text-sm font-medium rounded-xl hover:bg-dark/80 transition-colors"
        >
          Aller aux parametres
        </button>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Topbar */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-extrabold text-dark">Journal</h1>
        {!loading && (
          <span className="px-2 py-0.5 bg-subtle text-[#888] text-xs font-semibold rounded-full">
            {trades.length}{hasMore ? '+' : ''} trades
          </span>
        )}
        <button
          onClick={exportCSV}
          disabled={sorted.length === 0}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card text-muted text-xs font-medium hover:text-dark hover:bg-subtle transition-all disabled:opacity-40"
          title="Exporter en CSV"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl p-4 space-y-3">
        {/* Period */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#999] w-16">Periode</span>
          <div className="flex gap-1.5 flex-wrap">
            {(
              [
                { value: 'today', label: "Aujourd'hui" },
                { value: 'week', label: 'Cette semaine' },
                { value: 'month', label: 'Ce mois' },
                { value: 'all', label: 'Tout' },
              ] as { value: PeriodFilter; label: string }[]
            ).map((opt) => (
              <FilterPill
                key={opt.value}
                label={opt.label}
                active={periodFilter === opt.value}
                onClick={() => setPeriodFilter(opt.value)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Symbol */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#999] w-16">Paire</span>
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              placeholder="Ex: EURUSD"
              className="h-8 px-3 text-xs rounded-lg bg-subtle border-0 outline-none focus:ring-1 focus:ring-dark/20 text-dark placeholder-[#bbb] w-28 font-medium uppercase"
            />
          </div>

          {/* Direction */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#999] w-16">Direction</span>
            <div className="flex gap-1.5">
              {(
                [
                  { value: 'all', label: 'Toutes' },
                  { value: 'buy', label: 'BUY' },
                  { value: 'sell', label: 'SELL' },
                ] as { value: DirectionFilter; label: string }[]
              ).map((opt) => (
                <FilterPill
                  key={opt.value}
                  label={opt.label}
                  active={directionFilter === opt.value}
                  onClick={() => setDirectionFilter(opt.value)}
                />
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#999] w-16">Resultat</span>
            <div className="flex gap-1.5">
              {(
                [
                  { value: 'all', label: 'Tous' },
                  { value: 'win', label: 'WIN' },
                  { value: 'loss', label: 'LOSS' },
                ] as { value: ResultFilter; label: string }[]
              ).map((opt) => (
                <FilterPill
                  key={opt.value}
                  label={opt.label}
                  active={resultFilter === opt.value}
                  onClick={() => setResultFilter(opt.value)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red/5 border border-red/20 rounded-xl px-4 py-3 text-sm text-red flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => fetchTrades(0, false)} className="text-xs font-semibold underline">
            Reessayer
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-subtle">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="px-5 py-3.5 animate-pulse flex items-center gap-4">
                <div className="h-3 w-16 bg-subtle rounded" />
                <div className="h-5 w-10 bg-subtle rounded-full" />
                <div className="flex-1 h-3 bg-subtle rounded" />
                <div className="h-3 w-14 bg-subtle rounded" />
                <div className="h-3 w-12 bg-subtle rounded" />
                <div className="h-5 w-10 bg-subtle rounded-full" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[#888] text-sm">Aucun trade ne correspond aux filtres</p>
            <button
              onClick={() => {
                setPeriodFilter('all')
                setSymbolInput('')
                setDirectionFilter('all')
                setResultFilter('all')
              }}
              className="mt-3 text-xs text-dark font-semibold underline"
            >
              Reinitialiser les filtres
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-subtle">
                  <SortHeader label="Paire" sortKey="symbol" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap">
                    Direction
                  </th>
                  <SortHeader label="Entree" sortKey="open_time" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap">
                    Sortie
                  </th>
                  <SortHeader label="Lots" sortKey="lots" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="P&L" sortKey="pnl_net" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="R:R" sortKey="rr_realized" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Duree" sortKey="duration_min" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-[#999] uppercase tracking-wider whitespace-nowrap">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {sorted.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/journal/${t.id}`)}
                    className="hover:bg-surface cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-sm font-semibold text-dark">{t.symbol}</td>
                    <td className="px-5 py-3">
                      <Badge variant={t.type === 'buy' ? 'buy' : 'sell'} label={t.type.toUpperCase()} />
                    </td>
                    <td className="px-5 py-3 text-sm text-[#888] whitespace-nowrap">{fmtDate(t.open_time)}</td>
                    <td className="px-5 py-3 text-sm text-[#888] whitespace-nowrap">{fmtDate(t.close_time)}</td>
                    <td className="px-5 py-3 text-sm text-[#888]">{t.lots}</td>
                    <td className={`px-5 py-3 text-sm font-bold ${t.pnl_net >= 0 ? 'text-green' : 'text-red'}`}>
                      {fmtPnl(t.pnl_net)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[#888]">
                      {t.rr_realized != null ? t.rr_realized.toFixed(2) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-[#888]">{fmtDuration(t.duration_min)}</td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={t.status === 'win' ? 'win' : t.status === 'loss' ? 'loss' : 'neutral'}
                        label={t.status.toUpperCase()}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="px-5 py-4 border-t border-subtle text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-5 py-2 text-sm font-medium text-dark border border-subtle rounded-xl hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <span className="w-3 h-3 border-2 border-dark border-t-transparent rounded-full animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    'Charger plus'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer count */}
      {!loading && sorted.length > 0 && (
        <p className="text-center text-xs text-[#bbb]">
          {sorted.length} trade{sorted.length > 1 ? 's' : ''} affiches{hasMore ? ' (plus disponibles)' : ''}
        </p>
      )}
    </div>
  )
}
