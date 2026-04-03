import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'

export default function Import() {
  const { activeAccountId } = useAccountStore()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  async function handleImport() {
    if (!file || !activeAccountId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('account_id', activeAccountId)
      const res = await api.postForm<{ imported: number; skipped: number; total: number }>(
        '/api/trades/import', form
      )
      setResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'import")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-dark">Import CSV</h1>
        <p className="text-sm text-muted mt-1">Importe ton historique depuis MT4, MT5, cTrader ou n'importe quel broker</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Formats supportés</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { name: 'MetaTrader 5', steps: ['Ouvre MT5', 'Historique → clic droit', '"Enregistrer sous" → CSV'] },
            { name: 'MetaTrader 4', steps: ['Ouvre MT4', 'Terminal → Historique', '"Enregistrer sous" → CSV'] },
            { name: 'CSV générique', steps: ['Symbol, Type, Open/Close', 'Time, Price, Volume', 'Profit, Commission'] },
          ].map(({ name, steps }) => (
            <div key={name} className="bg-surface rounded-xl p-3">
              <p className="text-xs font-bold text-dark mb-2">{name}</p>
              <ol className="space-y-1">
                {steps.map((s, i) => (
                  <li key={i} className="text-[11px] text-muted flex gap-1.5">
                    <span className="text-dark font-bold">{i + 1}.</span>{s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          dragging ? 'border-dark bg-subtle' : 'border-border hover:border-dark/40'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-muted mx-auto mb-3">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        {file ? (
          <div>
            <p className="text-sm font-semibold text-dark">{file.name}</p>
            <p className="text-xs text-muted mt-1">{(file.size / 1024).toFixed(1)} Ko</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-dark">Glisse ton fichier CSV ici</p>
            <p className="text-xs text-muted mt-1">ou clique pour parcourir</p>
          </div>
        )}
      </div>

      {result && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="w-5 h-5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p className="text-sm font-bold text-dark">Import terminé</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-black text-dark">{result.imported}</p>
              <p className="text-xs text-muted">importés</p>
            </div>
            <div>
              <p className="text-2xl font-black text-dark">{result.skipped}</p>
              <p className="text-xs text-muted">ignorés</p>
            </div>
            <div>
              <p className="text-2xl font-black text-dark">{result.total}</p>
              <p className="text-xs text-muted">total</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/journal')}
            className="mt-4 w-full bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all"
          >
            Voir le journal
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red/5 border border-border rounded-xl p-4">
          <p className="text-sm text-red font-medium">{error}</p>
        </div>
      )}

      {!result && (
        <button
          onClick={handleImport}
          disabled={!file || !activeAccountId || loading}
          className="w-full bg-dark text-white rounded-xl py-3.5 text-sm font-bold hover:bg-[#333] transition-all disabled:opacity-40"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              Import en cours...
            </span>
          ) : 'Importer les trades'}
        </button>
      )}

      {!activeAccountId && (
        <p className="text-xs text-center text-muted">
          Sélectionne un compte dans les paramètres pour pouvoir importer.
        </p>
      )}
    </div>
  )
}
