import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { Badge } from '../components/ui/Badge'
import { TradingViewWidget } from '../components/ui/TradingViewWidget'
import { fmtPnl, fmtDatetime, fmtPrice, fmtDuration } from '../lib/formatters'

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
  tags: string[] | null
  screenshot_url?: string | null
  psy_score?: number | null
}

const PRESET_TAGS = ['Setup A', 'Setup B', 'Breakout', 'Reversal', 'Scalp'] as const

// ─── PSY face icons (SVG, no emojis) ─────────────────────────────────────────

const PSY_FACES = [
  {
    score: 1,
    label: 'Très mauvais',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#ff3b30' : 'currentColor'} strokeWidth="1.5" className="w-7 h-7 mx-auto">
        <circle cx="12" cy="12" r="10"/>
        <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
        <path d="M9.5 9.5c0-1 1.5-1.5 2.5-1.5"/>
      </svg>
    ),
  },
  {
    score: 2,
    label: 'Mauvais',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#ff9f0a' : 'currentColor'} strokeWidth="1.5" className="w-7 h-7 mx-auto">
        <circle cx="12" cy="12" r="10"/>
        <path d="M16 15s-1.5-1-4-1-4 1-4 1"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
  },
  {
    score: 3,
    label: 'Neutre',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#636366' : 'currentColor'} strokeWidth="1.5" className="w-7 h-7 mx-auto">
        <circle cx="12" cy="12" r="10"/>
        <line x1="8" y1="15" x2="16" y2="15"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
  },
  {
    score: 4,
    label: 'Bon',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#34c759' : 'currentColor'} strokeWidth="1.5" className="w-7 h-7 mx-auto">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    ),
  },
  {
    score: 5,
    label: 'Excellent',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#007aff' : 'currentColor'} strokeWidth="1.5" className="w-7 h-7 mx-auto">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 12s1.5 3 4 3 4-3 4-3"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
        <path d="M10 8.5c.5-.5 1-.8 2-.8s1.5.3 2 .8"/>
      </svg>
    ),
  },
]

// ─── Psy face for info grid cell ──────────────────────────────────────────────

function PsyFaceIcon({ score }: { score: number }) {
  const colors: Record<number, string> = {
    1: '#ff3b30',
    2: '#ff9f0a',
    3: '#636366',
    4: '#34c759',
    5: '#007aff',
  }
  const color = colors[score] ?? 'currentColor'
  if (score === 1) return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" width="18" height="18">
      <circle cx="12" cy="12" r="10"/>
      <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
      <path d="M9.5 9.5c0-1 1.5-1.5 2.5-1.5"/>
    </svg>
  )
  if (score === 2) return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" width="18" height="18">
      <circle cx="12" cy="12" r="10"/>
      <path d="M16 15s-1.5-1-4-1-4 1-4 1"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  )
  if (score === 3) return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" width="18" height="18">
      <circle cx="12" cy="12" r="10"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  )
  if (score === 4) return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" width="18" height="18">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  )
  // score === 5
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" width="18" height="18">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 13s1.5 3 4 3 4-3 4-3"/>
      <line x1="9" y1="9" x2="9.01" y2="9"/>
      <line x1="15" y1="9" x2="15.01" y2="9"/>
      <path d="M10 8.5c.5-.5 1-.8 2-.8s1.5.3 2 .8"/>
    </svg>
  )
}

// ─── Checklist section ────────────────────────────────────────────────────────

