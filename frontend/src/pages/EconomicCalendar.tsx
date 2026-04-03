import { useState, useEffect, useMemo } from 'react'
import { api } from '../lib/api'

interface EcoEvent {
  actual: number | null
  country: string
  estimate: number | null
  event: string
  impact: 'high' | 'medium' | 'low' | string
  prev: number | null
  time: string   // "2024-01-11 13:30:00" UTC
  unit: string
}

const COUNTRY_META: Record<string, { flag: string; currency: string }> = {
  US:  { flag: '🇺🇸', currency: 'USD' },
  EU:  { flag: '🇪🇺', currency: 'EUR' },
  EMU: { flag: '🇪🇺', currency: 'EUR' },
  DE:  { flag: '🇩🇪', currency: 'EUR' },
  FR:  { flag: '🇫🇷', currency: 'EUR' },
  IT:  { flag: '🇮🇹', currency: 'EUR' },
  ES:  { flag: '🇪🇸', currency: 'EUR' },
  GB:  { flag: '🇬🇧', currency: 'GBP' },
  JP:  { flag: '🇯🇵', currency: 'JPY' },
  CH:  { flag: '🇨🇭', currency: 'CHF' },
  AU:  { flag: '🇦🇺', currency: 'AUD' },
  CA:  { flag: '🇨🇦', currency: 'CAD' },
  NZ:  { flag: '🇳🇿', currency: 'NZD' },
  CN:  { flag: '🇨🇳', currency: 'CNY' },
  KR:  { flag: '🇰🇷', currency: 'KRW' },
  IN:  { flag: '🇮🇳', currency: 'INR' },
  BR:  { flag: '🇧🇷', currency: 'BRL' },
}

const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'NZD', 'CNY']

function getFlag(country: string) {
  return COUNTRY_META[country]?.flag ?? '🌐'
}
function getCurrency(country: string) {
  return COUNTRY_META[country]?.currency ?? country
}

function getWeekBounds(offset = 0): { from: string; to: string; label: string } {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)

  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const dayFmt = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

  const label =
    offset === 0 ? 'Cette semaine' :
    offset === -1 ? 'Semaine passée' :
    offset === 1 ? 'Semaine prochaine' :
    `${dayFmt(monday)} – ${dayFmt(friday)}`

  return { from: fmt(monday), to: fmt(friday), label }
}

