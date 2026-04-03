import { useEffect, useState, lazy, Suspense } from 'react'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'

const ExcalidrawComponent = lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw }))
)

interface LearningEntry {
  id: string
  title: string
  content: string
  tags: string[]
  created_at: string
}

interface Drawing {
  id: string
  title: string
  data: Record<string, unknown>
  created_at: string
}

type Tab = 'entries' | 'drawings'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface EntryCardProps {
  entry: LearningEntry
  onUpdate: (updated: LearningEntry) => void
  onDelete: (id: string) => void
}

function EntryCard({ entry, onUpdate, onDelete }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content)
  const [tags, setTags] = useState<string[]>(entry.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  function excerpt(text: string, max = 120) {
    return text.length > max ? text.slice(0, max) + '…' : text
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setExpanded(true)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.patch<LearningEntry>(`/api/learning/${entry.id}`, {
        title,
        content,
        tags,
      })
      onUpdate(updated)
      setEditing(false)
    } catch {
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setTitle(entry.title)
    setContent(entry.content)
    setTags(entry.tags ?? [])
    setEditing(false)
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t))
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-dark/30 transition-colors">
      <button
        className="w-full text-left px-5 py-4"
        onClick={() => !editing && setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-dark text-sm truncate">{entry.title}</h3>
            {!expanded && (
              <p className="text-muted text-xs mt-1 leading-relaxed">{excerpt(entry.content)}</p>
            )}
            {(entry.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(entry.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full bg-subtle text-dark text-[11px] font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-muted text-[11px]">{formatDate(entry.created_at)}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`w-4 h-4 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-subtle">
          {editing ? (
            <div className="pt-4 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre"
                className="w-full px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Contenu..."
                rows={6}
                className="w-full px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors resize-none leading-relaxed"
              />
              <div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dark text-white text-[11px] font-medium"
                    >
                      {t}
                      <button
                        onClick={() => removeTag(t)}
                        className="hover:text-red transition-colors leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    placeholder="Ajouter un tag..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-subtle bg-surface text-xs text-dark outline-none focus:border-dark transition-colors"
                  />
                  <button
                    onClick={addTag}
                    className="px-3 py-1.5 rounded-xl bg-subtle text-dark text-xs font-medium hover:bg-[#e5e5e5] transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-xl bg-subtle text-dark text-sm font-medium hover:bg-[#e5e5e5] transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  className="ml-auto px-4 py-2 rounded-xl text-red text-sm font-medium hover:bg-red/10 transition-colors"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-4">
              <p className="text-sm text-dark leading-relaxed whitespace-pre-wrap">{entry.content}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-subtle">
                <div className="flex flex-wrap gap-1">
                  {(tags).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-subtle text-dark text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-subtle text-dark text-xs font-medium hover:bg-[#e5e5e5] transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Modifier
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-red text-xs font-medium hover:bg-red/10 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface DrawingModalProps {
  drawing: Drawing | null
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<void>
  title: string
}

function DrawingModal({ drawing, onClose, onSave, title }: DrawingModalProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!excalidrawAPI) return
    setSaving(true)
    try {
      const elements = excalidrawAPI.getSceneElements()
      const appState = excalidrawAPI.getAppState()
      await onSave({ elements, appState })
    } finally {
      setSaving(false)
    }
  }

  const initialData: any = drawing?.data
    ? {
        elements: (drawing.data as { elements?: unknown[] }).elements ?? [],
        appState: (drawing.data as { appState?: Record<string, unknown> }).appState ?? {},
      }
    : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white border border-border rounded-xl overflow-hidden flex flex-col w-full max-w-5xl h-[90vh] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-subtle flex-shrink-0">
          <h3 className="font-semibold text-dark text-sm">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !excalidrawAPI}
              className="px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-subtle transition-colors text-muted hover:text-dark"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-muted text-sm">
                Chargement de l'éditeur...
              </div>
            }
          >
            <ExcalidrawComponent
              excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
              initialData={initialData}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

interface NewEntryFormProps {
  onSubmit: (title: string, content: string, tags: string[]) => Promise<void>
  onCancel: () => void
}

function NewEntryForm({ onSubmit, onCancel }: NewEntryFormProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  function addTag() {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await onSubmit(title, content, tags)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card border-2 border-dark rounded-xl p-5 space-y-3">
      <h3 className="font-semibold text-dark text-sm">Nouvelle entrée</h3>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre *"
        required
        className="w-full px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Contenu, stratégie, observations..."
        rows={5}
        className="w-full px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors resize-none leading-relaxed"
      />
      <div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-dark text-white text-[11px] font-medium"
            >
              {t}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                className="hover:text-red transition-colors leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Ajouter un tag (Entrée pour valider)"
            className="flex-1 px-3 py-1.5 rounded-xl border border-subtle bg-surface text-xs text-dark outline-none focus:border-dark transition-colors"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-3 py-1.5 rounded-xl bg-subtle text-dark text-xs font-medium hover:bg-[#e5e5e5] transition-colors"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
        >
          {saving ? 'Enregistrement...' : 'Créer'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-subtle text-dark text-sm font-medium hover:bg-[#e5e5e5] transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}

export default function Playbook() {
  const { activeAccountId } = useAccountStore()
  const [tab, setTab] = useState<Tab>('entries')

  const [entries, setEntries] = useState<LearningEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)
  const [showNewEntry, setShowNewEntry] = useState(false)

  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [loadingDrawings, setLoadingDrawings] = useState(true)
  const [modalDrawing, setModalDrawing] = useState<Drawing | null | 'new'>(null)
  const [newDrawingTitle, setNewDrawingTitle] = useState('')
  const [showNewDrawingInput, setShowNewDrawingInput] = useState(false)

  useEffect(() => {
    if (!activeAccountId) {
      setLoadingEntries(false)
      setLoadingDrawings(false)
      return
    }
    api.get<LearningEntry[]>(`/api/learning?account_id=${activeAccountId}`)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoadingEntries(false))

    api.get<Drawing[]>(`/api/drawings?account_id=${activeAccountId}`)
      .then(setDrawings)
      .catch(() => setDrawings([]))
      .finally(() => setLoadingDrawings(false))
  }, [activeAccountId])

  async function handleCreateEntry(title: string, content: string, tags: string[]) {
    const created = await api.post<LearningEntry>('/api/learning', {
      account_id: activeAccountId,
      title,
      content,
      tags,
    })
    setEntries((prev) => [created, ...prev])
    setShowNewEntry(false)
  }

  function handleUpdateEntry(updated: LearningEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  }

  async function handleDeleteEntry(id: string) {
    await api.delete(`/api/learning/${id}`)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleOpenNewDrawing() {
    if (!newDrawingTitle.trim()) return
    setModalDrawing('new')
  }

  async function handleSaveDrawing(data: Record<string, unknown>) {
    if (!activeAccountId) return
    if (modalDrawing === 'new') {
      const created = await api.post<Drawing>('/api/drawings', {
        account_id: activeAccountId,
        title: newDrawingTitle.trim() || 'Sans titre',
        data,
      })
      setDrawings((prev) => [created, ...prev])
      setModalDrawing(null)
      setNewDrawingTitle('')
      setShowNewDrawingInput(false)
    } else if (modalDrawing) {
      const updated = await api.patch<Drawing>(`/api/drawings/${modalDrawing.id}`, {
        title: modalDrawing.title,
        data,
      })
      setDrawings((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      setModalDrawing(null)
    }
  }

  async function handleDeleteDrawing(id: string) {
    await api.delete(`/api/drawings/${id}`)
    setDrawings((prev) => prev.filter((d) => d.id !== id))
  }

  const modalTitle =
    modalDrawing === 'new'
      ? newDrawingTitle.trim() || 'Nouveau dessin'
      : (modalDrawing as Drawing | null)?.title ?? ''

  if (!activeAccountId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-dark">Playbook</h1>
        <p className="text-muted text-sm mt-1">Vos stratégies et setups de trading</p>
        <div className="mt-12 text-center text-muted text-sm">
          Sélectionnez un compte dans les paramètres pour accéder au playbook.
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 md:mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-dark">Playbook</h1>
          <p className="text-muted text-sm mt-1">Vos stratégies et setups de trading</p>
        </div>
        <div className="flex gap-1 bg-subtle p-1 rounded-xl">
          <button
            onClick={() => setTab('entries')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'entries' ? 'bg-white text-dark shadow-sm' : 'text-muted hover:text-dark'
            }`}
          >
            Entrées
          </button>
          <button
            onClick={() => setTab('drawings')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'drawings' ? 'bg-white text-dark shadow-sm' : 'text-muted hover:text-dark'
            }`}
          >
            Dessins
          </button>
        </div>
      </div>

      {tab === 'entries' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            {!showNewEntry && (
              <button
                onClick={() => setShowNewEntry(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nouvelle entrée
              </button>
            )}
          </div>

          {showNewEntry && (
            <NewEntryForm
              onSubmit={handleCreateEntry}
              onCancel={() => setShowNewEntry(false)}
            />
          )}

          {loadingEntries ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                  <div className="h-3 w-48 bg-subtle rounded mb-3" />
                  <div className="space-y-2">
                    <div className="h-2 w-full bg-subtle rounded" />
                    <div className="h-2 w-3/4 bg-subtle rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center text-muted text-sm">
              Aucune entrée pour le moment. Créez votre première entrée !
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onUpdate={handleUpdateEntry}
                  onDelete={handleDeleteEntry}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'drawings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-2">
            {showNewDrawingInput ? (
              <div className="flex items-center gap-2">
                <input
                  value={newDrawingTitle}
                  onChange={(e) => setNewDrawingTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpenNewDrawing()}
                  placeholder="Titre du dessin"
                  autoFocus
                  className="px-3 py-2 rounded-xl border border-subtle bg-surface text-sm text-dark outline-none focus:border-dark transition-colors w-56"
                />
                <button
                  onClick={handleOpenNewDrawing}
                  disabled={!newDrawingTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
                >
                  Ouvrir
                </button>
                <button
                  onClick={() => { setShowNewDrawingInput(false); setNewDrawingTitle('') }}
                  className="px-4 py-2 rounded-xl bg-subtle text-dark text-sm font-medium hover:bg-[#e5e5e5] transition-colors"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewDrawingInput(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nouveau dessin
              </button>
            )}
          </div>

          {loadingDrawings ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                  <div className="h-32 bg-subtle rounded-xl mb-3" />
                  <div className="h-3 w-28 bg-subtle rounded" />
                </div>
              ))}
            </div>
          ) : drawings.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center text-muted text-sm">
              Aucun dessin pour le moment. Créez votre premier dessin !
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {drawings.map((drawing) => (
                <div
                  key={drawing.id}
                  className="bg-card border border-border rounded-xl p-4 group cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setModalDrawing(drawing)}
                >
                  <div className="h-32 bg-subtle rounded-xl mb-3 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-muted">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-dark text-sm truncate max-w-[160px]">
                        {drawing.title}
                      </h3>
                      <p className="text-muted text-xs mt-0.5">{formatDate(drawing.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDrawing(drawing.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red/10 text-muted hover:text-red transition-all"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modalDrawing !== null && (
        <DrawingModal
          drawing={modalDrawing === 'new' ? null : modalDrawing}
          onClose={() => setModalDrawing(null)}
          onSave={handleSaveDrawing}
          title={modalTitle}
        />
      )}
    </div>
  )
}
