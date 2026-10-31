import { useMemo, useState } from 'react'
import { Pin, Plus, Trash2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { EmptyState } from '@/components/ui/states'

export function NotesView() {
  const notes = useStore((s) => s.notes)
  const projects = useStore((s) => s.projects)
  const addNote = useStore((s) => s.addNote)
  const updateNote = useStore((s) => s.updateNote)
  const removeNote = useStore((s) => s.removeNote)
  const [selectedId, setSelectedId] = useState<string | null>(notes[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? notes[0] ?? null, [notes, selectedId])
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
      : notes
    return [...filtered].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt)
  }, [notes, query])

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="display text-[22px] font-semibold tracking-tight text-[var(--tf-text)]">Notes</h2>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              const n = addNote({ title: 'Untitled note' })
              if (n) setSelectedId(n.id)
            }}
          >
            <Plus size={14} /> New
          </button>
        </div>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes"
          aria-label="Search notes"
        />
        {ordered.length === 0 ? (
          <EmptyState
            icon="book"
            title={query.trim() ? 'No matching notes' : 'No notes yet'}
            description={query.trim() ? 'Try a different word.' : 'Capture a thought here. Notes stay on this device.'}
          />
        ) : (
          <ul className="space-y-1">
            {ordered.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`w-full rounded-xl px-3 py-2 text-left ${selected?.id === n.id ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'hover:bg-[var(--tf-hover)]'}`}
                  onClick={() => setSelectedId(n.id)}
                >
                  <p className="truncate text-[13.5px] font-medium">{n.pinned ? 'Pinned · ' : ''}{n.title || 'Untitled'}</p>
                  <p className="truncate text-[11px] text-[var(--tf-text-faint)]">{n.body || 'Empty'}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      {selected && (
        <div className="space-y-3">
          <input
            className="input text-[18px] font-semibold"
            value={selected.title}
            onChange={(e) => updateNote(selected.id, { title: e.target.value })}
            aria-label="Note title"
          />
          <div className="flex flex-wrap gap-2">
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={selected.projectId ?? ''}
              onChange={(e) => updateNote(selected.id, { projectId: e.target.value || null })}
              aria-label="Link note to project"
            >
              <option value="">No project</option>
              {projects.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => updateNote(selected.id, { pinned: !selected.pinned })}>
              <Pin size={13} /> {selected.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { removeNote(selected.id); setSelectedId(null) }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
          <textarea
            className="input min-h-[18rem]"
            value={selected.body}
            onChange={(e) => updateNote(selected.id, { body: e.target.value })}
            placeholder="Write…"
            aria-label="Note body"
          />
        </div>
      )}
    </div>
  )
}
