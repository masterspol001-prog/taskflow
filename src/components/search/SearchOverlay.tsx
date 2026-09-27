import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Flag, CalendarDays, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { applyFilters, type TaskFilters } from '@/lib/query'
import { PRIORITIES } from '@/lib/constants'
import { formatDateShort } from '@/lib/dates'
import { formatTime } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import type { Priority } from '@/lib/types'

type DueOption = TaskFilters['due']

export function SearchOverlay() {
  const open = useUIStore((s) => s.searchOpen)
  const setOpen = useUIStore((s) => s.setSearch)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const toggleImportant = useStore((s) => s.toggleImportant)
  const openTask = useUIStore((s) => s.openTask)

  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [projectId, setProjectId] = useState<string>('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [due, setDue] = useState<DueOption>('any')
  const [important, setImportant] = useState(false)
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQ('')
    setDebounced('')
    setProjectId('')
    setPriority('')
    setDue('any')
    setImportant(false)
    setIncludeCompleted(false)
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 140)
    return () => window.clearTimeout(t)
  }, [q])

  const results = useMemo(() => {
    if (!open) return []
    const pool = tasks.filter((t) => !t.archived)
    const res = applyFilters(pool, {
      search: debounced,
      projectId: projectId || null,
      priority: (priority as Priority) || null,
      important: important || null,
      completed: includeCompleted ? null : false,
      due,
    })
    return res
      .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate ?? '9'.repeat(10)).localeCompare(b.dueDate ?? '9'.repeat(10)) || b.priority - a.priority)
      .slice(0, 80)
  }, [open, tasks, debounced, projectId, priority, important, includeCompleted, due])

  const hasQuery = debounced.length > 0 || projectId || priority || due !== 'any' || important
  if (!open) return null
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name

  const resetFilters = () => {
    setProjectId('')
    setPriority('')
    setDue('any')
    setImportant(false)
    setIncludeCompleted(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh]" role="dialog" aria-modal="true" aria-label="Search tasks">
      <div className="absolute inset-0 bg-[var(--tf-overlay)] animate-fade-in backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-modal animate-scale-in">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-[var(--tf-border)] px-4">
          <Search size={18} className="shrink-0 text-[var(--tf-text-muted)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'Enter' && results.length > 0) {
                openTask(results[0].id)
                setOpen(false)
              }
            }}
            placeholder='Search tasks… try "report p3 #work" — combine terms & filters'
            className="w-full bg-transparent py-4 text-[15px] text-[var(--tf-text)] placeholder:text-[var(--tf-text-faint)] focus:outline-none"
            aria-label="Search tasks"
          />
          <span className="shrink-0 text-[11px] text-[var(--tf-text-faint)]">↵ first result</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--tf-border)] bg-[var(--tf-surface-2)] px-4 py-2.5">
          <FilterChip active={projectId !== ''}>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Filter by project" className="bg-transparent focus:outline-none">
              <option value="">Project</option>
              {projects.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </FilterChip>
          <FilterChip active={priority !== ''}>
            <select value={priority} onChange={(e) => setPriority(e.target.value ? (Number(e.target.value) as Priority) : '')} aria-label="Filter by priority" className="bg-transparent focus:outline-none">
              <option value="">Priority</option>
              {([1, 2, 3, 4] as const).map((p) => (
                <option key={p} value={p}>{PRIORITIES[p].label}</option>
              ))}
            </select>
          </FilterChip>
          <FilterChip active={due !== 'any'}>
            <select value={due} onChange={(e) => setDue(e.target.value as DueOption)} aria-label="Filter by due date" className="bg-transparent focus:outline-none">
              <option value="any">Due…</option>
              <option value="today">Today</option>
              <option value="upcoming">Upcoming</option>
              <option value="overdue">Overdue</option>
              <option value="week">Next 7 days</option>
              <option value="month">Next 30 days</option>
              <option value="none">No date</option>
            </select>
          </FilterChip>
          <ChipButton active={important} onClick={() => setImportant((v) => !v)} label="Important" />
          <ChipButton active={includeCompleted} onClick={() => setIncludeCompleted((v) => !v)} label="Completed" />
          {(hasQuery || includeCompleted) && (
            <button className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[var(--tf-text-faint)] hover:text-[var(--tf-text)]" onClick={resetFilters}>
              <X size={11} /> Reset
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {debounced && results.length === 0 && (
            <div className="px-3 py-10 text-center">
              <p className="text-[13.5px] font-medium text-[var(--tf-text)]">No tasks match “{debounced}”</p>
              <p className="mt-1 text-[12.5px] text-[var(--tf-text-muted)]">
                Try a different keyword, or clear a filter above. Tip: search covers titles, notes and tags.
              </p>
            </div>
          )}
          {!debounced && results.length === 0 && (
            <div className="px-3 py-10 text-center">
              <p className="text-[13.5px] font-medium text-[var(--tf-text)]">Search everything</p>
              <p className="mt-1 text-[12.5px] text-[var(--tf-text-muted)]">
                Combine a keyword with the filters to zero in fast — e.g. type <b>report</b> and pick a project.
              </p>
            </div>
          )}
          {results.map((t) => (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => { openTask(t.id); setOpen(false) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); openTask(t.id); setOpen(false) }
              }}
              className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--tf-ring)] ${t.completed ? 'opacity-60' : 'hover:bg-[var(--tf-hover)]'}`}
            >
              <TaskCheckbox completed={t.completed} priority={t.priority} size="sm" label={`Toggle complete ${t.title}`} onToggle={() => toggleComplete(t.id)} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13.5px] ${t.completed ? 'text-[var(--tf-text-muted)] line-through decoration-1' : 'text-[var(--tf-text)]'}`}>{t.title}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--tf-text-muted)]">
                  {t.projectId && projectName(t.projectId) && (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: projects.find((p) => p.id === t.projectId)?.color }} />
                      {projectName(t.projectId)}
                    </span>
                  )}
                  {t.dueDate && <span className="flex items-center gap-1"><CalendarDays size={10} /> {formatDateShort(t.dueDate)}</span>}
                  {t.dueTime && <span>{formatTime(t.dueTime)}</span>}
                  {t.tags.slice(0, 2).map((tag) => <span key={tag} className="text-[var(--tf-text-faint)]">#{tag}</span>)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {t.important && <Icon name="star" size={13} className="text-amber-400" />}
                <span className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ color: PRIORITIES[t.priority].color, background: PRIORITIES[t.priority].bg }}>
                  <Flag size={9} /> {PRIORITIES[t.priority].short}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--tf-border)] px-4 py-2 text-[11px] text-[var(--tf-text-faint)]">
          <span className="flex items-center gap-1"><Check size={11} /> Filters combine with your text</span>
          <span className="flex-1" />
          <span><kbd className="rounded border border-[var(--tf-border)] px-1 font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

function FilterChip({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className={`flex items-center rounded-lg border px-2 py-1 text-[12px] font-medium ${active ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'border-[var(--tf-border)] bg-[var(--tf-surface)] text-[var(--tf-text-secondary)]'}`}>
      {children}
    </span>
  )
}

function ChipButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-2 py-1 text-[12px] font-medium transition-colors ${
        active ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'border-[var(--tf-border)] bg-[var(--tf-surface)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-strong)]'
      }`}
    >
      {label}
    </button>
  )
}
