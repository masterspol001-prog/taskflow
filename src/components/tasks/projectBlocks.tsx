import { useState } from 'react'
import { Check, List, X, FolderPlus, Trash2 } from 'lucide-react'
import type { Project } from '@/lib/types'
import { useStore } from '@/store/useStore'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import { useUIStore } from '@/store/useUIStore'
import { Icon } from '@/components/ui/Icon'

export function ProjectHeader({ project, done, total }: { project: Project; done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: project.color + '22', color: project.color }}
        >
          <Icon name={project.icon} size={21} />
        </div>
        <div>
          <h1 className="display text-[22px] font-semibold tracking-tight text-[var(--tf-text)]">{project.name}</h1>
          {project.description && (
            <p className="text-[13px] text-[var(--tf-text-muted)]">{project.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:ml-auto">
        <span className="text-xs text-[var(--tf-text-muted)]">
          {done}/{total} done
        </span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: project.color }} />
        </div>
        <span className="text-xs font-bold" style={{ color: project.color }}>
          {pct}%
        </span>
      </div>
    </div>
  )
}

export function SectionTitle({ title, color }: { title: string; color: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1 pt-2">
      <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--tf-text-muted)]">{title}</span>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    </div>
  )
}

export function TaskMiniList({ tasks }: { tasks: import('@/lib/types').Task[] }) {
  const { toggleComplete } = useStore()
  const openTask = useUIStore((s) => s.openTask)
  if (!tasks.length)
    return (
      <div className="px-2 py-1 text-[13px] italic text-[var(--tf-text-faint)]">Nothing here yet</div>
    )
  return (
    <div className="card divide-y divide-[var(--tf-border)]">
      {tasks.map((t) => (
        <button key={t.id} onClick={() => openTask(t.id)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[var(--tf-hover)]">
          <TaskCheckbox
            completed={t.completed}
            priority={t.priority}
            onToggle={() => toggleComplete(t.id)}
            label={`Complete ${t.title}`}
          />
          <span className="flex-1 truncate text-[13.5px] text-[var(--tf-text)]">{t.title}</span>
          {t.dueDate && <span className="shrink-0 text-xs text-[var(--tf-text-faint)]">{t.dueDate}</span>}
        </button>
      ))}
    </div>
  )
}

export function SectionAdder({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-[var(--tf-border-strong)] px-4 py-2.5 text-[13px] font-medium text-[var(--tf-text-muted)] transition-colors hover:border-[var(--tf-accent)] hover:text-[var(--tf-accent-text)]"
      >
        <List size={15} /> Add section
      </button>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) {
          onSubmit(name.trim())
          setEditing(false)
          setName('')
        }
      }}
      className="flex items-center gap-2 rounded-xl border border-[var(--tf-accent)] bg-[var(--tf-surface)] px-3 py-2"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Section name (e.g. Active, Waiting)"
        className="flex-1 bg-transparent text-sm focus:outline-none"
        aria-label="New section name"
      />
      <button className="btn btn-primary btn-sm" type="submit">
        <Check size={13} /> Add
      </button>
      <button className="icon-btn" type="button" onClick={() => setEditing(false)} aria-label="Cancel">
        <X size={16} />
      </button>
    </form>
  )
}

export function ManageSections({ project }: { project: Project }) {
  const { removeSection, addSection } = useStore()
  const [name, setName] = useState('')
  return (
    <div className="space-y-2 p-4">
      <p className="text-sm text-[var(--tf-text-secondary)]">
        Sections help you split a project into smaller groups of tasks.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {project.sections.map((s) => (
          <span key={s} className="chip" style={{ background: 'var(--tf-surface-3)', color: 'var(--tf-text-secondary)' }}>
            {s}
            <button onClick={() => removeSection(project.id, s)} aria-label={`Remove ${s}`}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) {
            addSection(project.id, name.trim())
            setName('')
          }
        }}
        className="flex items-center gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New section…" className="input flex-1" aria-label="Section name" />
        <button className="btn btn-secondary btn-sm" type="submit">
          <FolderPlus size={13} /> Add
        </button>
      </form>
    </div>
  )
}
