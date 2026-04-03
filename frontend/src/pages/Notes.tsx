import { useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { useAccountStore } from '../stores/account'

interface Note {
  id: string
  date: string
  content: string
  created_at: string
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function Notes() {
  const { activeAccountId } = useAccountStore()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(todayIso())
  const [content, setContent] = useState<string>('')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!activeAccountId) {
      setLoading(false)
      return
    }
    setLoading(true)
    api.get<Note[]>(`/api/notes?account_id=${activeAccountId}`)
      .then((data) => {
        setNotes(data)
        const todayNote = data.find((n) => n.date === selectedDate)
        setContent(todayNote?.content ?? '')
      })
      .catch(() => setNotes([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId])

  useEffect(() => {
    const note = notes.find((n) => n.date === selectedDate)
    setContent(note?.content ?? '')
    setSaveState('idle')
  }, [selectedDate, notes])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  const saveNote = useCallback(
    async (value: string) => {
      if (!activeAccountId) return
      setSaveState('saving')
      try {
        const existing = notes.find((n) => n.date === selectedDate)
        if (existing) {
          const updated = await api.patch<Note>(`/api/notes/${existing.id}`, { content: value })
          setNotes((prev) => prev.map((n) => (n.id === existing.id ? updated : n)))
        } else {
          const created = await api.post<Note>('/api/notes', {
            account_id: activeAccountId,
            date: selectedDate,
            content: value,
          })
          setNotes((prev) => [...prev, created])
        }
        setSaveState('saved')
      } catch {
        setSaveState('idle')
      }
    },
    [activeAccountId, notes, selectedDate]
  )

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setContent(value)
    setSaveState('saving')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveNote(value)
    }, 1000)
  }

  function handleBlur() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (saveState === 'saving') {
      saveNote(content)
    }
  }

  function jumpToToday() {
    const today = todayIso()
    setSelectedDate(today)
    if (!notes.find((n) => n.date === today)) {
      setContent('')
    }
  }

  function handleDeleteNote(id: string) {
    api.delete(`/api/notes/${id}`).then(() => {
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (notes.find((n) => n.id === id)?.date === selectedDate) {
        setContent('')
      }
    })
  }

  const sortedDates = Array.from(
    new Set([
      todayIso(),
      ...notes.map((n) => n.date),
    ])
  ).sort((a, b) => b.localeCompare(a))

  const currentNote = notes.find((n) => n.date === selectedDate)

  if (!activeAccountId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-extrabold text-dark">Notes</h1>
        <p className="text-muted text-sm mt-1">Vos réflexions et observations de marché</p>
        <div className="mt-12 text-center text-muted text-sm">
          Sélectionnez un compte dans les paramètres pour accéder aux notes.
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 flex-shrink-0">
        <h1 className="text-2xl font-extrabold text-dark">Notes</h1>
        <p className="text-muted text-sm mt-1">Vos réflexions et observations de marché</p>
      </div>

      {/* Body: two panels */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden px-4 md:px-6 pb-4 md:pb-6 gap-3 md:gap-4">
        {/* Left panel: date list — horizontal scroll on mobile, sidebar on desktop */}
        <div className="md:w-[220px] md:flex-shrink-0 bg-card border border-border rounded-xl overflow-hidden flex flex-col md:h-auto h-auto max-h-40 md:max-h-none">
          <div className="p-3 border-b border-subtle flex-shrink-0">
            <button
              onClick={jumpToToday}
              className="w-full py-2 px-3 rounded-xl bg-dark text-white text-sm font-semibold hover:bg-[#333] transition-colors"
            >
              Aujourd'hui
            </button>
          </div>

          <div className="flex-1 overflow-y-auto md:overflow-y-auto overflow-x-auto md:overflow-x-hidden">
            {loading ? (
              <div className="p-3 flex md:flex-col gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 w-28 md:w-auto bg-subtle rounded-xl animate-pulse flex-shrink-0" />
                ))}
              </div>
            ) : (
              <ul className="p-2 flex flex-row md:flex-col gap-1 md:gap-0 md:space-y-0.5">
                {sortedDates.map((date) => {
                  const hasNote = !!notes.find((n) => n.date === date)
                  const isToday = date === todayIso()
                  const isSelected = date === selectedDate
                  return (
                    <li key={date}>
                      <button
                        onClick={() => setSelectedDate(date)}
                        className={`md:w-full text-left px-3 py-2 md:py-2.5 rounded-xl text-xs md:text-sm transition-all flex items-center justify-between group whitespace-nowrap ${
                          isSelected
                            ? 'bg-subtle font-semibold text-dark'
                            : 'text-muted hover:text-dark hover:bg-subtle'
                        }`}
                      >
                        <span>
                          {isToday ? (
                            <span className="flex flex-col leading-tight">
                              <span className={isSelected ? 'text-dark' : 'text-dark'}>
                                Aujourd'hui
                              </span>
                              <span className="text-[11px] text-muted font-normal">
                                {formatDate(date)}
                              </span>
                            </span>
                          ) : (
                            formatDate(date)
                          )}
                        </span>
                        {hasNote && (
                          <span className="w-1.5 h-1.5 rounded-full bg-dark flex-shrink-0 ml-2" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right panel: editor */}
        <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          {/* Date header */}
          <div className="px-6 py-4 border-b border-subtle flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-dark">
                {selectedDate === todayIso()
                  ? "Aujourd'hui"
                  : formatDate(selectedDate)}
              </h2>
              {selectedDate === todayIso() && (
                <p className="text-xs text-muted mt-0.5">{formatDate(selectedDate)}</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentNote && (
                <button
                  onClick={() => handleDeleteNote(currentNote.id)}
                  className="text-muted hover:text-red transition-colors p-1.5 rounded-lg hover:bg-subtle"
                  title="Supprimer cette note"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              )}
              <span className="text-xs text-muted">
                {saveState === 'saving' && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-muted border-t-transparent rounded-full animate-spin inline-block" />
                    En cours...
                  </span>
                )}
                {saveState === 'saved' && (
                  <span className="flex items-center gap-1.5 text-green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Enregistré
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Textarea area */}
          <div className="flex-1 overflow-y-auto p-6">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onBlur={handleBlur}
              placeholder="Aucune note pour cette date. Commencez à écrire..."
              className="w-full resize-none outline-none bg-transparent text-dark text-sm leading-relaxed placeholder:text-muted/50 font-mono"
              style={{ minHeight: '400px', overflow: 'hidden' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
