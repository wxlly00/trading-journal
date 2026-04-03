import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface Rule {
  id: string
  title: string
  description: string
  category: string
  active: boolean
  violations: number
}

const CATEGORIES = [
  { value: 'general', label: 'Général' },
  { value: 'entry', label: 'Entrée' },
  { value: 'exit', label: 'Sortie' },
  { value: 'risk', label: 'Risque' },
  { value: 'psychology', label: 'Psychologie' },
]

const DEFAULT_RULES = [
  { title: 'Ne pas trader contre la tendance', category: 'entry', description: '' },
  { title: 'Toujours définir un stop loss avant d\'entrer', category: 'risk', description: '' },
  { title: 'Ne jamais dépasser 2% de risque par trade', category: 'risk', description: '' },
  { title: 'Ne pas trader en période de news majeures', category: 'entry', description: '' },
  { title: 'Respecter le plan de trading sans modifier le SL', category: 'exit', description: '' },
]

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newCat, setNewCat] = useState('general')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await api.get<Rule[]>('/api/rules')
      setRules(data)
    } catch {
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAdd() {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const rule = await api.post<Rule>('/api/rules', { title: newTitle, description: newDesc, category: newCat })
      setRules(prev => [...prev, rule])
      setNewTitle('')
      setNewDesc('')
      setNewCat('general')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(rule: Rule) {
    await api.patch(`/api/rules/${rule.id}`, { active: !rule.active })
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))
  }

  async function handleDelete(id: string) {
    await api.delete(`/api/rules/${id}`)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  async function addDefaultRules() {
    setSaving(true)
    for (const r of DEFAULT_RULES) {
      const rule = await api.post<Rule>('/api/rules', r)
      setRules(prev => [...prev, rule])
    }
    setSaving(false)
  }

  const totalViolations = rules.reduce((s, r) => s + (r.violations || 0), 0)
  const activeCount = rules.filter(r => r.active).length

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-dark">Règles de trading</h1>
          <p className="text-sm text-muted mt-0.5">{activeCount} règles actives · {totalViolations} violations totales</p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-dark text-white rounded-xl text-sm font-semibold hover:bg-[#333] transition-all"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter
        </button>
      </div>

      {rules.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Règles', value: rules.length },
            { label: 'Actives', value: activeCount },
            { label: 'Violations', value: totalViolations },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-2xl font-black text-dark">{value}</p>
              <p className="text-xs text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-bold text-dark">Nouvelle règle</p>
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Ex: Ne jamais dépasser 2% de risque par trade"
            className="w-full bg-surface rounded-xl px-4 py-3 text-sm text-dark outline-none border border-border focus:border-dark transition-all"
            autoFocus
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optionnelle)"
            rows={2}
            className="w-full bg-surface rounded-xl px-4 py-3 text-sm text-dark outline-none border border-border focus:border-dark transition-all resize-none"
          />
          <select
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            className="w-full bg-surface rounded-xl px-4 py-3 text-sm text-dark outline-none border border-border focus:border-dark transition-all"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !newTitle.trim()}
              className="flex-1 bg-dark text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40"
            >
              {saving ? 'Ajout...' : 'Ajouter'}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-4 bg-subtle text-dark rounded-xl py-2.5 text-sm font-medium"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!loading && rules.length === 0 && !adding && (
        <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-12 h-12 text-muted mx-auto">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <p className="text-sm font-medium text-dark">Aucune règle définie</p>
          <p className="text-xs text-muted">Les règles t'aident à rester discipliné et à tracker tes violations</p>
          <button
            onClick={addDefaultRules}
            disabled={saving}
            className="px-6 py-2.5 bg-dark text-white rounded-xl text-sm font-semibold hover:bg-[#333] transition-all disabled:opacity-40"
          >
            {saving ? 'Ajout...' : 'Ajouter les règles de base'}
          </button>
        </div>
      )}

      {!loading && rules.length > 0 && (
        <div className="space-y-2">
          {rules
            .sort((a, b) => (b.violations || 0) - (a.violations || 0))
            .map(rule => (
            <div
              key={rule.id}
              className={`bg-card border border-border rounded-xl p-4 flex items-start gap-3 transition-opacity ${!rule.active ? 'opacity-50' : ''}`}
            >
              <button
                onClick={() => handleToggle(rule)}
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  rule.active ? 'bg-dark border-dark' : 'border-border bg-transparent'
                }`}
              >
                {rule.active && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-dark leading-tight">{rule.title}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(rule.violations || 0) > 0 && (
                      <span className="text-xs font-bold text-red bg-red/10 px-2 py-0.5 rounded-full">
                        {rule.violations}x
                      </span>
                    )}
                    <span className="text-[10px] font-medium text-muted bg-subtle px-2 py-0.5 rounded-full capitalize">
                      {CATEGORIES.find(c => c.value === rule.category)?.label ?? rule.category}
                    </span>
                  </div>
                </div>
                {rule.description && (
                  <p className="text-xs text-muted mt-1">{rule.description}</p>
                )}
              </div>

              <button
                onClick={() => handleDelete(rule.id)}
                className="text-muted hover:text-red transition-colors flex-shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-16 animate-pulse" />
          ))}
        </div>
      )}
    </div>
  )
}