function fmtTime(utcStr: string) {
  try {
    const d = new Date(utcStr.replace(' ', 'T') + 'Z')
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch { return '--:--' }
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function fmtValue(val: number | null, unit: string) {
  if (val == null) return '—'
  const s = unit === '%' ? `${val}%` : unit === 'M' ? `${val}M` : unit === 'K' ? `${val}K` : `${val}${unit ? ' ' + unit : ''}`
  return s
}

const IMPACT_STYLES = {
  high:   { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',   label: 'Élevé'  },
  medium: { dot: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400', label: 'Moyen'  },
  low:    { dot: 'bg-gray-300',   badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', label: 'Faible' },
}

function impactStyle(impact: string) {
  return IMPACT_STYLES[impact as keyof typeof IMPACT_STYLES] ?? IMPACT_STYLES.low
}

export default function EconomicCalendar() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [events, setEvents] = useState<EcoEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [currencyFilter, setCurrencyFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const week = useMemo(() => getWeekBounds(weekOffset), [weekOffset])

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.get<EcoEvent[]>(`/api/eco-calendar?from=${week.from}&to=${week.to}`)
      .then((data) => setEvents(data ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [week.from, week.to])

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (impactFilter !== 'all' && ev.impact !== impactFilter) return false
      if (currencyFilter !== 'all' && getCurrency(ev.country) !== currencyFilter) return false
      if (search && !ev.event.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [events, impactFilter, currencyFilter, search])

  const byDate = useMemo(() => {
    const map: Record<string, EcoEvent[]> = {}
    filtered.forEach((ev) => {
      const date = ev.time.split(' ')[0]
      if (!map[date]) map[date] = []
      map[date].push(ev)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const counts = useMemo(() => ({
    high:   events.filter((e) => e.impact === 'high').length,
    medium: events.filter((e) => e.impact === 'medium').length,
    low:    events.filter((e) => e.impact === 'low').length,
  }), [events])

  const noApiKey = error?.includes('FINNHUB')

  return (
    <div className="p-4 md:p-6 space-y-4">

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-dark">Calendrier Économique</h1>
          {!loading && !error && events.length > 0 && (
            <p className="text-xs text-muted mt-0.5">
              <span className="text-red-500 font-semibold">{counts.high}</span> élevé ·{' '}
              <span className="text-orange-500 font-semibold">{counts.medium}</span> moyen ·{' '}
              <span className="text-muted font-semibold">{counts.low}</span> faible
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 bg-subtle rounded-xl p-1">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted hover:text-dark"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              weekOffset === 0 ? 'bg-dark text-white' : 'text-muted hover:text-dark'
            }`}
          >
            {week.label}
          </button>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted hover:text-dark"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">

        <div className="flex items-center gap-1.5 bg-subtle rounded-xl p-1 self-start">
          {(['all', 'high', 'medium', 'low'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setImpactFilter(lvl)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                impactFilter === lvl
                  ? 'bg-card text-dark shadow-sm'
                  : 'text-muted hover:text-dark'
              }`}
            >
              {lvl !== 'all' && (
                <span className={`w-2 h-2 rounded-full ${impactStyle(lvl).dot}`} />
              )}
              {lvl === 'all' ? 'Tous' : impactStyle(lvl).label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setCurrencyFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currencyFilter === 'all'
                ? 'bg-dark text-white'
                : 'bg-subtle text-muted hover:text-dark'
            }`}
          >
            Toutes
          </button>
          {MAJOR_CURRENCIES.map((cur) => (
            <button
              key={cur}
              onClick={() => setCurrencyFilter(currencyFilter === cur ? 'all' : cur)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currencyFilter === cur
                  ? 'bg-dark text-white'
                  : 'bg-subtle text-muted hover:text-dark'
              }`}
            >
              {cur}
            </button>
          ))}
        </div>

        <div className="relative sm:ml-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher un événement..."
            className="bg-subtle border-0 rounded-xl pl-8 pr-3 py-2 text-xs text-dark placeholder-muted outline-none focus:ring-1 focus:ring-dark/20 w-full sm:w-52"
          />
        </div>
      </div>

      {noApiKey && (
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-sm font-semibold text-dark mb-2">🔑 Clé API Finnhub requise</p>
          <p className="text-xs text-muted leading-relaxed mb-3">
            Le calendrier économique utilise l'API gratuite de Finnhub.
          </p>
          <ol className="text-xs text-dark space-y-1.5 mb-4">
            <li>1. Va sur <strong>finnhub.io</strong> → crée un compte gratuit</li>
            <li>2. Copie ta clé API (Dashboard → API key)</li>
            <li>3. Ajoute dans Vercel : <code className="bg-subtle px-1.5 py-0.5 rounded font-mono">FINNHUB_API_KEY = ta_clé</code></li>
            <li>4. Redéploie (ou ça se fait automatiquement)</li>
          </ol>
          <p className="text-xs text-muted">Tier gratuit : 60 requêtes/minute, suffisant pour cet usage.</p>
        </div>
      )}

      {error && !noApiKey && (
        <div className="bg-card border border-border rounded-xl p-4 border-red-200 dark:border-red-900">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="h-4 w-40 bg-subtle rounded animate-pulse" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex gap-3">
                  <div className="h-8 w-12 bg-subtle rounded animate-pulse" />
                  <div className="h-8 flex-1 bg-subtle rounded animate-pulse" />
                  <div className="h-8 w-20 bg-subtle rounded animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && events.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm">Aucun événement correspondant aux filtres.</p>
          <button
            onClick={() => { setImpactFilter('all'); setCurrencyFilter('all'); setSearch('') }}
            className="mt-3 text-xs font-semibold text-dark underline"
          >
            Réinitialiser les filtres
          </button>
        </div>
      )}

      {!loading && !error && events.length === 0 && !noApiKey && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted text-sm">Aucun événement économique cette semaine.</p>
        </div>
      )}

      {!loading && byDate.map(([date, dayEvents]) => (
        <div key={date} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-subtle bg-subtle/40">
            <p className="text-xs font-bold text-dark capitalize">{fmtDate(date)}</p>
          </div>

          <div className="divide-y divide-subtle">
            {dayEvents.map((ev, idx) => {
              const style = impactStyle(ev.impact)
              const hasActual = ev.actual != null
              const deviation = hasActual && ev.estimate != null
                ? ev.actual! - ev.estimate!
                : null

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-3 px-4 py-3 ${hasActual ? '' : 'opacity-90'}`}
                >
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5 w-10">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${style.dot}`} />
                    <span className="text-[10px] text-muted font-mono leading-none">
                      {fmtTime(ev.time)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base leading-none">{getFlag(ev.country)}</span>
                      <span className="text-[11px] font-bold text-muted">{getCurrency(ev.country)}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-dark mt-0.5 truncate">{ev.event}</p>
                  </div>

                  <div className="flex items-start gap-3 flex-shrink-0 text-right">
                    <div>
                      <p className="text-[9px] text-muted font-medium uppercase mb-0.5">Préc.</p>
                      <p className="text-xs font-semibold text-dark">{fmtValue(ev.prev, ev.unit)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted font-medium uppercase mb-0.5">Prévi.</p>
                      <p className="text-xs font-semibold text-dark">{fmtValue(ev.estimate, ev.unit)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted font-medium uppercase mb-0.5">Réel</p>
                      {hasActual ? (
                        <div>
                          <p className={`text-xs font-bold ${
                            deviation === null ? 'text-dark' :
                            deviation > 0 ? 'text-green-600 dark:text-green-400' :
                            deviation < 0 ? 'text-red-500 dark:text-red-400' :
                            'text-dark'
                          }`}>
                            {fmtValue(ev.actual, ev.unit)}
                          </p>
                          {deviation !== null && deviation !== 0 && (
                            <p className={`text-[9px] font-semibold ${deviation > 0 ? 'text-green-500' : 'text-red-400'}`}>
                              {deviation > 0 ? '▲' : '▼'} {Math.abs(deviation).toFixed(1)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">—</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

    </div>
  )
}
