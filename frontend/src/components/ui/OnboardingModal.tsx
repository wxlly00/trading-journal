import { useState } from 'react'
import { api } from '../../lib/api'
import { useAccountStore } from '../../stores/account'

interface Props {
  onDone: () => void
}

type Step = 'welcome' | 'account' | 'ea' | 'goals' | 'done'

const STEPS: Step[] = ['welcome', 'account', 'ea', 'goals']
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/trades/ingest'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div>
      <p className="text-xs font-semibold text-text2 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-surface border border-border rounded-lg px-3 py-2.5 overflow-hidden">
          <code className="text-xs text-dark font-mono break-all">{value}</code>
        </div>
        <button
          onClick={copy}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-dark text-white text-xs font-semibold hover:bg-[#333] transition-colors"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          )}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
    </div>
  )
}

export function OnboardingModal({ onDone }: Props) {
  const { setActiveAccountId } = useAccountStore()
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [broker, setBroker] = useState('')
  const [capital, setCapital] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [dailyTarget, setDailyTarget] = useState('')
  const [dailyMaxLoss, setDailyMaxLoss] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const stepIndex = STEPS.indexOf(step)

  async function handleCreateAccount() {
    if (!name.trim()) { setError('Donne un nom à ton compte.'); return }
    setLoading(true)
    setError('')
    try {
      const account = await api.post<{ id: string; name: string; api_key?: string }>('/api/accounts', {
        name: name.trim(),
        broker: broker.trim() || 'Non renseigné',
        initial_capital: parseFloat(capital) || 10000,
      })
      setActiveAccountId(account.id)
      if (account.api_key) setApiKey(account.api_key)
      setStep('ea')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  function handleSaveGoals() {
    if (dailyTarget) localStorage.setItem('tj-daily-target', dailyTarget)
    if (dailyMaxLoss) localStorage.setItem('tj-daily-maxloss', dailyMaxLoss)
    setStep('done')
    setTimeout(onDone, 1400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/90 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden">

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex gap-1 p-5 pb-0">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= stepIndex ? 'bg-dark' : 'bg-border'
                }`}
              />
            ))}
          </div>
        )}

        <div className="p-8">

          {/* ── Étape 1 : Bienvenue ─────────────────────────────── */}
          {step === 'welcome' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-6">
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
                  <rect x="2" y="12" width="4" height="10" rx="1" fill="#111"/>
                  <rect x="10" y="7" width="4" height="15" rx="1" fill="#111"/>
                  <rect x="18" y="2" width="4" height="20" rx="1" fill="#111"/>
                  <path d="M3 10 L11 5 L19 1" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <span className="text-xl font-extrabold text-dark">TradingJournal</span>
              </div>
              <h1 className="text-2xl font-extrabold text-dark mb-2">Bienvenue !</h1>
              <p className="text-sm text-muted leading-relaxed mb-8">
                En 3 minutes, on configure tout pour que tes trades remontent automatiquement depuis MetaTrader.
              </p>
              <div className="space-y-3 text-left mb-8">
                {[
                  { icon: '📊', label: 'Compte de trading', desc: 'Broker, capital de départ' },
                  { icon: '🔑', label: 'Connexion EA (MT4/MT5)', desc: 'URL + clé API à coller dans ton Expert Advisor' },
                  { icon: '🎯', label: 'Objectifs journaliers', desc: 'Profit cible et perte max' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 bg-subtle rounded-xl px-4 py-3">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-dark">{item.label}</p>
                      <p className="text-xs text-muted">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep('account')}
                className="w-full bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all"
              >
                Commencer →
              </button>
            </div>
          )}

          {/* ── Étape 2 : Compte de trading ─────────────────────── */}
          {step === 'account' && (
            <div>
              <h2 className="text-xl font-extrabold text-dark mb-1">Ton compte de trading</h2>
              <p className="text-sm text-muted mb-6">Ces infos servent à calculer tes performances.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-text2 block mb-1.5">
                    Nom du compte <span className="text-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Compte principal, FTMO challenge…"
                    className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text2 block mb-1.5">Broker</label>
                  <input
                    type="text"
                    value={broker}
                    onChange={e => setBroker(e.target.value)}
                    placeholder="Ex: XM, IC Markets, FTMO…"
                    className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text2 block mb-1.5">Capital initial ($)</label>
                  <input
                    type="number"
                    value={capital}
                    onChange={e => setCapital(e.target.value)}
                    placeholder="Ex: 10000"
                    min="0"
                    className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
                  />
                </div>
                {error && <p className="text-xs text-red bg-red-bg px-3 py-2 rounded-lg">{error}</p>}
              </div>
              <button
                onClick={handleCreateAccount}
                disabled={loading || !name.trim()}
                className="w-full mt-6 bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all disabled:opacity-50"
              >
                {loading ? 'Création...' : 'Continuer →'}
              </button>
            </div>
          )}

          {/* ── Étape 3 : Connexion EA ───────────────────────────── */}
          {step === 'ea' && (
            <div>
              <h2 className="text-xl font-extrabold text-dark mb-1">Connexion MT4 / MT5</h2>
              <p className="text-sm text-muted mb-5">
                Copie ces deux valeurs dans les paramètres de ton Expert Advisor pour que tes trades remontent automatiquement.
              </p>

              <div className="space-y-4 mb-6">
                <CopyField label="URL d'ingestion" value={API_URL} />
                {apiKey ? (
                  <div>
                    <CopyField label="Clé API" value={apiKey} />
                    <p className="text-[11px] text-amber mt-1.5 flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Note-la bien — elle ne sera plus affichée en clair après cette étape.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted bg-subtle rounded-lg px-4 py-3">
                    Clé API disponible dans Paramètres → Connexion EA
                  </p>
                )}
              </div>

              <div className="bg-subtle rounded-xl p-4 mb-6">
                <p className="text-xs font-semibold text-dark mb-3">Dans MetaTrader 5</p>
                <ol className="space-y-2">
                  {[
                    'Ouvre l\'Expert Advisor TradingJournal',
                    'Colle l\'URL et la clé API dans les inputs de l\'EA',
                    'Dans MT5 → Outils → Options → Expert Advisors : active les requêtes web et autorise le domaine',
                  ].map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-xs text-muted">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-dark text-white text-[10px] font-bold flex items-center justify-center mt-px">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep('goals')}
                  className="flex-1 border border-border text-text2 rounded-xl py-3 text-sm font-medium hover:bg-subtle transition-all"
                >
                  Je le ferai plus tard
                </button>
                <button
                  onClick={() => setStep('goals')}
                  className="flex-1 bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all"
                >
                  C'est fait →
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 4 : Objectifs ──────────────────────────────── */}
          {step === 'goals' && (
            <div>
              <h2 className="text-xl font-extrabold text-dark mb-1">Objectifs journaliers</h2>
              <p className="text-sm text-muted mb-6">
                Optionnel — modifiables à tout moment dans les Paramètres.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-text2 block mb-1.5">Profit cible / jour ($)</label>
                  <input
                    type="number"
                    value={dailyTarget}
                    onChange={e => setDailyTarget(e.target.value)}
                    placeholder="Ex: 100"
                    min="0"
                    className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text2 block mb-1.5">Perte max / jour ($)</label>
                  <input
                    type="number"
                    value={dailyMaxLoss}
                    onChange={e => setDailyMaxLoss(e.target.value)}
                    placeholder="Ex: 50"
                    min="0"
                    className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleSaveGoals}
                  className="flex-1 border border-border text-text2 rounded-xl py-3 text-sm font-medium hover:bg-subtle transition-all"
                >
                  Passer
                </button>
                <button
                  onClick={handleSaveGoals}
                  className="flex-1 bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all"
                >
                  Terminer →
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 5 : Done ──────────────────────────────────── */}
          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-bg rounded-full flex items-center justify-center mx-auto mb-5">
                <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" className="w-8 h-8">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="text-xl font-extrabold text-dark mb-2">Tout est prêt !</h2>
              <p className="text-sm text-muted">On t'emmène sur ton dashboard…</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
