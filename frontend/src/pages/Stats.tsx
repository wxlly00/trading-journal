import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { fmtPnl, fmtPct } from '../lib/formatters'

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

interface SessionStat {
  session: string
  pnl: number
  win_rate: number
  trades: number
}

interface Streaks {
  max_win_streak: number
  max_loss_streak: number
  current_win: number
  current_loss: number
}

interface HeatmapCell {
  weekday: number
  hour: number
  pnl: number
  count: number
}

const SESSION_LABELS: Record<string, string> = {
  asia: 'Asie',
  london: 'London Open',
  overlap: 'Overlap',
  ny: 'New York',
  off: 'Off-hours',
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface TooltipState {
  weekday: number
  hour: number
  pnl: number
  count: number
  x: number
  y: number
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-card rounded-2xl p-5">
      <p className="text-[#888] text-xs font-medium uppercase tracking-wide mb-2">{label}</p>
      <p
        className="text-2xl font-bold"
        style={{ color: color ?? '#111' }}
      >
        {value}
      </p>
    </div>
  )
}

export default function Stats() {
  const { activeAccountId } = useAccountStore()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [sessions, setSessions] = useState<SessionStat[]>([])
  const [streaks, setStreaks] = useState<Streaks | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const heatmapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeAccountId) return
    setLoading(true)
    setError(null)

    const q = `account_id=${activeAccountId}`

    Promise.all([
      api.get<Summary>(`/api/stats/summary?${q}`),
      api.get<SessionStat[]>(`/api/stats/by-session?${q}`),
      api.get<Streaks>(`/api/stats/streaks?${q}`),
      api.get<HeatmapCell[]>(`/api/stats/heatmap?${q}`),
    ])
      .then(([s, sess, str, hm]) => {
        setSummary(s)
        setSessions(sess)
        setStreaks(str)
        setHeatmap(hm)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeAccountId])

  // Build 5×24 grid: grid[weekday][hour] = cell or null
  const grid: (HeatmapCell | null)[][] = Array.from({ length: 5 }, () =>
    Array(24).fill(null)
  )
  for (const cell of heatmap) {
    if (cell.weekday >= 0 && cell.weekday <= 4 && cell.hour >= 0 && cell.hour <= 23) {
      grid[cell.weekday][cell.hour] = cell
    }
  }

  const maxAbsPnl = Math.max(...heatmap.map((c) => Math.abs(c.pnl)), 1)

  function cellColor(cell: HeatmapCell | null): string {
    if (!cell || cell.count === 0) return '#f0f0f0'
    const intensity = Math.min(Math.abs(cell.pnl) / maxAbsPnl, 1)
    const alpha = 0.2 + intensity * 0.8
    if (cell.pnl > 0) return `rgba(34,197,94,${alpha})`
    return `rgba(239,68,68,${alpha})`
  }

  function handleCellMouseEnter(
    e: React.MouseEvent<HTMLDivElement>,
    cell: HeatmapCell | null,
    weekday: number,
    hour: number
  ) {
    if (!cell || cell.count === 0) {
      setTooltip(null)
      return
    }
    const rect = (e.target as HTMLDivElement).getBoundingClientRect()
    const parentRect = heatmapRef.current?.getBoundingClientRect()
    setTooltip({
      weekday,
      hour,
      pnl: cell.pnl,
      count: cell.count,
      x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
      y: rect.top - (parentRect?.top ?? 0) - 8,
    })
  }

  const sessionMax = Math.max(...sessions.map((s) => Math.abs(s.pnl)), 1)

  if (!activeAccountId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Statistiques</h1>
        <p className="text-[#888] text-sm mt-4">Sélectionnez un compte pour voir les statistiques.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Statistiques</h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 animate-pulse h-48" />
          <div className="bg-white rounded-2xl p-5 animate-pulse h-48" />
        </div>
        <div className="bg-white rounded-2xl p-5 animate-pulse h-56" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Statistiques</h1>
        <div className="mt-6 bg-white rounded-2xl p-5 text-[#ef4444]">Erreur : {error}</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-extrabold text-dark">Statistiques</h1>

      {/* Row 1 — 6 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Gain moyen"
          value={fmtPnl(summary?.avg_win)}
          color="#22c55e"
        />
        <StatCard
          label="Perte moyenne"
          value={fmtPnl(summary?.avg_loss)}
          color="#ef4444"
        />
        <StatCard
          label="Profit Factor"
          value={summary?.profit_factor != null ? summary.profit_factor.toFixed(2) : '—'}
          color={
            summary?.profit_factor != null
              ? summary.profit_factor >= 1.5
                ? '#22c55e'
                : summary.profit_factor >= 1
                ? '#111'
                : '#ef4444'
              : '#111'
          }
        />
        <StatCard
          label="Espérance"
          value={fmtPnl(summary?.expected_value)}
          color={
            summary?.expected_value != null
              ? summary.expected_value >= 0
                ? '#22c55e'
                : '#ef4444'
              : '#111'
          }
        />
        <StatCard
          label="Sharpe Ratio"
          value={summary?.sharpe != null ? summary.sharpe.toFixed(2) : '—'}
          color={
            summary?.sharpe != null
              ? summary.sharpe >= 1
                ? '#22c55e'
                : summary.sharpe >= 0
                ? '#111'
                : '#ef4444'
              : '#111'
          }
        />
        <StatCard
          label="Max Drawdown"
          value={summary?.max_drawdown_pct != null ? fmtPct(-summary.max_drawdown_pct) : '—'}
          color="#ef4444"
        />
      </div>

      {/* Row 2 — Sessions + Streaks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sessions */}
        <div className="bg-card rounded-2xl p-5">
          <p className="text-[#111] font-semibold mb-4">Sessions de trading</p>
          <div className="space-y-3">
            {sessions
              .filter((s) => s.session !== 'off')
              .map((s) => {
                const pct = (Math.abs(s.pnl) / sessionMax) * 100
                const isPos = s.pnl >= 0
                return (
                  <div key={s.session}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-[#111]">
                        {SESSION_LABELS[s.session] ?? s.session}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-[#888]">
                        <span>{s.trades} trades</span>
                        <span>{fmtPct(s.win_rate * 100)} WR</span>
                        <span
                          className="font-semibold text-sm"
                          style={{ color: isPos ? '#22c55e' : '#ef4444' }}
                        >
                          {fmtPnl(s.pnl)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[#f5f5f5] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isPos ? '#22c55e' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            {sessions.length === 0 && (
              <p className="text-[#888] text-sm">Aucune donnée de session.</p>
            )}
          </div>
        </div>

        {/* Streaks */}
        <div className="bg-card rounded-2xl p-5">
          <p className="text-[#111] font-semibold mb-4">Séries</p>
          {streaks ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col items-center justify-center bg-[#f5f5f5] rounded-xl p-4">
                <p className="text-4xl font-black text-[#22c55e]">{streaks.max_win_streak}</p>
                <p className="text-xs text-[#888] mt-2 text-center">Max gains consécutifs</p>
              </div>
              <div className="flex flex-col items-center justify-center bg-[#f5f5f5] rounded-xl p-4">
                <p className="text-4xl font-black text-[#ef4444]">{streaks.max_loss_streak}</p>
                <p className="text-xs text-[#888] mt-2 text-center">Max pertes consécutives</p>
              </div>
              <div className="flex flex-col items-center justify-center bg-[#f5f5f5] rounded-xl p-4">
                <p className="text-4xl font-black" style={{ color: streaks.current_win > 0 ? '#22c55e' : '#999' }}>
                  {streaks.current_win}
                </p>
                <p className="text-xs text-[#888] mt-2 text-center">Streak win actuel</p>
              </div>
              <div className="flex flex-col items-center justify-center bg-[#f5f5f5] rounded-xl p-4">
                <p className="text-4xl font-black" style={{ color: streaks.current_loss > 0 ? '#ef4444' : '#999' }}>
                  {streaks.current_loss}
                </p>
                <p className="text-xs text-[#888] mt-2 text-center">Streak loss actuel</p>
              </div>
            </div>
          ) : (
            <p className="text-[#888] text-sm">Aucune donnée de série.</p>
          )}
        </div>
      </div>

      {/* Row 3 — Heatmap */}
      <div className="bg-card rounded-2xl p-5 overflow-x-auto">
        <p className="text-[#111] font-semibold mb-4">Heatmap horaire</p>
        <div ref={heatmapRef} className="relative" style={{ minWidth: 680 }}>
          {/* Hour labels */}
          <div className="flex ml-10 mb-1">
            {HOURS.map((h) => (
              <div
                key={h}
                className="text-center text-[10px] text-[#999] font-medium"
                style={{ width: `${100 / 24}%` }}
              >
                {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {WEEKDAY_LABELS.map((day, wi) => (
            <div key={wi} className="flex items-center mb-0.5">
              <div className="w-10 text-[11px] text-[#888] font-medium shrink-0">{day}</div>
              <div className="flex flex-1 gap-0.5">
                {HOURS.map((h) => {
                  const cell = grid[wi][h]
                  return (
                    <div
                      key={h}
                      className="rounded-sm cursor-default transition-transform hover:scale-110"
                      style={{
                        flex: 1,
                        height: 24,
                        backgroundColor: cellColor(cell),
                      }}
                      onMouseEnter={(e) => handleCellMouseEnter(e, cell, wi, h)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  )
                })}
              </div>
            </div>
          ))}

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none z-10 bg-[#111] text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
              style={{
                left: tooltip.x,
                top: tooltip.y,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="font-semibold">
                {WEEKDAY_LABELS[tooltip.weekday]} {String(tooltip.hour).padStart(2, '0')}h00
              </div>
              <div className="mt-0.5" style={{ color: tooltip.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                {fmtPnl(tooltip.pnl)}
              </div>
              <div className="text-[#999]">{tooltip.count} trade{tooltip.count > 1 ? 's' : ''}</div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 ml-10">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#22c55e]" />
            <span className="text-[11px] text-[#888]">Positif</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#ef4444]" />
            <span className="text-[11px] text-[#888]">Négatif</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#f0f0f0]" />
            <span className="text-[11px] text-[#888]">Vide</span>
          </div>
        </div>
      </div>
    </div>
  )
}
