import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Flag, CalendarDays, Check, Sparkles, Clock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { applyFilters, type TaskFilters } from '@/lib/query'
import { PRIORITIES } from '@/lib/constants'
import { formatDateShort } from '@/lib/dates'
import { formatTime } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import type { Priority, Task, ViewId } from '@/lib/types'
import { parseCommand, captureFromText } from '@/lib/agent'
import { loadRecentSearches, matchPaletteCommands, pushRecentSearch, type PaletteCommand } from '@/lib/commands'

type DueOption = TaskFilters['due']
type ExtraHit = { kind: 'project' | 'goal' | 'note'; id: string; title: string }
type PaletteRow =
  | { key: string; kind: 'command'; command: PaletteCommand }
  | { key: string; kind: 'recent'; q: string }
  | { key: string; kind: 'extra'; hit: ExtraHit }
  | { key: string; kind: 'task'; task: Task }

function highlight(text: string, q: string) {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-[var(--tf-accent-soft)] text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

export function SearchOverlay() {
  const open = useUIStore((s) => s.searchOpen)
  const setOpen = useUIStore((s) => s.setSearch)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const notes = useStore((s) => s.notes)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const openTask = useUIStore((s) => s.openTask)
  const navigate = useUIStore((s) => s.navigate)
  const setAi = useUIStore((s) => s.setAi)
  const setFocus = useUIStore((s) => s.setFocus)
  const setQuickAdd = useUIStore((s) => s.setQuickAdd)
  const addQuickTask = useStore((s) => s.addQuickTask)
  const setEnergy = useStore((s) => s.setEnergy)
  const toast = useStore((s) => s.toast)

  const runCommand = (raw: string) => {
    const cmd = parseCommand(raw)
    if (cmd.kind === 'search') return false
    if (cmd.kind === 'plan' || cmd.kind === 'next') {
      setOpen(false)
      setAi(true, 'today')
      return true
    }
    if (cmd.kind === 'focus') {
      setOpen(false)
      setFocus(true)
      return true
    }
    if (cmd.kind === 'navigate') {
      setOpen(false)
      navigate(cmd.view as ViewId)
      return true
    }
    if (cmd.kind === 'energy') {
      setEnergy(cmd.energy)
      toast({ title: `Energy: ${cmd.energy}`, kind: 'success' })
      setOpen(false)
      return true
    }
    if (cmd.kind === 'add') {
      if (!cmd.text) {
        setOpen(false)
        setQuickAdd(true)
        return true
      }
      const created = addQuickTask(captureFromText(cmd.text))
      if (created) toast({ title: 'Captured', message: created.title, kind: 'success' })
      setOpen(false)
      return true
    }
    if (cmd.kind === 'goal') {
      setOpen(false)
      useUIStore.getState().setGoalCreate(true)
      navigate('goals')
      return true
    }
    if (cmd.kind === 'shutdown') {
      setOpen(false)
      useUIStore.getState().setShutdown(true)
      return true
    }
    if (cmd.kind === 'morning') {
      setOpen(false)
      useUIStore.getState().setMorning(true)
      return true
    }
    if (cmd.kind === 'shortcuts') {
      setOpen(false)
      useUIStore.getState().setShortcuts(true)
      return true
    }
    return false
  }

  const runPalette = (command: PaletteCommand) => {
    const a = command.action
    setOpen(false)
    if (a.type === 'navigate') navigate(a.view)
    else if (a.type === 'plan') setAi(true, 'today')
    else if (a.type === 'focus') setFocus(true)
    else if (a.type === 'goal') {
      useUIStore.getState().setGoalCreate(true)
      navigate('goals')
    } else if (a.type === 'quickAdd') setQuickAdd(true)
    else if (a.type === 'shutdown') useUIStore.getState().setShutdown(true)
    else if (a.type === 'morning') useUIStore.getState().setMorning(true)
    else if (a.type === 'energy') {
      setEnergy(a.energy)
      toast({ title: `Energy: ${a.energy}`, kind: 'success' })
    } else if (a.type === 'shortcuts') useUIStore.getState().setShortcuts(true)
  }

  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [projectId, setProjectId] = useState<string>('')
  const [priority, setPriority] = useState<Priority | ''>('')
  const [due, setDue] = useState<DueOption>('any')
  const [important, setImportant] = useState(false)
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [recents, setRecents] = useState<string[]>([])
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
    setCursor(0)
    setRecents(loadRecentSearches())
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

  const extraHits = useMemo(() => {
    const needle = debounced.toLowerCase()
    if (!needle) return [] as ExtraHit[]
    const hits: ExtraHit[] = []
    for (const p of projects) {
      if (!p.archived && (p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle))) hits.push({ kind: 'project', id: p.id, title: p.name })
    }
    for (const g of goals) {
      if (g.status !== 'archived' && g.title.toLowerCase().includes(needle)) hits.push({ kind: 'goal', id: g.id, title: g.title })
    }
    for (const n of notes) {
      if (n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle)) hits.push({ kind: 'note', id: n.id, title: n.title || 'Untitled note' })
    }
    return hits.slice(0, 8)
  }, [debounced, projects, goals, notes])

  const commands = useMemo(() => matchPaletteCommands(debounced, debounced ? 6 : 8), [debounced])

  const rows = useMemo<PaletteRow[]>(() => {
    const out: PaletteRow[] = []
    if (!debounced) {
      for (const recent of recents) out.push({ key: `recent-${recent}`, kind: 'recent', q: recent })
    }
    for (const command of commands) out.push({ key: `cmd-${command.id}`, kind: 'command', command })
    for (const hit of extraHits) out.push({ key: `extra-${hit.kind}-${hit.id}`, kind: 'extra', hit })
    const showTasks = Boolean(debounced) || Boolean(projectId) || Boolean(priority) || due !== 'any' || important || includeCompleted
    if (showTasks) {
      for (const task of results) out.push({ key: `task-${task.id}`, kind: 'task', task })
    }
    return out
  }, [debounced, recents, commands, extraHits, results, projectId, priority, due, important, includeCompleted])

  useEffect(() => {
    setCursor(0)
  }, [debounced, projectId, priority, due, important, includeCompleted])

  const remember = (term: string) => setRecents(pushRecentSearch(term))

  const activate = (row: PaletteRow) => {
    if (row.kind === 'command') {
      runPalette(row.command)
      return
    }
    if (row.kind === 'recent') {
      setQ(row.q)
      setDebounced(row.q)
      return
    }
    if (row.kind === 'extra') {
      remember(debounced || row.hit.title)
      if (row.hit.kind === 'project') navigate('all', { projectId: row.hit.id })
      else if (row.hit.kind === 'goal') navigate('goals')
      else navigate('notes')
      setOpen(false)
      return
    }
    remember(debounced || row.task.title)
    openTask(row.task.id)
    setOpen(false)
  }

  const hasQuery = debounced.length > 0 || projectId || priority || due !== 'any' || important || includeCompleted
  if (!open) return null
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name

  const resetFilters = () => {
    setQ('')
    setDebounced('')
    setProjectId('')
    setPriority('')
    setDue('any')
    setImportant(false)
    setIncludeCompleted(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh]" role="dialog" aria-modal="true" aria-label="Search or jump">
      <div className="absolute inset-0 bg-[var(--tf-overlay)] animate-fade-in backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-modal animate-scale-in">
        <div className="flex items-center gap-3 border-b border-[var(--tf-border)] px-4">
          <Search size={18} className="shrink-0 text-[var(--tf-text-muted)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setCursor((c) => Math.min(rows.length - 1, c + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setCursor((c) => Math.max(0, c - 1))
              }
              if (e.key === 'Enter') {
                e.preventDefault()
                if (runCommand(q)) return
                const row = rows[cursor] ?? rows[0]
                if (row) activate(row)
              }
            }}
            placeholder="Search or jump — /plan /add /focus /today"
            className="w-full bg-transparent py-4 text-[15px] text-[var(--tf-text)] placeholder:text-[var(--tf-text-faint)] focus:outline-none"
            aria-label="Search or jump"
            aria-activedescendant={rows[cursor]?.key}
            role="combobox"
            aria-expanded
            aria-controls="tf-command-list"
          />
          <span className="shrink-0 text-[11px] text-[var(--tf-text-faint)]">↑↓ ↵</span>
        </div>

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

        <div id="tf-command-list" role="listbox" className="flex-1 overflow-y-auto px-2 py-2">
          {rows.length === 0 && hasQuery && (
            <div className="px-3 py-10 text-center">
              <p className="text-[13.5px] font-medium text-[var(--tf-text)]">
                {debounced ? `No matches for “${debounced}”` : 'No tasks match those filters'}
              </p>
              <p className="mt-1 text-[12.5px] text-[var(--tf-text-muted)]">
                Search covers tasks, projects, goals, notes, and commands.
              </p>
            </div>
          )}
          {rows.map((row, i) => {
            const active = i === cursor
            const cls = `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] outline-none ${active ? 'bg-[var(--tf-hover)]' : 'hover:bg-[var(--tf-hover)]'}`
            if (row.kind === 'recent') {
              return (
                <button key={row.key} id={row.key} role="option" aria-selected={active} type="button" className={cls} onMouseEnter={() => setCursor(i)} onClick={() => activate(row)}>
                  <Clock size={13} className="text-[var(--tf-text-faint)]" />
                  <span className="truncate text-[var(--tf-text)]">{row.q}</span>
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-text-faint)]">Recent</span>
                </button>
              )
            }
            if (row.kind === 'command') {
              return (
                <button key={row.key} id={row.key} role="option" aria-selected={active} type="button" className={cls} onMouseEnter={() => setCursor(i)} onClick={() => activate(row)}>
                  <Sparkles size={13} className="text-[var(--tf-accent)]" />
                  <span className="truncate text-[var(--tf-text)]">{row.command.label}</span>
                  {row.command.slash && <span className="ml-auto font-mono text-[11px] text-[var(--tf-text-faint)]">{row.command.slash}</span>}
                </button>
              )
            }
            if (row.kind === 'extra') {
              return (
                <button key={row.key} id={row.key} role="option" aria-selected={active} type="button" className={cls} onMouseEnter={() => setCursor(i)} onClick={() => activate(row)}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-text-faint)]">{row.hit.kind}</span>
                  <span className="truncate text-[var(--tf-text)]">{highlight(row.hit.title, debounced)}</span>
                </button>
              )
            }
            const t = row.task
            return (
              <div
                key={row.key}
                id={row.key}
                role="option"
                aria-selected={active}
                tabIndex={-1}
                onMouseEnter={() => setCursor(i)}
                onClick={() => activate(row)}
                className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left outline-none ${t.completed ? 'opacity-60' : ''} ${active ? 'bg-[var(--tf-hover)]' : 'hover:bg-[var(--tf-hover)]'}`}
              >
                <TaskCheckbox completed={t.completed} priority={t.priority} size="sm" label={`Toggle complete ${t.title}`} onToggle={() => toggleComplete(t.id)} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[13.5px] ${t.completed ? 'text-[var(--tf-text-muted)] line-through decoration-1' : 'text-[var(--tf-text)]'}`}>{highlight(t.title, debounced)}</p>
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
            )
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--tf-border)] px-4 py-2 text-[11px] text-[var(--tf-text-faint)]">
          <span className="flex items-center gap-1"><Check size={11} /> Commands, search, jump</span>
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
