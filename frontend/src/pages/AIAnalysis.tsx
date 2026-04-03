import { useState } from 'react'
import { api } from '../lib/api'

function MarkdownRenderer({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base font-extrabold text-dark mt-5 mb-2 first:mt-0">
          {line.slice(3)}
        </h2>
      )
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-lg font-extrabold text-dark mt-5 mb-2 first:mt-0">
          {line.slice(2)}
        </h1>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm text-dark/90 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: content }} />
      )
    } else if (/^\d+\.\s/.test(line)) {
      const content = line.replace(/^\d+\.\s/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      elements.push(
        <li key={i} className="ml-4 list-decimal text-sm text-dark/90 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: content }} />
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      const content = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
      elements.push(
        <p key={i} className="text-sm text-dark/90 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: content }} />
      )
    }
  })

  return <div className="space-y-1">{elements}</div>
}

export default function AIAnalysis() {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  async function handleAnalyze() {
    setLoading(true)
    setError(null)
    try {
      const result = await api.post<{ analysis: string }>('/api/ai/analyze', {})
      setAnalysis(result.analysis)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'analyse")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-dark">Analyse IA</h1>
          {lastRefresh && (
            <p className="text-xs text-muted mt-0.5">
              Dernière analyse : {lastRefresh.toLocaleTimeString('fr-FR')}
            </p>
          )}
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-dark text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-opacity hover:opacity-90"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Analyse en cours...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              {analysis ? 'Réanalyser' : 'Analyser mes trades'}
            </>
          )}
        </button>
      </div>

      {!analysis && !loading && !error && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="w-14 h-14 bg-subtle rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-muted">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-dark font-semibold mb-1">Analyse IA de tes performances</p>
          <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
            Clique sur « Analyser » pour obtenir des insights personnalisés sur tes trades :
            points forts, faiblesses, patterns et recommandations concrètes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {["Points forts", "Axes d'amélioration", "Patterns", "Recommandations"].map((label) => (
              <span key={label} className="px-3 py-1 bg-subtle text-muted text-xs font-medium rounded-full">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="w-5 h-5 border-2 border-dark border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium text-dark">Analyse de tes trades en cours...</span>
          </div>
          <p className="text-xs text-muted">Cela prend généralement 10-20 secondes</p>
        </div>
      )}

      {error && (
        <div className="bg-card border border-border rounded-xl p-4 border-red-200 dark:border-red-900">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          {error.includes('configurée') && (
            <p className="text-xs text-muted mt-1">
              Ajoutez <code className="bg-subtle px-1 rounded">ANTHROPIC_API_KEY</code> dans vos variables d'environnement.
            </p>
          )}
        </div>
      )}

      {analysis && !loading && (
        <div className="bg-card border border-border rounded-xl p-5">
          <MarkdownRenderer text={analysis} />
        </div>
      )}
    </div>
  )
}
