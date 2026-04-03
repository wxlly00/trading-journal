import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function toEmail(username: string) {
  return `${username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_')}@tj.app`
}

const Logo = () => (
  <div className="flex items-center gap-2 mb-8">
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
      <rect x="2" y="12" width="4" height="10" rx="1" fill="#111"/>
      <rect x="10" y="7" width="4" height="15" rx="1" fill="#111"/>
      <rect x="18" y="2" width="4" height="20" rx="1" fill="#111"/>
      <path d="M3 10 L11 5 L19 1" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    <span className="text-xl font-extrabold text-dark">TradingJournal</span>
  </div>
)

export default function Register() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const u = username.trim()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 6) { setError('Minimum 6 caractères.'); return }
    setLoading(true)
    setError('')
    try {
      // 1. Créer l'user via le backend (admin API, zéro email)
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Erreur lors de la création.')
        setLoading(false)
        return
      }
      // 2. Connecter directement
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: toEmail(u),
        password,
      })
      if (signInErr) {
        setError('Compte créé. Connecte-toi.')
        navigate('/login')
      } else {
        navigate('/')
      }
    } catch {
      setError('Erreur réseau. Réessaie.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm">
        <Logo />
        <h1 className="text-2xl font-extrabold text-dark mb-1">Créer un compte</h1>
        <p className="text-sm text-muted mb-6">Choisis un pseudo et un mot de passe</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-text2 block mb-1.5">
              Pseudo <span className="font-normal text-muted">(lettres, chiffres, _)</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
              placeholder="ex: trader_pro"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text2 block mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-text2 block mb-1.5">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-4 py-3 text-sm text-dark outline-none focus:border-dark transition-all"
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>
          {error && <p className="text-xs text-red bg-red-bg px-3 py-2 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
        <p className="text-xs text-center text-muted mt-6">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-dark font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
