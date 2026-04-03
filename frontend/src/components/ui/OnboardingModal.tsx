import { useState } from 'react'
import { api } from '../../lib/api'
import { useAccountStore } from '../../stores/account'

interface Props {
  onDone: () => void
}

type Step = 'welcome' | 'account' | 'goals' | 'done'

export function OnboardingModal({ onDone }: Props) {
  const { setActiveAccountId } = useAccountStore()
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [broker, setBroker] = useState('')
  const [capital, setCapital] = useState('')
  const [dailyTarget, setDailyTarget] = useState('')
  const [dailyMaxLoss, setDailyMaxLoss] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreateAccount() {
    if (!name.trim()) { setError('Donne un nom à ton compte.'); return }
    setLoading(true)
    setError('')
    try {
      const account = await api.post<{ id: string; name: string }>('/api/accounts', {
        name: name.trim(),
        broker: broker.trim() || 'Non renseigné',
        initial_capital: parseFloat(capital) || 10000,
      })
      setActiveAccountId(account.id)
      setStep('goals')
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
    setTimeout(onDone, 1200)
  }

  function handleSkipGoals() {
    setStep('done')
    setTimeout(onDone, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface/90 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden">

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex gap-1 p-5 pb-0">
            {(['welcome', 'account', 'goals'] as const).map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= ['welcome', 'account', 'goals'].indexOf(step)
                    ? 'bg-dark'
                    : 'bg-border'
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
              <h1 className="text-2xl font-extrabold text-dark mb-2">Bienvenue 👋</h1>
              <p className="text-sm text-muted leading-relaxed mb-8">
                En 2 minutes, on configure ton espace pour que tu puisses commencer à tracker tes trades.
              </p>
              <div className="space-y-3 text-left mb-8">
                {[
                  { icon: '📊', label: 'Ton compte de trading', desc: 'Broker, capital de départ' },
                  { icon: '🎯', label: 'Tes objectifs', desc: 'Profit cible et perte max journalière' },
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
                Commencer la configuration
              </button>
            </div>
          )}

          {/* ── Étape 2 : Compte de trading ─────────────────────── */}
          {step === 'account' && (
            <div>
              <h2 className="text-xl font-extrabold text-dark mb-1">Ton compte de trading</h2>
              <p className="text-sm text-muted mb-6">Ces infos te permettront de suivre tes performances.</p>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-text2 block mb-1.5">
                    Nom du compte <span className="text-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Compte principal, Prop firm FTMO…"
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

          {/* ── Étape 3 : Objectifs ──────────────────────────────── */}
          {step === 'goals' && (
            <div>
              <h2 className="text-xl font-extrabold text-dark mb-1">Tes objectifs journaliers</h2>
              <p className="text-sm text-muted mb-6">
                Optionnel — tu pourras les modifier dans les Paramètres.
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
                  onClick={handleSkipGoals}
                  className="flex-1 border border-border text-text2 rounded-xl py-3 text-sm font-medium hover:bg-subtle transition-all"
                >
                  Passer
                </button>
                <button
                  onClick={handleSaveGoals}
                  className="flex-1 bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all"
                >
                  Enregistrer →
                </button>
              </div>
            </div>
          )}

          {/* ── Étape 4 : Done ──────────────────────────────────── */}
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
