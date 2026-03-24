import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { Badge } from '../components/ui/Badge'
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-subtle last:border-0">
      <span className="text-xs text-[#999] font-medium">{label}</span>
      <span className={`text-sm font-semibold text-dark ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}

function SkeletonBlock({ h }: { h?: string }) {
  return <div className={`bg-subtle rounded-xl animate-pulse ${h ?? 'h-8'}`} />
}

// ─── Component ────────────────────────────────────────────────────────────────

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
      // Revert on failure
      setNote(lastSavedNote.current)
    } finally {
      setNoteSaving(false)
    }
  }

  // ── Tag toggle ───────────────────────────────────────────────────────────────

  // ── Psy score ────────────────────────────────────────────────────────────────

  async function handlePsyClick(score: number) {
    if (!trade) return
    const newScore = psyScore === score ? null : score
    setPsyScore(newScore)
    setPsySaving(true)
    try {
      await api.patch<{ ok: boolean }>(`/api/trades/${trade.id}`, { psy_score: newScore })
    } catch {
      setPsyScore(psyScore) // revert
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
      // Refresh trade to get recalculated rr_realized
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
      setTag(tag) // revert
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
    // Optimistic preview
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
      <div className="p-6 space-y-5">
        {/* Back */}
        <div className="h-7 w-20 bg-subtle rounded-lg animate-pulse" />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-28 bg-subtle rounded-xl animate-pulse" />
          <div className="h-6 w-12 bg-subtle rounded-full animate-pulse" />
        </div>

        {/* 2-col */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card rounded-2xl p-5 space-y-3">
            <SkeletonBlock h="h-4" />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonBlock key={i} h="h-8" />
            ))}
          </div>
          <div className="bg-card rounded-2xl p-5 space-y-3">
            <SkeletonBlock h="h-4" />
            <SkeletonBlock h="h-36" />
          </div>
        </div>

        {/* Tags */}
        <div className="bg-card rounded-2xl p-5">
          <SkeletonBlock h="h-4" />
          <div className="flex gap-2 mt-3">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} h="h-8" />)}
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
  const pnlClass = pnlPositive ? 'text-green' : 'text-red'

  const sessionLabel = trade.session
    ? trade.session.charAt(0).toUpperCase() + trade.session.slice(1)
    : '—'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm text-[#888] hover:text-dark transition-colors font-medium"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Retour
      </button>

      {/* Hero card */}
      <div className="bg-dark rounded-2xl p-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white text-xl font-extrabold">{trade.symbol}</span>
            <Badge variant={trade.type === 'buy' ? 'buy' : 'sell'} label={trade.type.toUpperCase()} />
            <Badge
              variant={trade.status === 'win' ? 'win' : trade.status === 'loss' ? 'loss' : 'neutral'}
              label={trade.status.toUpperCase()}
            />
          </div>
          <p className="text-[#666] text-xs">{fmtDatetime(trade.open_time)}</p>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-black ${trade.pnl_net >= 0 ? 'text-green' : 'text-red'}`}>
            {fmtPnl(trade.pnl_net)}
          </p>
          {trade.rr_realized != null && (
            <p className="text-[#555] text-sm mt-0.5">{trade.rr_realized.toFixed(2)}R</p>
          )}
        </div>
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Trade info */}
        <div className="bg-card rounded-2xl p-5">
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-1">Informations</p>

          <InfoRow label="Prix d'ouverture" value={fmtPrice(trade.open_price)} />
          <InfoRow label="Prix de cloture" value={fmtPrice(trade.close_price)} />
          {/* SL/TP editable */}
          <div className="py-2 border-b border-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#999] font-medium">Stop Loss / Take Profit</span>
              <button
                onClick={handleSlTpSave}
                disabled={slTpSaving}
                className="text-[11px] font-semibold text-dark hover:opacity-70 transition-opacity disabled:opacity-40"
              >
                {slTpSaving ? 'Enregistrement...' : slTpSaved ? '✓ Sauvegardé' : 'Enregistrer'}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.00001"
                placeholder="Stop Loss"
                value={slValue}
                onChange={(e) => setSlValue(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-dark outline-none focus:ring-1 focus:ring-dark/20"
              />
              <input
                type="number"
                step="0.00001"
                placeholder="Take Profit"
                value={tpValue}
                onChange={(e) => setTpValue(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-1.5 text-xs text-dark outline-none focus:ring-1 focus:ring-dark/20"
              />
            </div>
            {slValue && <p className="text-[10px] text-muted mt-1">Le R:R sera recalculé automatiquement</p>}
          </div>
          <InfoRow label="Volume (lots)" value={trade.lots.toString()} />
          <InfoRow label="Duree" value={fmtDuration(trade.duration_min)} />
          <InfoRow label="Session" value={sessionLabel} />
          <InfoRow
            label="P&L Net"
            value={fmtPnl(trade.pnl_net)}
            valueClass={pnlClass}
          />
          <InfoRow
            label="R:R realise"
            value={trade.rr_realized != null ? `${trade.rr_realized.toFixed(2)}R` : '—'}
          />
        </div>

        {/* Right: Note editor */}
        <div className="bg-card rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">Note</p>
            <span className="text-[11px] font-medium transition-all">
              {noteSaving ? (
                <span className="text-[#888] flex items-center gap-1">
                  <span className="w-2.5 h-2.5 border border-[#888] border-t-transparent rounded-full animate-spin" />
                  Sauvegarde...
                </span>
              ) : noteSaved ? (
                <span className="text-green">Sauvegarde</span>
              ) : note !== lastSavedNote.current ? (
                <span className="text-[#bbb]">Modifie</span>
              ) : null}
            </span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Ajouter des notes sur ce trade... (entrée de prix, emotion, setup, erreurs...)"
            className="flex-1 min-h-[180px] resize-none bg-surface rounded-xl p-3 text-sm text-dark placeholder-[#ccc] outline-none focus:ring-1 focus:ring-dark/20 leading-relaxed"
          />
          <p className="text-[10px] text-[#bbb] mt-2">Sauvegarde automatique a la sortie du champ</p>
        </div>
      </div>

      {/* Tags */}
      <div className="bg-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">Tag du setup</p>
          {tagSaving && (
            <span className="w-3 h-3 border border-[#888] border-t-transparent rounded-full animate-spin" />
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
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                  active
                    ? 'bg-dark text-white border-dark'
                    : 'bg-surface text-muted border-subtle hover:border-dark/30 hover:text-dark'
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
              className="px-4 py-2 rounded-xl text-sm font-medium border bg-dark text-white border-dark disabled:opacity-50"
            >
              {tag}
            </button>
          )}
        </div>
      </div>

      {/* Psy Score */}
      <div className="bg-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">État psychologique</p>
          {psySaving && (
            <span className="w-3 h-3 border border-[#888] border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <div className="flex gap-2">
          {[
            { score: 1, emoji: '😰', label: 'Très mauvais' },
            { score: 2, emoji: '😟', label: 'Mauvais' },
            { score: 3, emoji: '😐', label: 'Neutre' },
            { score: 4, emoji: '🙂', label: 'Bon' },
            { score: 5, emoji: '😎', label: 'Excellent' },
          ].map(({ score, emoji, label }) => (
            <button
              key={score}
              onClick={() => handlePsyClick(score)}
              disabled={psySaving}
              title={label}
              className={`flex-1 py-3 rounded-xl text-3xl transition-all border-2 disabled:opacity-50 ${
                psyScore === score
                  ? 'border-dark bg-subtle scale-105'
                  : 'border-transparent bg-subtle/50 opacity-50 hover:opacity-100'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        {psyScore && (
          <p className="text-xs text-[#888] mt-2 text-center">
            {['', 'Très mauvais', 'Mauvais', 'Neutre', 'Bon', 'Excellent'][psyScore]}
          </p>
        )}
      </div>

      {/* Screenshot */}
      <div className="bg-card rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#999] uppercase tracking-wider">Screenshot</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#888] hover:text-dark transition-colors px-3 py-1.5 bg-subtle rounded-lg"
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

        {uploadError && (
          <p className="text-xs text-red mb-3">{uploadError}</p>
        )}

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
            className="w-full h-32 border-2 border-dashed border-subtle rounded-xl flex flex-col items-center justify-center gap-2 text-[#bbb] hover:border-dark/30 hover:text-[#888] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span className="text-xs font-medium">Cliquer pour ajouter un screenshot</span>
          </button>
        )}
      </div>
    </div>
  )
}
