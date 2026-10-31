import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { parseQuickAdd } from '@/lib/nlparser'
import { formatDateShort } from '@/lib/dates'
import { PRIORITIES } from '@/lib/constants'

export function AddTaskRow({
  projectId = null,
  section = null,
  placeholder = 'Add a task…',
  onCreated,
  defaultPriority,
  defaultDueDate,
  parked = false,
}: {
  projectId?: string | null
  section?: string | null
  placeholder?: string
  onCreated?: () => void
  defaultPriority?: 1 | 2 | 3 | 4
  defaultDueDate?: string | null
  parked?: boolean
}) {
  const addTask = useStore((s) => s.addTask)
  const projects = useStore((s) => s.projects)
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const parsed = useMemo(() => (value.trim() ? parseQuickAdd(value) : null), [value])
  const chips = parsed
    ? [
        parsed.dueDate ? formatDateShort(parsed.dueDate) : null,
        parsed.dueTime,
        parsed.priority ? PRIORITIES[parsed.priority].label : null,
        parsed.estimate ? `${parsed.estimate}m` : null,
        parsed.projectKey ? `#${parsed.projectKey}` : null,
        parsed.recurrence ? parsed.recurrence.freq : null,
      ].filter(Boolean)
    : []

  const submit = () => {
    const raw = value.trim()
    if (!raw) return
    const parsed = parseQuickAdd(raw)
    const matched = parsed.projectKey
      ? projects.find((p) => p.name.toLowerCase() === parsed.projectKey)
      : undefined
    addTask({
      title: parsed.title || raw,
      projectId: projectId ?? matched?.id ?? null,
      section: section ?? null,
      priority: defaultPriority ?? parsed.priority ?? undefined,
      dueDate: parsed.dueDate ?? defaultDueDate ?? null,
      dueTime: parsed.dueTime,
      estimate: parsed.estimate,
      tags: parsed.tags,
      recurrence: parsed.recurrence,
      parked,
    })
    setValue('')
    onCreated?.()
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border px-3.5 transition-all ${
        focused
          ? 'border-[var(--tf-accent)] bg-[var(--tf-surface-solid)] shadow-[0_0_0_4px_var(--tf-ring),var(--tf-shadow)]'
          : 'border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-[var(--tf-shadow)] hover:border-[var(--tf-border-strong)]'
      }`}
    >
      <Plus size={16} className={focused ? 'text-[var(--tf-accent-text)]' : 'text-[var(--tf-text-faint)]'} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-transparent py-2.5 text-sm text-[var(--tf-text)] placeholder:text-[var(--tf-text-faint)] focus:outline-none"
      />
      {value.trim() && (
        <button className="btn btn-primary btn-sm shrink-0" onMouseDown={(e) => e.preventDefault()} onClick={submit}>
          Add
        </button>
      )}
      {chips.length > 0 && (
        <span className="hidden max-w-[40%] truncate text-[11px] text-[var(--tf-text-muted)] sm:inline" aria-live="polite">
          {chips.join(' · ')}
        </span>
      )}
    </div>
  )
}
