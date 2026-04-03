import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 6) { setError('Minimum 6 caractères.'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) setError(err.message)
    else navigate('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
            <rect x="2" y="12" width="4" height="10" rx="1" fill="#111"/>
            <rect x="10" y="7" width="4" height="15" rx="1" fill="#111"/>
            <rect x="18" y="2" width="4" height="20" rx="1" fill="#111"/>
            <path d="M3 10 L11 5 L19 1" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-xl font-extrabold text-dark">TradingJournal</span>
        </div>
        <h1 className="text-2xl font-extrabold text-dark mb-1">Nouveau mot de passe</h1>
        <p className="text-sm text-muted mb-6">Choisis un mot de passe sécurisé</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-text2 block mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text2 block mb-1.5">Confirmer</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-xs text-red bg-red-bg px-3 py-2 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all disabled:opacity-50"
          >
            {loading ? 'Mise à jour...' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  )
}
