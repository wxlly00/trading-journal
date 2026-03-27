import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (mode === 'register') {
      if (password !== confirm) {
        setError('Les mots de passe ne correspondent pas.')
        return
      }
      if (password.length < 6) {
        setError('Le mot de passe doit faire au moins 6 caractères.')
        return
      }
    }

    setLoading(true)

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
      else navigate('/')
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) {
        setError(err.message)
      } else {
        setSuccess('Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.')
        setEmail('')
        setPassword('')
        setConfirm('')
      }
    }

    setLoading(false)
  }

  function switchMode() {
    setMode(m => m === 'login' ? 'register' : 'login')
    setError('')
    setSuccess('')
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 w-full max-w-sm shadow-sm">
        <div className="flex items-center gap-2 mb-8">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
            <rect x="2" y="12" width="4" height="10" rx="1" fill="#111"/>
            <rect x="10" y="7" width="4" height="15" rx="1" fill="#111"/>
            <rect x="18" y="2" width="4" height="20" rx="1" fill="#111"/>
            <path d="M3 10 L11 5 L19 1" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span className="text-xl font-extrabold text-dark">TradingJournal</span>
        </div>

        <h1 className="text-2xl font-extrabold text-dark mb-1">
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </h1>
        <p className="text-sm text-[#888] mb-6">
          {mode === 'login' ? 'Accédez à votre journal de trading' : 'Commencez à suivre vos trades'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-[#666] block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-surface rounded-xl px-4 py-3 text-sm text-dark outline-none border border-transparent focus:border-dark transition-all"
              placeholder="trader@example.com"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#666] block mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface rounded-xl px-4 py-3 text-sm text-dark outline-none border border-transparent focus:border-dark transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="text-xs font-semibold text-[#666] block mb-1.5">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full bg-surface rounded-xl px-4 py-3 text-sm text-dark outline-none border border-transparent focus:border-dark transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {error && <p className="text-xs text-red bg-red/5 px-3 py-2 rounded-lg">{error}</p>}
          {success && <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all disabled:opacity-50"
          >
            {loading
              ? (mode === 'login' ? 'Connexion...' : 'Création...')
              : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
          </button>
        </form>

        <p className="text-xs text-center text-[#888] mt-6">
          {mode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}
          {' '}
          <button
            onClick={switchMode}
            className="text-dark font-semibold hover:underline"
          >
            {mode === 'login' ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  )
}
