import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { fmtPnl } from '../../lib/formatters'

interface SearchResult {
  id: string
  symbol: string
  type: string
  profit: number
  open_time: string
}

interface Props {
  onClose: () => void
}

export function GlobalSearch({ onClose }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Debounced search
  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.get<SearchResult[]>(`/api/trades/search?q=${encodeURIComponent(q)}`)
        setResults(data)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  function go(id: string) {
    navigate(`/journal/${id}`)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-16 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-[560px] z-50 bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-muted flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un trade (symbole, note...)"
            className="flex-1 bg-transparent text-dark text-sm outline-none placeholder-muted"
          />
          {loading && (
            <span className="w-4 h-4 border border-muted border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <kbd
            onClick={onClose}
            className="text-[11px] text-muted px-2 py-1 bg-subtle rounded-lg cursor-pointer flex-shrink-0"
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {q.length < 2 && (
            <p className="text-xs text-muted text-center py-8">Tapez au moins 2 caractères...</p>
          )}
          {q.length >= 2 && !loading && results.length === 0 && (
            <p className="text-xs text-muted text-center py-8">Aucun résultat pour « {q} »</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => go(r.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-subtle transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    r.type === 'buy' ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                  }`}
                >
                  {r.type.toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-dark">{r.symbol}</span>
                <span className="text-xs text-muted">
                  {new Date(r.open_time).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <span className={`text-sm font-bold ${r.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmtPnl(r.profit)}
              </span>
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-border bg-subtle/50">
            <p className="text-[11px] text-muted">
              {results.length} résultat{results.length > 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </>
  )
}
