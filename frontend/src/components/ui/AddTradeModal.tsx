import { useState } from 'react'
import { api } from '../../lib/api'

interface AddTradeModalProps {
  accountId: string
  onClose: () => void
  onSuccess: () => void
}

export function AddTradeModal({ accountId, onClose, onSuccess }: AddTradeModalProps) {
  const now = new Date()
  const toLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [symbol, setSymbol] = useState('')
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy')
  const [status, setStatus] = useState<'closed' | 'open'>('closed')
  const [volume, setVolume] = useState('0.01')
  const [openTime, setOpenTime] = useState(toLocal(now))
  const [closeTime, setCloseTime] = useState(toLocal(now))
  const [openPrice, setOpenPrice] = useState('')
  const [closePrice, setClosePrice] = useState('')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [profit, setProfit] = useState('')
  const [commission, setCommission] = useState('0')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!symbol.trim()) { setError('Paire requise'); return }
    if (!openPrice) { setError('Prix d\'ouverture requis'); return }
    if (status === 'closed' && !profit) { setError('Profit requis pour un trade clôturé'); return }

    setLoading(true)
    setError(null)

    const payload: Record<string, unknown> = {
      account_id: accountId,
      symbol: symbol.trim().toUpperCase(),
      type: direction,
      status,
      volume: parseFloat(volume),
      open_price: parseFloat(openPrice),
      open_time: new Date(openTime).toISOString(),
      profit: status === 'closed' ? parseFloat(profit) : 0,
      commission: parseFloat(commission) || 0,
      swap: 0,
    }

    if (closePrice) payload.close_price = parseFloat(closePrice)
    if (status === 'closed') payload.close_time = new Date(closeTime).toISOString()
    if (sl) payload.sl = parseFloat(sl)
    if (tp) payload.tp = parseFloat(tp)

    try {
      await api.post('/api/trades/create', payload)
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-dark outline-none focus:ring-2 focus:ring-dark/20 placeholder-muted'
  const labelCls = 'block text-xs font-semibold text-muted mb-1.5'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet — bottom on mobile, centered on desktop */}
      <div className="fixed z-50 inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4">
        <div className="bg-card md:rounded-2xl rounded-t-3xl shadow-2xl w-full md:max-w-lg max-h-[92vh] flex flex-col">
          {/* Handle (mobile) */}
          <div className="md:hidden flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-subtle" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-bold text-dark">Ajouter un trade</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-subtle text-muted hover:text-dark">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {error && (
              <div className="bg-red/10 text-red text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            {/* Symbol + Direction */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Paire *</label>
                <input
                  className={inputCls + ' uppercase'}
                  placeholder="EURUSD"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  autoCapitalize="characters"
                />
              </div>
              <div>
                <label className={labelCls}>Direction</label>
                <div className="flex rounded-xl overflow-hidden border border-border">
                  <button
                    type="button"
                    onClick={() => setDirection('buy')}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${direction === 'buy' ? 'bg-green text-white' : 'bg-surface text-muted'}`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('sell')}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${direction === 'sell' ? 'bg-red text-white' : 'bg-surface text-muted'}`}
                  >
                    SELL
                  </button>
                </div>
              </div>
            </div>

            {/* Status + Volume */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Statut</label>
                <div className="flex rounded-xl overflow-hidden border border-border">
                  <button
                    type="button"
                    onClick={() => setStatus('closed')}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${status === 'closed' ? 'bg-dark text-white' : 'bg-surface text-muted'}`}
                  >
                    Clôturé
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('open')}
                    className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${status === 'open' ? 'bg-dark text-white' : 'bg-surface text-muted'}`}
                  >
                    Ouvert
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Lots</label>
                <input type="number" step="0.01" min="0.01" className={inputCls} value={volume} onChange={(e) => setVolume(e.target.value)} />
              </div>
            </div>

            {/* Open time + price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date/heure ouv.</label>
                <input type="datetime-local" className={inputCls} value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Prix ouverture *</label>
                <input type="number" step="0.00001" className={inputCls} placeholder="1.08500" value={openPrice} onChange={(e) => setOpenPrice(e.target.value)} />
              </div>
            </div>

            {/* Close time + price (only if closed) */}
            {status === 'closed' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Date/heure clôt.</label>
                  <input type="datetime-local" className={inputCls} value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Prix clôture</label>
                  <input type="number" step="0.00001" className={inputCls} placeholder="1.09000" value={closePrice} onChange={(e) => setClosePrice(e.target.value)} />
                </div>
              </div>
            )}

            {/* SL + TP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Stop Loss</label>
                <input type="number" step="0.00001" className={inputCls} placeholder="Optionnel" value={sl} onChange={(e) => setSl(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Take Profit</label>
                <input type="number" step="0.00001" className={inputCls} placeholder="Optionnel" value={tp} onChange={(e) => setTp(e.target.value)} />
              </div>
            </div>

            {/* Profit + Commission */}
            {status === 'closed' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Profit brut * ($)</label>
                  <input type="number" step="0.01" className={inputCls} placeholder="-50.00" value={profit} onChange={(e) => setProfit(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Commission ($)</label>
                  <input type="number" step="0.01" className={inputCls} placeholder="0.00" value={commission} onChange={(e) => setCommission(e.target.value)} />
                </div>
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted hover:text-dark transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-dark text-white text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Ajout...' : 'Ajouter le trade'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
