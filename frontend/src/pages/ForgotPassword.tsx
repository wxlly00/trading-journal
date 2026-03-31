import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) setError(err.message)
    else setSent(true)
    setLoading(false)
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

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" className="w-6 h-6">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1 className="text-xl font-extrabold text-dark mb-2">Email envoyé</h1>
            <p className="text-sm text-[#888] mb-6">
              Vérifie ta boîte mail ({email}) et clique sur le lien pour réinitialiser ton mot de passe.
            </p>
            <Link to="/login" className="text-sm font-semibold text-dark hover:underline">
              Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold text-dark mb-1">Mot de passe oublié</h1>
            <p className="text-sm text-[#888] mb-6">On t'envoie un lien de réinitialisation</p>
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
              {error && <p className="text-xs text-red bg-red/5 px-3 py-2 rounded-lg">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-dark text-white rounded-xl py-3 text-sm font-bold hover:bg-[#333] transition-all disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </button>
            </form>
            <p className="text-xs text-center text-[#888] mt-6">
              <Link to="/login" className="text-dark font-semibold hover:underline">
                Retour à la connexion
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
