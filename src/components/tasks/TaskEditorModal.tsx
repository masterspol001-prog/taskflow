import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar, Clock, Flag, Repeat, Star, Trash2, Copy, Archive, RotateCcw, Plus, X, Check,
} from 'lucide-react'
import type { Priority, Recurrence, Subtask, Task } from '@/lib/types'
import { PRIORITIES, PRIORITY_ORDER } from '@/lib/constants'
import { todayISO } from '@/lib/dates'
import { uid } from '@/lib/dates'
import { formatTime, estimateLabel } from '@/lib/time'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface EditorDraft {
  title: string
  notes: string
  projectId: string | null
  section: string | null
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  estimate: number | null
  important: boolean
  tags: string[]
  recurrence: Recurrence | null
}

function getInitialDraft(
  task: Task | undefined,
  createPrefs: { projectId?: string | null; section?: string | null; title?: string; dueDate?: string | null; dueTime?: string | null } | undefined,
  settingsPriority: Priority
): EditorDraft {
  if (task) {
    return {
      title: task.title,
      notes: task.notes,
      projectId: task.projectId,
      section: task.section,
      dueDate: task.dueDate,
      dueTime: task.dueTime,
      priority: task.priority,
      estimate: task.estimate ?? null,
      important: task.important,
      tags: task.tags,
      recurrence: task.recurrence,
    }
  }
  return {
    title: createPrefs?.title ?? '',
    notes: '',
    projectId: createPrefs?.projectId !== undefined ? (createPrefs.projectId ?? null) : null,
    section: createPrefs?.section !== undefined ? (createPrefs.section ?? null) : null,
    dueDate: createPrefs?.dueDate ?? null,
    dueTime: createPrefs?.dueTime ?? null,
    priority: settingsPriority,
    estimate: null,
    important: false,
    tags: [],
    recurrence: null,
  }
}

