import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { fmtPnl } from '../lib/formatters'

interface DayData {
  date: string   // "YYYY-MM-DD"
  pnl: number
}

interface CalendarDay {
  date: Date
  dateStr: string          // "YYYY-MM-DD"
  dayNum: number
  isCurrentMonth: boolean
  isToday: boolean
  data: DayData | null
}

const WEEKDAY_HEADERS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

function toYYYYMM(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function toYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Returns ISO weekday index 0=Mon…6=Sun for a given Date
function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7
}

function buildCalendarGrid(year: number, month: number, dataMap: Record<string, DayData>): CalendarDay[][] {
  const today = toYYYYMMDD(new Date())
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Pad start to Monday
  const startOffset = isoWeekday(firstDay)
  const gridStart = new Date(firstDay)
  gridStart.setDate(gridStart.getDate() - startOffset)

  // Pad end to Sunday (complete last row)
  const endOffset = 6 - isoWeekday(lastDay)
  const gridEnd = new Date(lastDay)
  gridEnd.setDate(gridEnd.getDate() + endOffset)

  const weeks: CalendarDay[][] = []
  const cursor = new Date(gridStart)

  while (cursor <= gridEnd) {
    const week: CalendarDay[] = []
    for (let i = 0; i < 7; i++) {
      const dateStr = toYYYYMMDD(cursor)
      week.push({
        date: new Date(cursor),
        dateStr,
        dayNum: cursor.getDate(),
        isCurrentMonth: cursor.getMonth() === month,
        isToday: dateStr === today,
        data: dataMap[dateStr] ?? null,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }

  return weeks
}

export default function Calendar() {
  const { activeAccountId } = useAccountStore()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed

  const [dayData, setDayData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCalendar = useCallback(() => {
    if (!activeAccountId) return
    setLoading(true)
    setError(null)
    const ym = toYYYYMM(year, month)
    api
      .get<DayData[]>(`/api/stats/calendar?account_id=${activeAccountId}&month=${ym}`)
      .then(setDayData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [activeAccountId, year, month])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar])

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const dataMap: Record<string, DayData> = {}
  for (const d of dayData) {
    dataMap[d.date] = d
  }

  const weeks = buildCalendarGrid(year, month, dataMap)

  // Summary stats
  const monthDays = dayData.filter((d) => {
    const ym = d.date.slice(0, 7)
    return ym === toYYYYMM(year, month)
  })
  const tradingDays = monthDays.length
  const winDays = monthDays.filter((d) => d.pnl > 0).length
  const lossDays = monthDays.filter((d) => d.pnl < 0).length
  const totalPnl = monthDays.reduce((acc, d) => acc + d.pnl, 0)

  if (!activeAccountId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-[#111]">Calendrier</h1>
        <p className="text-[#888] text-sm mt-4">Sélectionnez un compte pour voir le calendrier.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header + month navigation */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[#111]">Calendrier</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm hover:bg-[#f5f5f5] transition-colors text-[#111]"
            aria-label="Mois précédent"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-[#111] w-36 text-center">
            {MONTH_NAMES_FR[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm hover:bg-[#f5f5f5] transition-colors text-[#111]"
            aria-label="Mois suivant"
          >
            ›
          </button>
        </div>
      </div>

      {/* Calendar card */}
      <div className="bg-card rounded-2xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-[#f0f0f0]">
          {WEEKDAY_HEADERS.map((d) => (
            <div
              key={d}
              className="py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-[#888]"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div
                key={i}
                className="h-20 border-b border-r border-[#f5f5f5] animate-pulse bg-[#fafafa]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-5 text-[#ef4444] text-sm">Erreur : {error}</div>
        ) : (
          <div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-[#f0f0f0] last:border-b-0">
                {week.map((day) => {
                  const hasTrade = day.isCurrentMonth && day.data !== null
                  const isPos = hasTrade && day.data!.pnl > 0
                  const isNeg = hasTrade && day.data!.pnl < 0

                  return (
                    <div
                      key={day.dateStr}
                      className={[
                        'relative h-12 md:h-20 p-1 md:p-2 border-r border-border last:border-r-0 transition-colors',
                        day.isCurrentMonth ? 'bg-white' : 'bg-[#fafafa]',
                        day.isToday ? 'ring-2 ring-inset ring-[#111]' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {/* Day number */}
                      <span
                        className={[
                          'text-xs font-semibold',
                          day.isToday
                            ? 'text-[#111]'
                            : day.isCurrentMonth
                            ? 'text-[#111]'
                            : 'text-[#ccc]',
                        ].join(' ')}
                      >
                        {day.dayNum}
                      </span>

                      {/* P&L amount */}
                      {hasTrade && (
                        <div className="mt-1">
                          <span
                            className="text-xs font-semibold block leading-tight"
                            style={{ color: isPos ? '#22c55e' : '#ef4444' }}
                          >
                            {fmtPnl(day.data!.pnl)}
                          </span>
                        </div>
                      )}

                      {/* Dot indicator */}
                      {hasTrade && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: isPos ? '#22c55e' : isNeg ? '#ef4444' : '#ccc' }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary row */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-[10px] uppercase tracking-wider text-[#888] font-medium mb-1">P&L du mois</p>
            <p
              className="text-xl font-bold"
              style={{ color: totalPnl >= 0 ? '#22c55e' : '#ef4444' }}
            >
              {tradingDays > 0 ? fmtPnl(totalPnl) : '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-[10px] uppercase tracking-wider text-[#888] font-medium mb-1">Jours tradés</p>
            <p className="text-xl font-bold text-[#111]">{tradingDays}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-[10px] uppercase tracking-wider text-[#888] font-medium mb-1">Jours positifs</p>
            <p className="text-xl font-bold text-[#22c55e]">{winDays}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <p className="text-[10px] uppercase tracking-wider text-[#888] font-medium mb-1">Jours négatifs</p>
            <p className="text-xl font-bold text-[#ef4444]">{lossDays}</p>
          </div>
        </div>
      )}
    </div>
  )
}
