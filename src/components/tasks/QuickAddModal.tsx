import { useMemo, useRef, useState } from 'react'
import { Calendar, Clock, Flag, Hash, Repeat, Sparkles, CornerDownLeft } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { parseQuickAdd } from '@/lib/nlparser'
import { PRIORITIES } from '@/lib/constants'
import { formatDateShort } from '@/lib/dates'
import { formatTime } from '@/lib/time'

export function QuickAddModal() {
  const quickAddOpen = useUIStore((s) => s.quickAddOpen)
  const setQuickAdd = useUIStore((s) => s.setQuickAdd)
  const addQuickTask = useStore((s) => s.addQuickTask)
  const projects = useStore((s) => s.projects)
  const toast = useStore((s) => s.toast)
  const [value, setValue] = useState('')
  const [priorityOverride, setPriorityOverride] = useState<1 | 2 | 3 | 4 | null>(null)
  const [projectOverride, setProjectOverride] = useState<string>('')

  const parsed = useMemo(() => parseQuickAdd(value), [value])
  const resolvedProject = useMemo(() => {
    if (projectOverride) return projects.find((p) => p.id === projectOverride)
    if (parsed.projectKey) return projects.find((p) => p.name.toLowerCase() === parsed.projectKey)
    return undefined
  }, [parsed.projectKey, projectOverride, projects])

  const inputRef = useRef<HTMLInputElement>(null)
  const lastInputRef = useRef<string>('')

  if (!quickAddOpen) return null

  const effectivePriority = priorityOverride ?? parsed.priority ?? 2

  const submit = () => {
    const title = value.trim()
    if (!title) {
      toast({ title: 'Give the task a name', kind: 'info' })
      return
    }
    const task = addQuickTask({
      ...parsed,
      title: parsed.title || title,
      priority: effectivePriority,
      projectKey: resolvedProject?.name.toLowerCase() ?? parsed.projectKey,
    })
    if (!task) {
      toast({ title: 'Could not add task', message: 'Please check the text and try again.', kind: 'error' })
      return
    }
    toast({
      title: parsed.title ? `Parsed from "${title}"` : 'Task added',
      message: formatSummary(task),
      kind: 'success',
    })
    setValue('')
    setPriorityOverride(null)
    setProjectOverride('')
    setQuickAdd(false)
    // Refocus the view's quick-add context if it still exists.
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setQuickAdd(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]" role="dialog" aria-modal="true" aria-label="Quick add task">
      <div className="absolute inset-0 bg-[var(--tf-overlay)] animate-fade-in backdrop-blur-[2px]" onClick={() => setQuickAdd(false)} aria-hidden="true" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-modal animate-scale-in">
        <div className="flex items-center gap-3 border-b border-[var(--tf-border)] px-4">
          <Sparkles size={18} className="shrink-0 text-[var(--tf-accent-text)]" />
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              lastInputRef.current = e.target.value
            }}
            onKeyDown={onKey}
            placeholder='Try "Finish report tomorrow at 5pm #work p3"'
            className="w-full bg-transparent py-4 text-[15px] text-[var(--tf-text)] placeholder:text-[var(--tf-text-faint)] focus:outline-none"
            aria-label="Quick add task"
          />
        </div>

        {/* Parsed preview */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--tf-border)] bg-[var(--tf-surface-2)] px-4 py-2.5">
          <div className="flex items-center gap-1 rounded-md bg-[var(--tf-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--tf-accent-text-strong)]">
            <Calendar size={12} />
            {parsed.dueDate ? formatDateShort(parsed.dueDate) : 'No date'}
          </div>
          {parsed.dueTime && (
            <div className="flex items-center gap-1 rounded-md bg-[var(--tf-surface-3)] px-2 py-0.5 text-xs font-medium text-[var(--tf-text-secondary)]">
              <Clock size={12} />
              {formatTime(parsed.dueTime)}
            </div>
          )}
          <div className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold" style={{ color: PRIORITIES[effectivePriority].color, background: PRIORITIES[effectivePriority].bg }}>
            <Flag size={12} />
            {PRIORITIES[effectivePriority].label}
          </div>
          {resolvedProject && (
            <div className="flex items-center gap-1.5 rounded-md bg-[var(--tf-surface-3)] px-2 py-0.5 text-xs font-medium text-[var(--tf-text-secondary)]">
              <span className="h-2 w-2 rounded-full" style={{ background: resolvedProject.color }} />
              {resolvedProject.name}
            </div>
          )}
          {parsed.recurrence && (
            <div className="flex items-center gap-1 rounded-md bg-[var(--tf-surface-3)] px-2 py-0.5 text-xs font-medium text-[var(--tf-text-secondary)]">
              <Repeat size={12} /> Repeats {parsed.recurrence.freq}
            </div>
          )}
          {parsed.tags.map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-md bg-[var(--tf-surface-3)] px-2 py-0.5 text-xs text-[var(--tf-text-secondary)]">
              <Hash size={11} /> {t}
            </span>
          ))}
          {parsed.title && value.trim() !== parsed.title && (
            <span className="ml-auto truncate text-xs italic text-[var(--tf-text-muted)]">
              Title: {parsed.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex flex-1 flex-wrap items-center gap-2 text-[11px] text-[var(--tf-text-faint)]">
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="rounded border border-[var(--tf-border)] px-1 font-mono">↵</kbd> Add
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="rounded border border-[var(--tf-border)] px-1 font-mono">esc</kbd> Close
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft size={11} /> e.g. <b>p4</b>, <b>tomorrow</b>, <b>5pm</b>, <b>#work</b>, <b>+ideas</b>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={priorityOverride ?? ''}
              onChange={(e) => setPriorityOverride(e.target.value ? (Number(e.target.value) as 1 | 2 | 3 | 4) : null)}
              className="rounded-lg border border-[var(--tf-border)] bg-transparent px-2 py-1 text-xs text-[var(--tf-text-secondary)] focus:outline-none"
              aria-label="Priority"
            >
              <option value="">Priority</option>
              {([1, 2, 3, 4] as const).map((p) => (
                <option key={p} value={p}>{PRIORITIES[p].label}</option>
              ))}
            </select>
            <select
              value={projectOverride}
              onChange={(e) => setProjectOverride(e.target.value)}
              className="max-w-32 rounded-lg border border-[var(--tf-border)] bg-transparent px-2 py-1 text-xs text-[var(--tf-text-secondary)] focus:outline-none"
              aria-label="Project"
            >
              <option value="">Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatSummary(task: { title: string; dueDate: string | null; projectId: string | null }) {
  const parts = [task.title]
  if (task.dueDate) parts.push(`due ${formatDateShort(task.dueDate)}`)
  if (task.projectId) parts.push('in project')
  return parts.join(' · ')
}
