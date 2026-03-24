import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Account {
  id: string
  name: string
  broker: string
  initial_capital: number
  api_key_preview: string
  created_at: string
}

interface Alert {
  id: string
  type: 'drawdown' | 'loss_streak'
  threshold: number
  enabled: boolean
}

const ALERT_LABELS: Record<string, string> = {
  drawdown: 'Drawdown max %',
  loss_streak: 'Pertes consécutives',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
      {children}
    </h2>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rotate Key Modal
// ---------------------------------------------------------------------------
interface RotateKeyModalProps {
  apiKey: string
  onClose: () => void
}

function RotateKeyModal({ apiKey, onClose }: RotateKeyModalProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-dark">Nouvelle clé API</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-subtle text-muted hover:text-dark transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-muted mb-4">
          Copiez cette clé maintenant. Elle ne sera plus affichée en clair par la suite.
        </p>
        <div className="flex items-center gap-2 bg-subtle rounded-xl px-4 py-3 mb-4">
          <code className="flex-1 text-xs text-dark font-mono break-all">{apiKey}</code>
        </div>
        <button
          onClick={handleCopy}
          className="w-full py-2.5 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors"
        >
          {copied ? 'Copié !' : 'Copier la clé'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function Settings() {
  const navigate = useNavigate()
  const { activeAccountId, setActiveAccountId } = useAccountStore()
  const { session } = useAuthStore()
  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/trades/ingest'

  // Accounts state
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [newAccount, setNewAccount] = useState({ name: '', broker: '', initial_capital: '' })
  const [showNewAccountForm, setShowNewAccountForm] = useState(false)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [rotateKeyModal, setRotateKeyModal] = useState<string | null>(null) // holds the new api_key

  // Edit account inline
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [editAccount, setEditAccount] = useState({ name: '', broker: '', initial_capital: '' })

  // Alerts state
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(true)
  const [newAlert, setNewAlert] = useState({ type: 'drawdown', threshold: '' })
  const [showNewAlertForm, setShowNewAlertForm] = useState(false)

  // Import CSV
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // URL copy
  const [urlCopied, setUrlCopied] = useState(false)

  // Load accounts
  useEffect(() => {
    api.get<Account[]>('/api/accounts')
      .then(setAccounts)
      .catch(() => setAccounts([]))
      .finally(() => setLoadingAccounts(false))
  }, [])

  // Load alerts when activeAccountId changes
  useEffect(() => {
    if (!activeAccountId) {
      setLoadingAlerts(false)
      return
    }
    setLoadingAlerts(true)
    api.get<Alert[]>(`/api/alerts?account_id=${activeAccountId}`)
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoadingAlerts(false))
  }, [activeAccountId])

  // ---------- Account actions ----------

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    setCreatingAccount(true)
    setCreateError(null)
    try {
      const created = await api.post<Account & { api_key?: string }>('/api/accounts', {
        name: newAccount.name,
        broker: newAccount.broker,
        initial_capital: parseFloat(newAccount.initial_capital) || 0,
      })
      setAccounts((prev) => [...prev, created])
      if (created.api_key) {
        setRotateKeyModal(created.api_key)
      }
      setNewAccount({ name: '', broker: '', initial_capital: '' })
      setShowNewAccountForm(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur lors de la création')
    } finally {
      setCreatingAccount(false)
    }
  }

  async function handleSaveEditAccount(id: string) {
    try {
      const updated = await api.patch<Account>(`/api/accounts/${id}`, {
        name: editAccount.name,
        broker: editAccount.broker,
        initial_capital: parseFloat(editAccount.initial_capital) || 0,
      })
      setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)))
      setEditingAccountId(null)
    } catch {
      // ignore
    }
  }

  async function handleDeleteAccount(id: string) {
    await api.delete(`/api/accounts/${id}`)
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    if (activeAccountId === id) setActiveAccountId('')
  }

  async function handleRotateKey(id: string) {
    const res = await api.post<{ api_key: string }>(`/api/accounts/${id}/rotate-key`, {})
    setRotateKeyModal(res.api_key)
  }

  // ---------- Alert actions ----------

  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault()
    if (!activeAccountId) return
    const created = await api.post<Alert>('/api/alerts', {
      account_id: activeAccountId,
      type: newAlert.type,
      threshold: parseFloat(newAlert.threshold) || 0,
    })
    setAlerts((prev) => [...prev, created])
    setNewAlert({ type: 'drawdown', threshold: '' })
    setShowNewAlertForm(false)
  }

  async function handleToggleAlert(alert: Alert) {
    const updated = await api.patch<Alert>(`/api/alerts/${alert.id}`, {
      enabled: !alert.enabled,
    })
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? updated : a)))
  }

  async function handleUpdateAlertThreshold(alert: Alert, threshold: number) {
    const updated = await api.patch<Alert>(`/api/alerts/${alert.id}`, { threshold })
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? updated : a)))
  }

  async function handleDeleteAlert(id: string) {
    await api.delete(`/api/alerts/${id}`)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeAccountId) return
    setImporting(true)
    setImportResult(null)
    setImportError(null)
    try {
      const token = useAuthStore.getState().session?.access_token
      const form = new FormData()
      form.append('account_id', activeAccountId)
      form.append('file', file)
      const res = await fetch(`${BASE}/api/trades/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Erreur import')
      setImportResult(data)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Erreur import')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(apiUrl).then(() => {
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    })
  }

  const activeAccount = accounts.find((a) => a.id === activeAccountId)

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-dark">Paramètres</h1>
        <p className="text-muted text-sm mt-1">Configuration de votre compte et de l'application</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION: Comptes */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionTitle>Comptes</SectionTitle>
        <div className="space-y-3">
          {loadingAccounts ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="bg-card rounded-2xl p-4 animate-pulse">
                  <div className="h-3 w-32 bg-subtle rounded mb-2" />
                  <div className="h-2 w-48 bg-subtle rounded" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {accounts.map((account) => {
                const isActive = account.id === activeAccountId
                const isEditing = editingAccountId === account.id
                return (
                  <Card
                    key={account.id}
                    className={`transition-all ${isActive ? 'border-2 border-dark' : 'border-2 border-transparent'}`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            value={editAccount.name}
                            onChange={(e) => setEditAccount((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Nom"
                            className="flex-1 px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
                          />
                          <input
                            value={editAccount.broker}
                            onChange={(e) => setEditAccount((p) => ({ ...p, broker: e.target.value }))}
                            placeholder="Broker"
                            className="flex-1 px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
                          />
                        </div>
                        <input
                          type="number"
                          value={editAccount.initial_capital}
                          onChange={(e) => setEditAccount((p) => ({ ...p, initial_capital: e.target.value }))}
                          placeholder="Capital initial"
                          className="w-full px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEditAccount(account.id)}
                            className="px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors"
                          >
                            Enregistrer
                          </button>
                          <button
                            onClick={() => setEditingAccountId(null)}
                            className="px-4 py-2 rounded-xl bg-subtle text-dark text-sm font-medium hover:bg-[#e5e5e5] transition-colors"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-dark text-sm">{account.name}</h3>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full bg-dark text-white text-[10px] font-semibold">
                                Actif
                              </span>
                            )}
                          </div>
                          <p className="text-muted text-xs mt-0.5">{account.broker}</p>
                          <p className="text-muted text-xs">
                            Capital : {account.initial_capital.toLocaleString('fr-FR')} €
                          </p>
                          <p className="text-muted text-xs font-mono mt-1">
                            {account.api_key_preview}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => setActiveAccountId(account.id)}
                              className="px-3 py-1.5 rounded-xl bg-dark text-white text-xs font-semibold hover:bg-[#333] transition-colors"
                            >
                              Activer
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingAccountId(account.id)
                              setEditAccount({
                                name: account.name,
                                broker: account.broker,
                                initial_capital: String(account.initial_capital),
                              })
                            }}
                            className="px-3 py-1.5 rounded-xl bg-subtle text-dark text-xs font-medium hover:bg-[#e5e5e5] transition-colors"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleRotateKey(account.id)}
                            className="px-3 py-1.5 rounded-xl bg-subtle text-dark text-xs font-medium hover:bg-[#e5e5e5] transition-colors"
                          >
                            Régénérer clé
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(account.id)}
                            className="px-3 py-1.5 rounded-xl text-red text-xs font-medium hover:bg-red/10 transition-colors"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </Card>
                )
              })}

              {/* New account form */}
              {showNewAccountForm ? (
                <Card className="border-2 border-dark">
                  <h3 className="font-semibold text-dark text-sm mb-3">Nouveau compte</h3>
                  <form onSubmit={handleCreateAccount} className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        value={newAccount.name}
                        onChange={(e) => setNewAccount((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Nom du compte *"
                        required
                        className="flex-1 px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
                      />
                      <input
                        value={newAccount.broker}
                        onChange={(e) => setNewAccount((p) => ({ ...p, broker: e.target.value }))}
                        placeholder="Broker"
                        className="flex-1 px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
                      />
                    </div>
                    <input
                      type="number"
                      value={newAccount.initial_capital}
                      onChange={(e) => setNewAccount((p) => ({ ...p, initial_capital: e.target.value }))}
                      placeholder="Capital initial (€)"
                      className="w-full px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
                    />
                    {createError && (
                      <p className="text-xs text-red font-medium">{createError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={creatingAccount || !newAccount.name.trim()}
                        className="px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
                      >
                        {creatingAccount ? 'Création...' : 'Créer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewAccountForm(false)}
                        className="px-4 py-2 rounded-xl bg-subtle text-dark text-sm font-medium hover:bg-[#e5e5e5] transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                </Card>
              ) : (
                <button
                  onClick={() => setShowNewAccountForm(true)}
                  className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl border-2 border-dashed border-subtle text-muted text-sm font-medium hover:border-dark hover:text-dark transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Nouveau compte
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION: Connexion EA */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionTitle>Connexion EA</SectionTitle>
        <Card>
          <div className="space-y-4">
            {/* API URL */}
            <div>
              <label className="text-xs text-muted font-medium block mb-1.5">URL d'ingestion</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-surface rounded-xl px-3 py-2.5 overflow-hidden">
                  <code className="text-xs text-dark font-mono break-all">{apiUrl}</code>
                </div>
                <button
                  onClick={handleCopyUrl}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-dark text-white text-xs font-semibold hover:bg-[#333] transition-colors"
                >
                  {urlCopied ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copié
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copier l'URL
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* API Key preview */}
            <div>
              <label className="text-xs text-muted font-medium block mb-1.5">Clé API (compte actif)</label>
              <div className="bg-surface rounded-xl px-3 py-2.5">
                <code className="text-xs text-dark font-mono">
                  {activeAccount
                    ? `sk-••••••••  (${activeAccount.api_key_preview})`
                    : 'Aucun compte actif'}
                </code>
              </div>
            </div>

            {/* MT5 Setup steps */}
            <div className="pt-2 border-t border-subtle">
              <p className="text-xs font-semibold text-dark mb-3">
                Configuration dans MetaTrader 5
              </p>
              <ol className="space-y-3">
                <li className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-dark text-white text-xs font-semibold flex items-center justify-center">
                    1
                  </span>
                  <div>
                    <p className="text-dark font-medium text-xs">Importer l'Expert Advisor</p>
                    <p className="text-muted text-xs mt-0.5">
                      Dans MT5, ouvrez l'éditeur MetaEditor et importez le fichier EA fourni.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-dark text-white text-xs font-semibold flex items-center justify-center">
                    2
                  </span>
                  <div>
                    <p className="text-dark font-medium text-xs">Configurer les paramètres</p>
                    <p className="text-muted text-xs mt-0.5">
                      Dans les inputs de l'EA, renseignez l'URL d'ingestion et la clé API ci-dessus.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-dark text-white text-xs font-semibold flex items-center justify-center">
                    3
                  </span>
                  <div>
                    <p className="text-dark font-medium text-xs">Autoriser les requêtes web</p>
                    <p className="text-muted text-xs mt-0.5">
                      Dans MT5 → Outils → Options → Expert Advisors, activez "Autoriser les requêtes web" et ajoutez le domaine de l'API à la liste blanche.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION: Import historique MT5 */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionTitle>Import historique MT5</SectionTitle>
        <Card>
          <p className="text-xs text-muted mb-4">
            Exportez votre historique depuis MT5 → Historique → clic droit → Enregistrer en tant que rapport (CSV), puis importez-le ici.
          </p>
          {!activeAccountId ? (
            <p className="text-xs text-muted">Activez un compte pour importer.</p>
          ) : (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleImport}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {importing ? 'Import en cours...' : 'Importer un fichier CSV'}
              </button>
              {importResult && (
                <p className="text-xs text-dark font-medium">
                  {importResult.imported} trade{importResult.imported > 1 ? 's' : ''} importé{importResult.imported > 1 ? 's' : ''}
                  {importResult.skipped > 0 && `, ${importResult.skipped} ignoré${importResult.skipped > 1 ? 's' : ''} (déjà présents)`}
                </p>
              )}
              {importError && <p className="text-xs text-red font-medium">{importError}</p>}
            </div>
          )}
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION: Alertes */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionTitle>Alertes</SectionTitle>
        {!activeAccountId ? (
          <Card>
            <p className="text-muted text-sm">
              Activez un compte pour configurer les alertes.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {loadingAlerts ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-card rounded-2xl p-4 animate-pulse">
                    <div className="h-3 w-40 bg-subtle rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {alerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onToggle={() => handleToggleAlert(alert)}
                    onUpdateThreshold={(v) => handleUpdateAlertThreshold(alert, v)}
                    onDelete={() => handleDeleteAlert(alert.id)}
                  />
                ))}

                {showNewAlertForm ? (
                  <Card className="border-2 border-dark">
                    <h3 className="font-semibold text-dark text-sm mb-3">Nouvelle alerte</h3>
                    <form onSubmit={handleCreateAlert} className="space-y-3">
                      <div className="flex gap-2">
                        <select
                          value={newAlert.type}
                          onChange={(e) => setNewAlert((p) => ({ ...p, type: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
                        >
                          <option value="drawdown">Drawdown max %</option>
                          <option value="loss_streak">Pertes consécutives</option>
                        </select>
                        <input
                          type="number"
                          value={newAlert.threshold}
                          onChange={(e) => setNewAlert((p) => ({ ...p, threshold: e.target.value }))}
                          placeholder="Seuil"
                          required
                          className="w-28 px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors"
                        >
                          Créer
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewAlertForm(false)}
                          className="px-4 py-2 rounded-xl bg-subtle text-dark text-sm font-medium hover:bg-[#e5e5e5] transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    </form>
                  </Card>
                ) : (
                  <button
                    onClick={() => setShowNewAlertForm(true)}
                    className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl border-2 border-dashed border-subtle text-muted text-sm font-medium hover:border-dark hover:text-dark transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Nouvelle alerte
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION: Compte utilisateur */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <SectionTitle>Compte</SectionTitle>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-dark">{session?.user?.email ?? '—'}</p>
              <p className="text-xs text-muted mt-0.5">Connecté via Supabase Auth</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red/30 text-red text-sm font-medium hover:bg-red/10 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Se déconnecter
            </button>
          </div>
        </Card>
      </section>

      {/* Rotate key modal */}
      {rotateKeyModal && (
        <RotateKeyModal
          apiKey={rotateKeyModal}
          onClose={() => setRotateKeyModal(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Alert Row (inline threshold editing)
// ---------------------------------------------------------------------------
interface AlertRowProps {
  alert: Alert
  onToggle: () => void
  onUpdateThreshold: (v: number) => void
  onDelete: () => void
}

function AlertRow({ alert, onToggle, onUpdateThreshold, onDelete }: AlertRowProps) {
  const [editingThreshold, setEditingThreshold] = useState(false)
  const [thresholdValue, setThresholdValue] = useState(String(alert.threshold))

  function handleThresholdBlur() {
    const val = parseFloat(thresholdValue)
    if (!isNaN(val) && val !== alert.threshold) {
      onUpdateThreshold(val)
    }
    setEditingThreshold(false)
  }

  return (
    <div className="bg-card rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-dark">
          {ALERT_LABELS[alert.type] ?? alert.type}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-muted">Seuil :</span>
          {editingThreshold ? (
            <input
              type="number"
              value={thresholdValue}
              onChange={(e) => setThresholdValue(e.target.value)}
              onBlur={handleThresholdBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleThresholdBlur()}
              autoFocus
              className="w-20 px-2 py-0.5 rounded-lg border border-subtle bg-surface text-xs text-dark outline-none focus:border-dark transition-colors"
            />
          ) : (
            <button
              onClick={() => setEditingThreshold(true)}
              className="text-xs text-dark font-mono hover:underline"
            >
              {alert.threshold}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${
            alert.enabled ? 'bg-dark' : 'bg-subtle'
          }`}
          style={{ width: 40, height: 22 }}
          aria-label="Toggle alert"
        >
          <span
            className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${
              alert.enabled ? 'translate-x-[20px]' : 'translate-x-[2px]'
            }`}
          />
        </button>
        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-muted hover:text-red hover:bg-red/10 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}