export function TaskEditorModal() {
  const { taskModal, closeTaskModal } = useUIStore()
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const settings = useStore((s) => s.settings)
  const { addTask, updateTask, removeTask, toggleImportant, duplicateTask, toggleArchive, setSubtasks, toast } = useStore()

  const task = useMemo(
    () => (taskModal.mode === 'edit' && taskModal.taskId ? tasks.find((t) => t.id === taskModal.taskId) : undefined),
    [taskModal, tasks]
  )

  const [draft, setDraft] = useState<EditorDraft>(() => getInitialDraft(undefined, {}, settings.defaultPriority))
  const [subtasks, setSubtaskState] = useState<Subtask[]>([])
  const [tagInput, setTagInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Load state whenever the modal target changes.
  useEffect(() => {
    if (!taskModal.open) return
    const d = getInitialDraft(task, taskModal.mode === 'create' ? taskModal : undefined, settings.defaultPriority)
    setDraft(d)
    setSubtaskState(task?.subtasks ?? [])
    setTagInput('')
    setConfirmDelete(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskModal.open, taskModal.taskId, taskModal.mode])

  if (!taskModal.open) return null

  const isEdit = taskModal.mode === 'edit' && !!task
  const project = draft.projectId ? projects.find((p) => p.id === draft.projectId) : undefined
  const set = <K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, '').toLowerCase()
    if (tag && !draft.tags.includes(tag)) set('tags', [...draft.tags, tag])
    setTagInput('')
  }

  const removeTag = (tag: string) => set('tags', draft.tags.filter((t) => t !== tag))

  const validate = () => {
    if (!draft.title.trim()) {
      toast({ title: 'Task title is required', kind: 'error' })
      return false
    }
    return true
  }

  const save = () => {
    if (!validate()) return
    if (isEdit && task) {
      updateTask(task.id, {
        title: draft.title.trim(),
        notes: draft.notes.trim(),
        projectId: draft.projectId,
        section: draft.section,
        dueDate: draft.dueDate,
        dueTime: draft.dueDate ? draft.dueTime : null,
        priority: draft.priority,
        estimate: draft.estimate,
        important: draft.important,
        tags: draft.tags,
        recurrence: draft.recurrence,
      })
      if (task.subtasks.length !== subtasks.length || JSON.stringify(task.subtasks) !== JSON.stringify(subtasks)) {
        setSubtasks(task.id, subtasks)
      }
      toast({ title: 'Task updated', kind: 'success' })
    } else {
      const created = addTask({
        title: draft.title.trim(),
        notes: draft.notes.trim(),
        projectId: draft.projectId,
        section: draft.section,
        dueDate: draft.dueDate,
        dueTime: draft.dueDate ? draft.dueTime : null,
        priority: draft.priority,
        estimate: draft.estimate,
        important: draft.important,
        tags: draft.tags,
        recurrence: draft.recurrence,
      })
      if (!created) return
      toast({ title: 'Task created', kind: 'success' })
    }
    closeTaskModal()
  }

  const handleDelete = () => {
    if (!task) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    removeTask(task.id)
    toast({ title: 'Task deleted', kind: 'info' })
    closeTaskModal()
  }

  const handleArchive = () => {
    if (!task) return
    toggleArchive(task.id)
    toast({ title: task.archived ? 'Task restored' : 'Task archived', kind: 'success' })
    closeTaskModal()
  }

  const handleDuplicate = () => {
    if (!task) return
    duplicateTask(task.id)
    toast({ title: 'Task duplicated', kind: 'success' })
  }

  const toggleSubtask = (id: string) =>
    setSubtaskState((list) => list.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s)))

  const quickDay = (offset: number) => set('dueDate', offsetLabel(offset))

  return (
    <Modal
      open={taskModal.open}
      onClose={closeTaskModal}
      title={isEdit ? 'Edit task' : 'New task'}
      variant="drawer"
      footer={
        <>
          {isEdit && task && (
            <div className="mr-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleDuplicate} title="Duplicate">
                <Copy size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleArchive}
                title={task.archived ? 'Restore' : 'Archive'}
              >
                {task.archived ? <RotateCcw size={14} /> : <Archive size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDelete} className={confirmDelete ? '!bg-red-500 !text-white' : ''}>
                <Trash2 size={14} /> {confirmDelete ? 'Confirm delete?' : ''}
              </Button>
            </div>
          )}
          <Button variant="ghost" onClick={closeTaskModal}>
            Cancel
          </Button>
          <Button onClick={save}>{isEdit ? 'Save changes' : 'Add task'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Title */}
        <div className="flex items-start gap-3">
          <TitleCheckbox
            checked={!!(task && task.completed)}
            priority={draft.priority}
          />
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && save()}
            placeholder="What needs to be done?"
            className="w-full bg-transparent text-lg font-semibold text-[var(--tf-text)] placeholder:text-[var(--tf-text-faint)] focus:outline-none"
            aria-label="Task title"
          />
          <button
            onClick={() => set('important', !draft.important)}
            aria-pressed={draft.important}
            aria-label="Mark important"
            className="icon-btn"
          >
            <Star size={18} className={draft.important ? 'text-amber-500' : ''} fill={draft.important ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Quick due */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: 'Today', offset: 0 },
            { label: 'Tomorrow', offset: 1 },
            { label: 'Next week', offset: 7 },
          ].map((q) => (
            <button
              key={q.label}
              onClick={() => quickDay(q.offset)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                draft.dueDate === offsetLabel(q.offset)
                  ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]'
                  : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Row of quick controls */}
        <div className="flex flex-wrap gap-2">
          <DatePickerMini value={draft.dueDate} onChange={(d) => set('dueDate', d)} />
          {draft.dueDate && (
            <TimePicker value={draft.dueTime} onChange={(t) => set('dueTime', t)} />
          )}
          <PrioritySelect value={draft.priority} onChange={(p) => set('priority', p)} />
          <EstimateSelect value={draft.estimate} onChange={(m) => set('estimate', m)} />
          <ProjectSelect
            value={draft.projectId}
            projects={projects}
            onChange={(pid) => set('projectId', pid)}
          />
        </div>

        {/* Recurrence */}
        <RecurrenceSelect value={draft.recurrence} onChange={(r) => set('recurrence', r)} />

        {/* Notes */}
        <div className="field">
          <textarea
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Add notes…"
            rows={2}
            className="input"
            aria-label="Notes"
          />
        </div>

        {/* Tags */}
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            {draft.tags.map((tag) => (
              <span key={tag} className="chip" style={{ background: 'var(--tf-surface-3)', color: 'var(--tf-text-secondary)' }}>
                #{tag}
                <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-red-500" aria-label={`Remove tag ${tag}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagInput)
              }
              if (e.key === 'Backspace' && !tagInput && draft.tags.length) removeTag(draft.tags[draft.tags.length - 1])
            }}
            onBlur={() => tagInput.trim() && addTag(tagInput)}
            placeholder="Add tag, press Enter…"
            className="input !py-1.5 text-xs"
            aria-label="Add tag"
          />
        </div>

        {/* Subtasks */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tf-text-muted)]">
              Subtasks {subtasks.some((s) => s.completed) ? `(${subtasks.filter((s) => s.completed).length}/${subtasks.length})` : ''}
            </span>
          </div>
          <div className="space-y-1">
            {subtasks.map((sub) => (
              <div key={sub.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--tf-hover)]">
                <button
                  role="checkbox"
                  aria-checked={sub.completed}
                  aria-label={`Toggle ${sub.title}`}
                  onClick={() => toggleSubtask(sub.id)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    sub.completed ? 'border-[var(--tf-accent)] bg-[var(--tf-accent)]' : 'border-[var(--tf-border-strong)]'
                  }`}
                >
                  {sub.completed && <Check size={9} className="text-white" strokeWidth={4} />}
                </button>
                <input
                  value={sub.title}
                  onChange={(e) =>
                    setSubtaskState((list) => list.map((s) => (s.id === sub.id ? { ...s, title: e.target.value } : s)))
                  }
                  className={`w-full bg-transparent text-sm focus:outline-none ${
                    sub.completed ? 'text-[var(--tf-text-muted)] line-through' : 'text-[var(--tf-text)]'
                  }`}
                  aria-label="Subtask title"
                />
                <button className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => setSubtaskState((l) => l.filter((s) => s.id !== sub.id))} aria-label="Remove subtask">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <AddSubtaskRow
            onAdd={(title) => setSubtaskState((l) => [...l, { id: uid('sub-'), title, completed: false }])}
          />
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/* Small controls reused inside the editor                            */
/* ------------------------------------------------------------------ */

function offsetLabel(offset: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function TitleCheckbox({ checked, priority }: { checked: boolean; priority: Priority }) {
  const c = PRIORITIES[priority].color
  return (
    <span
      className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2"
      style={{
        borderColor: checked ? 'var(--tf-accent)' : c,
        background: checked ? 'var(--tf-accent)' : 'transparent',
      }}
      aria-hidden="true"
    >
      {checked && <Check size={11} className="text-white" strokeWidth={3.5} />}
    </span>
  )
}

function DatePickerMini({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button
        className="flex items-center gap-1.5 rounded-lg border border-[var(--tf-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
        onClick={() => inputRef.current?.showPicker()}
        type="button"
      >
        <Calendar size={13} />
        {value ? formatDateInput(value) : 'Due date'}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        tabIndex={-1}
        aria-label="Set due date"
      />
    </div>
  )
}

function formatDateInput(iso: string) {
  const [y, m, d] = iso.split('-')
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function TimePicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <button
        className="flex items-center gap-1.5 rounded-lg border border-[var(--tf-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
        onClick={() => inputRef.current?.showPicker()}
        type="button"
      >
        <Clock size={13} />
        {value ? formatTime(value) : 'Add time'}
      </button>
      <input
        ref={inputRef}
        type="time"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 cursor-pointer opacity-0"
        tabIndex={-1}
        aria-label="Set due time"
      />
    </div>
  )
}

function PrioritySelect({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as Priority)}
        className="cursor-pointer appearance-none rounded-lg border border-[var(--tf-border)] py-1.5 pl-2.5 pr-7 text-xs font-medium text-[var(--tf-text-secondary)] focus:outline-none"
        aria-label="Priority"
        style={{ background: 'var(--tf-surface)' }}
      >
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITIES[p].label} priority
          </option>
        ))}
      </select>
      <Flag size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-faint)]" />
    </div>
  )
}

function EstimateSelect({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="relative inline-block">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="cursor-pointer appearance-none rounded-lg border border-[var(--tf-border)] py-1.5 pl-2.5 pr-7 text-xs font-medium text-[var(--tf-text-secondary)] focus:outline-none"
        aria-label="Estimated time"
        style={{ background: 'var(--tf-surface)' }}
      >
        <option value="">No estimate</option>
        {[15, 30, 45, 60, 90, 120].map((m) => (
          <option key={m} value={m}>
            {estimateLabel(m)}
          </option>
        ))}
      </select>
      <Clock size={13} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-faint)]" />
    </div>
  )
}

function ProjectSelect({
  value,
  projects,
  onChange,
}: {
  value: string | null
  projects: { id: string; name: string; color: string }[]
  onChange: (v: string | null) => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="cursor-pointer rounded-lg border border-[var(--tf-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--tf-text-secondary)] focus:outline-none"
      aria-label="Project"
      style={{ background: 'var(--tf-surface)' }}
    >
      <option value="">No project</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )
}

const RECUR: { freq: Recurrence['freq']; label: string }[] = [
  { freq: 'daily', label: 'Daily' },
  { freq: 'weekly', label: 'Weekly' },
  { freq: 'monthly', label: 'Monthly' },
  { freq: 'yearly', label: 'Yearly' },
]

function RecurrenceSelect({ value, onChange }: { value: Recurrence | null; onChange: (r: Recurrence | null) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Repeat size={14} className="text-[var(--tf-text-faint)]" />
      <select
        value={value?.freq ?? ''}
        onChange={(e) => {
          const freq = e.target.value
          onChange(freq ? { freq: freq as Recurrence['freq'], interval: value?.interval ?? 1 } : null)
        }}
        className="cursor-pointer rounded-lg border border-[var(--tf-border)] bg-transparent px-2 py-1 text-xs text-[var(--tf-text-secondary)] focus:outline-none"
        aria-label="Repeat"
      >
        <option value="">Does not repeat</option>
        {RECUR.map((r) => (
          <option key={r.freq} value={r.freq}>
            Repeats {r.label.toLowerCase()}
          </option>
        ))}
      </select>
      {value && (
        <label className="flex items-center gap-1.5 text-xs text-[var(--tf-text-muted)]">
          Every
          <select
            value={value.interval}
            onChange={(e) => onChange({ ...value, interval: Number(e.target.value) })}
            className="rounded border border-[var(--tf-border)] bg-transparent px-1 py-0.5"
            aria-label="Repeat interval"
          >
            {[1, 2, 3, 4, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {value.freq === 'daily' ? (value.interval > 1 ? 'days' : 'day') : value.freq === 'weekly' ? (value.interval > 1 ? 'weeks' : 'week') : value.freq === 'monthly' ? (value.interval > 1 ? 'months' : 'month') : value.interval > 1 ? 'years' : 'year'}
        </label>
      )}
    </div>
  )
}

function AddSubtaskRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [v, setV] = useState('')
  const add = () => {
    if (!v.trim()) return
    onAdd(v.trim())
    setV('')
  }
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <button
        onClick={add}
        className="flex h-4 w-4 items-center justify-center rounded border-2 border-dashed border-[var(--tf-border-strong)] text-[var(--tf-text-faint)]"
        aria-label="Add subtask"
      >
        <Plus size={9} />
      </button>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder="Add subtask…"
        className="w-full bg-transparent text-sm text-[var(--tf-text-muted)] placeholder:text-[var(--tf-text-faint)] focus:outline-none"
        aria-label="Add subtask title"
      />
    </div>
  )
}