function ChecklistSection({ tradeId }: { tradeId: string }) {
  const [items, setItems] = useState<{ id: string; label: string }[]>([])
  const [responses, setResponses] = useState<Record<string, boolean | null>>({})

  useEffect(() => {
    Promise.all([
      api.get<{ id: string; label: string }[]>('/api/checklist/items'),
      api.get<{ item_id: string; checked: boolean }[]>(`/api/checklist/trades/${tradeId}`),
    ])
      .then(([itemsData, respData]) => {
        setItems(itemsData)
        const map: Record<string, boolean | null> = {}
        respData.forEach((r) => {
          map[r.item_id] = r.checked
        })
        setResponses(map)
      })
      .catch(() => {})
  }, [tradeId])

  if (items.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-[13px] font-bold text-dark mb-3">Checklist pré-trade</p>
      <div>
        {items.map((item) => {
          const checked = responses[item.id]
          return (
            <div
              key={item.id}
              className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-0 text-[13px] text-text2"
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  checked === true
                    ? 'bg-green border-green'
                    : checked === false
                    ? 'bg-red-bg border-red'
                    : 'border-border'
                }`}
              >
                {checked === true && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {checked === false && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3 text-red">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>
              {item.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ h }: { h?: string }) {
  return <div className={`bg-subtle rounded-xl animate-pulse ${h ?? 'h-8'}`} />
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TradeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { activeAccountId } = useAccountStore()

  const [trade, setTrade] = useState<Trade | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Note editor
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const lastSavedNote = useRef('')

  // Tag
  const [tag, setTag] = useState<string | null>(null)
  const [tagSaving, setTagSaving] = useState(false)

  // Psy score
  const [psyScore, setPsyScore] = useState<number | null>(null)
  const [psySaving, setPsySaving] = useState(false)

  // SL/TP editing
  const [slValue, setSlValue] = useState('')
  const [tpValue, setTpValue] = useState('')
  const [slTpSaving, setSlTpSaving] = useState(false)
  const [slTpSaved, setSlTpSaved] = useState(false)

  // Voice notes
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  function handleVoiceNote() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert("La reconnaissance vocale n'est pas disponible sur ce navigateur.")
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const recognition = new SR()
    recognition.lang = 'fr-FR'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript
      setNote((prev) => (prev ? prev + '\n' + transcript : transcript))
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  // Screenshot upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fetchTrade = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const qs = activeAccountId ? `?account_id=${activeAccountId}` : ''
      const data = await api.get<Trade>(`/api/trades/${id}${qs}`)
      setTrade(data)
      setNote(data.note ?? '')
      setTag(data.tags?.[0] ?? data.tag ?? null)
      setPsyScore(data.psy_score ?? null)
      setScreenshotUrl(data.screenshot_url ?? null)
      setSlValue(data.sl != null ? String(data.sl) : '')
      setTpValue(data.tp != null ? String(data.tp) : '')
      lastSavedNote.current = data.note ?? ''
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Trade introuvable')
    } finally {
      setLoading(false)
    }
  }, [id, activeAccountId])

  useEffect(() => {
    fetchTrade()
  }, [fetchTrade])

  // ── Note save on blur ────────────────────────────────────────────────────────

  async function handleNoteBlur() {
    if (!trade || note === lastSavedNote.current) return
    setNoteSaving(true)
    setNoteSaved(false)
    try {
      await api.patch<Trade>(`/api/trades/${trade.id}`, { note })
      lastSavedNote.current = note
      setNoteSaved(true)
      setTimeout(() => setNoteSaved(false), 2000)
    } catch {
      setNote(lastSavedNote.current)
    } finally {
      setNoteSaving(false)
    }
  }

  // ── Psy score ────────────────────────────────────────────────────────────────

  async function handlePsyClick(score: number) {
    if (!trade) return
    const newScore = psyScore === score ? null : score
    setPsyScore(newScore)
    setPsySaving(true)
    try {
      await api.patch<{ ok: boolean }>(`/api/trades/${trade.id}`, { psy_score: newScore })
    } catch {
      setPsyScore(psyScore)
    } finally {
      setPsySaving(false)
    }
  }

  // ── SL/TP save ────────────────────────────────────────────────────────────────

  async function handleSlTpSave() {
    if (!trade) return
    setSlTpSaving(true)
    setSlTpSaved(false)
    try {
      const payload: Record<string, number | null> = {}
      payload.sl = slValue ? parseFloat(slValue) : null
      payload.tp = tpValue ? parseFloat(tpValue) : null
      await api.patch<{ ok: boolean }>(`/api/trades/${trade.id}`, payload)
      const updated = await api.get<Trade>(`/api/trades/${trade.id}`)
      setTrade(updated)
      setSlTpSaved(true)
      setTimeout(() => setSlTpSaved(false), 2000)
    } catch {
      // ignore
    } finally {
      setSlTpSaving(false)
    }
  }

  // ── Tag toggle ───────────────────────────────────────────────────────────────

  async function handleTagClick(t: string) {
    if (!trade) return
    const newTag = tag === t ? null : t
    setTag(newTag)
    setTagSaving(true)
    try {
      await api.patch<Trade>(`/api/trades/${trade.id}`, { tag: newTag })
    } catch {
      setTag(tag)
    } finally {
      setTagSaving(false)
    }
  }

  // ── Screenshot upload ────────────────────────────────────────────────────────

  async function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setUploadError('Fichier invalide. Veuillez selectionner une image.')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setUploadError('Image trop grande (max 8 Mo).')
      return
    }

    setUploadError(null)
    const localUrl = URL.createObjectURL(file)
    setScreenshotUrl(localUrl)

    try {
      const form = new FormData()
      form.append('file', file)
      const result = await api.postForm<{ url: string }>(`/api/trades/${trade!.id}/screenshot`, form)
      setScreenshotUrl(result.url)
    } catch {
      setUploadError("Erreur lors de l'upload du screenshot.")
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-0 md:p-7">
        {/* Header skeleton */}
        <div className="bg-card border-b border-border md:rounded-xl md:border p-5 mb-0 md:mb-4">
          <div className="h-5 w-16 bg-subtle rounded-lg animate-pulse mb-3" />
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-24 bg-subtle rounded-xl animate-pulse" />
                <div className="h-5 w-10 bg-subtle rounded animate-pulse" />
                <div className="h-5 w-10 bg-subtle rounded animate-pulse" />
              </div>
              <div className="h-4 w-40 bg-subtle rounded animate-pulse" />
            </div>
            <div className="h-9 w-20 bg-subtle rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="px-4 md:px-0 space-y-3 pt-3 pb-8 md:space-y-4 md:pt-0">
          <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="bg-card p-3 space-y-2">
                <SkeletonBlock h="h-3" />
                <SkeletonBlock h="h-5" />
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <SkeletonBlock h="h-4" />
            <SkeletonBlock h="h-28" />
          </div>
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <SkeletonBlock h="h-4" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} h="h-8" />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (error || !trade) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full gap-4 text-center">
        <p className="text-red font-semibold">{error ?? 'Trade introuvable'}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-subtle text-dark text-sm font-medium rounded-xl hover:bg-subtle/80 transition-colors"
          >
            Retour
          </button>
          <button
            onClick={fetchTrade}
            className="px-4 py-2 bg-dark text-white text-sm font-medium rounded-xl hover:bg-dark/80 transition-colors"
          >
            Reessayer
          </button>
        </div>
      </div>
    )
  }

  // ── Derived values ────────────────────────────────────────────────────────────

  const pnlPositive = trade.pnl_net >= 0

  const rrValue = trade.rr_realized
  const rrGreen = rrValue != null && rrValue >= 1.5

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-0 md:p-7 space-y-0 md:space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-card border-b border-border md:rounded-xl md:border p-5">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-[16px] text-blue font-medium mb-3"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Journal
        </button>

        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[24px] font-black tracking-tight text-dark">{trade.symbol}</span>
              <Badge variant={trade.type === 'buy' ? 'buy' : 'sell'} label={trade.type.toUpperCase()} />
              <Badge
                variant={trade.status === 'win' ? 'win' : trade.status === 'loss' ? 'loss' : 'open'}
                label={trade.status.toUpperCase()}
              />
            </div>
            <p className="text-[13px] text-muted">
              {fmtDatetime(trade.open_time)}{' '}
              {trade.close_time ? `→ ${fmtDatetime(trade.close_time)}` : '→ En cours'}
            </p>
          </div>
          <p className={`text-[34px] font-black tracking-tight ${pnlPositive ? 'text-green' : 'text-red'}`}>
            {fmtPnl(trade.pnl_net)}
          </p>
        </div>
      </div>

      {/* ── Main scrollable content ──────────────────────────────────────────── */}
      <div className="px-4 md:px-0 space-y-3 pt-3 pb-8 md:space-y-4 md:pt-0">

        {/* ── Info grid 2×4 ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-px bg-border rounded-xl overflow-hidden border border-border">

          {/* Entrée */}
          <div className="bg-card p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Entrée</p>
            <p className="text-[15px] font-bold text-dark">{fmtPrice(trade.open_price)}</p>
          </div>

          {/* Sortie */}
          <div className="bg-card p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Sortie</p>
            <p className="text-[15px] font-bold text-dark">{fmtPrice(trade.close_price)}</p>
          </div>

          {/* Stop loss — editable */}
          <div className="bg-card p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Stop loss</p>
            <input
              type="number"
              step="0.00001"
              placeholder="—"
              value={slValue}
              onChange={(e) => setSlValue(e.target.value)}
              className="w-full text-[15px] font-bold text-dark bg-transparent outline-none border-0 p-0 m-0 placeholder-muted"
            />
          </div>

          {/* Take profit — editable */}
          <div className="bg-card p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Take profit</p>
            <input
              type="number"
              step="0.00001"
              placeholder="—"
              value={tpValue}
              onChange={(e) => setTpValue(e.target.value)}
              className="w-full text-[15px] font-bold text-dark bg-transparent outline-none border-0 p-0 m-0 placeholder-muted"
            />
          </div>

          {/* Taille */}
          <div className="bg-card p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Taille</p>
            <p className="text-[15px] font-bold text-dark">{trade.lots} lot</p>
          </div>

          {/* Durée */}
          <div className="bg-card p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Durée</p>
            <p className="text-[15px] font-bold text-dark">{fmtDuration(trade.duration_min)}</p>
          </div>

          {/* Ratio R:R */}
          <div className="bg-card p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">Ratio R:R</p>
            <p className={`text-[15px] font-bold ${rrGreen ? 'text-green' : 'text-dark'}`}>
              {rrValue != null ? `${rrValue.toFixed(2)}R` : '—'}
            </p>
          </div>

          {/* État psy */}
          <div className="bg-card p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase tracking-wide mb-1">État psy</p>
            <div className="h-[22px] flex items-center">
              {psyScore != null ? (
                <PsyFaceIcon score={psyScore} />
              ) : (
                <p className="text-[15px] font-bold text-muted">—</p>
              )}
            </div>
          </div>

        </div>

        {/* SL/TP save row — shown when values changed */}
        {(slValue !== (trade.sl != null ? String(trade.sl) : '') ||
          tpValue !== (trade.tp != null ? String(trade.tp) : '')) && (
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] text-muted">Le R:R sera recalculé automatiquement</p>
            <button
              onClick={handleSlTpSave}
              disabled={slTpSaving}
              className="text-[12px] font-semibold text-blue disabled:opacity-40 transition-opacity"
            >
              {slTpSaving ? 'Enregistrement...' : slTpSaved ? 'Sauvegarde' : 'Enregistrer'}
            </button>
          </div>
        )}

        {/* ── Notes ────────────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold text-dark">Notes</p>
              {/* Voice note button */}
              <button
                onClick={handleVoiceNote}
                title={listening ? "Arrêter l'enregistrement" : 'Note vocale (speech-to-text)'}
                className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors ${
                  listening
                    ? 'bg-red-bg text-red'
                    : 'bg-subtle text-muted hover:text-dark'
                }`}
              >
                {listening ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-red animate-pulse" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>
            </div>
            <span className="text-[11px] font-medium transition-all">
              {noteSaving ? (
                <span className="text-muted flex items-center gap-1">
                  <span className="w-2.5 h-2.5 border border-muted border-t-transparent rounded-full animate-spin" />
                  Sauvegarde...
                </span>
              ) : noteSaved ? (
                <span className="text-green">Sauvegarde</span>
              ) : note !== lastSavedNote.current ? (
                <span className="text-muted">Modifie</span>
              ) : null}
            </span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Ajouter des notes sur ce trade... (entrée de prix, emotion, setup, erreurs...)"
            className="w-full min-h-[120px] resize-none bg-transparent text-[13px] text-text2 placeholder-muted outline-none leading-relaxed"
          />
          <p className="text-[10px] text-muted mt-1">
            Sauvegarde automatique à la sortie du champ
            {listening && <span className="ml-2 text-red font-medium">Ecoute...</span>}
          </p>
        </div>

        {/* ── Checklist ────────────────────────────────────────────────────── */}
        <ChecklistSection tradeId={trade.id} />

        {/* ── Tags ─────────────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[13px] font-bold text-dark">Tag du setup</p>
            {tagSaving && (
              <span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
            )}
            {tag && !tagSaving && (
              <span className="px-2 py-0.5 bg-dark text-white text-[11px] font-bold rounded-full">{tag}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_TAGS.map((t) => {
              const active = tag === t
              return (
                <button
                  key={t}
                  onClick={() => handleTagClick(t)}
                  disabled={tagSaving}
                  className={`px-3 py-2 rounded-xl text-[13px] font-semibold transition-all border ${
                    active
                      ? 'bg-dark text-white border-dark'
                      : 'bg-surface text-muted border-border hover:border-dark/30 hover:text-dark'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {t}
                </button>
              )
            })}
            {tag && !PRESET_TAGS.includes(tag as (typeof PRESET_TAGS)[number]) && (
              <button
                onClick={() => handleTagClick(tag)}
                disabled={tagSaving}
                className="px-3 py-2 rounded-xl text-[13px] font-semibold border bg-dark text-white border-dark disabled:opacity-50"
              >
                {tag}
              </button>
            )}
          </div>
        </div>

        {/* ── Psy score ────────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-[13px] font-bold text-dark">État psychologique</p>
            {psySaving && (
              <span className="w-3 h-3 border border-muted border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          <div className="flex gap-2">
            {PSY_FACES.map(({ score, label, icon }) => (
              <button
                key={score}
                onClick={() => handlePsyClick(score)}
                disabled={psySaving}
                title={label}
                className={`flex-1 py-3 rounded-xl transition-all border-2 disabled:opacity-50 ${
                  psyScore === score
                    ? 'border-dark bg-subtle scale-105 text-dark'
                    : 'border-transparent bg-subtle/50 opacity-50 hover:opacity-100 text-muted'
                }`}
              >
                {icon(psyScore === score)}
              </button>
            ))}
          </div>
          {psyScore != null && (
            <p className="text-[11px] text-muted mt-2 text-center">
              {['', 'Très mauvais', 'Mauvais', 'Neutre', 'Bon', 'Excellent'][psyScore]}
            </p>
          )}
        </div>

        {/* ── Screenshot ───────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-bold text-dark">Screenshot</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-dark transition-colors px-3 py-1.5 bg-subtle rounded-lg"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {screenshotUrl ? 'Remplacer' : 'Uploader'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshotChange}
              className="hidden"
            />
          </div>

          {uploadError && <p className="text-[12px] text-red mb-3">{uploadError}</p>}

          {screenshotUrl ? (
            <div className="relative group rounded-xl overflow-hidden bg-subtle">
              <img
                src={screenshotUrl}
                alt="Screenshot du trade"
                className="w-full object-contain max-h-96 rounded-xl"
              />
              <div className="absolute inset-0 bg-dark/0 group-hover:bg-dark/10 transition-colors rounded-xl" />
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 text-muted hover:border-dark/30 hover:text-dark transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span className="text-[12px] font-medium">Cliquer pour ajouter un screenshot</span>
            </button>
          )}
        </div>

        {/* ── TradingView chart ─────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[13px] font-bold text-dark mb-3">Graphique</p>
          <TradingViewWidget symbol={trade.symbol} />
        </div>

        {/* ── Delete button ─────────────────────────────────────────────────── */}
        <button
          onClick={async () => {
            if (!confirm('Supprimer ce trade ?')) return
            await api.delete(`/api/trades/${trade.id}`)
            navigate(-1)
          }}
          className="w-full py-3 text-[13px] font-semibold text-red bg-red-bg rounded-xl border border-red/20"
        >
          Supprimer ce trade
        </button>

      </div>
    </div>
  )
}
