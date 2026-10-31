import { useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { todayISO, addDaysISO } from '@/lib/dates'
import { EmptyState } from '@/components/ui/states'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TaskItem } from '@/components/tasks/TaskItem'
import { goalForTask } from '@/lib/goals'
import { PRIORITIES } from '@/lib/constants'
import type { Priority, Task } from '@/lib/types'

export function InboxView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const toggleImportant = useStore((s) => s.toggleImportant)
  const updateTask = useStore((s) => s.updateTask)
  const toast = useStore((s) => s.toast)
  const openTask = useUIStore((s) => s.openTask)
  const today = todayISO()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const inbox = useMemo(
    () => tasks.filter((t) => !t.archived && !t.completed && !t.projectId && !t.parked),
    [tasks]
  )
  const visibleProjects = useMemo(() => projects.filter((p) => !p.archived), [projects])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const apply = (ids: string[], patch: Partial<Task>, message: string) => {
    for (const id of ids) updateTask(id, patch)
    setSelected(new Set())
    toast({ title: message, kind: 'success' })
  }

  const ids = selected.size > 0 ? [...selected] : []

  if (inbox.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title="Inbox is clear"
        description="Capture anything. Clarify it later. This is the lightest place to start."
        action={<AddTaskRow placeholder="Capture a thought…" />}
      />
    )
  }

  return (
    <div className="space-y-3">
      <AddTaskRow placeholder="Capture a thought…" />
      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--tf-border)] bg-[var(--tf-surface-2)] px-3 py-2">
          <span className="text-[12px] font-semibold text-[var(--tf-text-muted)]">{ids.length} selected</span>
          <button className="btn btn-primary btn-sm" onClick={() => apply(ids, { dueDate: today }, 'Scheduled for today')}>
            Today
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => apply(ids, { dueDate: addDaysISO(today, 1) }, 'Moved to tomorrow')}>
            Tomorrow
          </button>
          <label className="sr-only" htmlFor="inbox-priority">Priority</label>
          <select
            id="inbox-priority"
            className="h-8 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] px-2 text-[12px]"
            defaultValue=""
            onChange={(e) => {
              const value = Number(e.target.value) as Priority
              if (value >= 1 && value <= 4) apply(ids, { priority: value }, `Priority set to ${PRIORITIES[value].label}`)
              e.target.value = ''
            }}
          >
            <option value="" disabled>
              Priority
            </option>
            {([4, 3, 2, 1] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITIES[p].label}
              </option>
            ))}
          </select>
          {visibleProjects.length > 0 && (
            <>
              <label className="sr-only" htmlFor="inbox-project">Move to project</label>
              <select
                id="inbox-project"
                className="h-8 max-w-[10rem] rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] px-2 text-[12px]"
                defaultValue=""
                onChange={(e) => {
                  const projectId = e.target.value
                  if (projectId) apply(ids, { projectId }, 'Moved to project')
                  e.target.value = ''
                }}
              >
                <option value="" disabled>
                  Project
                </option>
                {visibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}
      <div className="overflow-hidden rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)]">
        {inbox.map((task) => (
          <div key={task.id} className="flex items-center gap-1 border-b border-[var(--tf-border)] last:border-b-0">
            <input
              type="checkbox"
              className="ml-3 h-4 w-4 shrink-0"
              checked={selected.has(task.id)}
              onChange={() => toggleSelect(task.id)}
              aria-label={`Select ${task.title}`}
            />
            <div className="min-w-0 flex-1">
              <TaskItem
                task={task}
                project={task.projectId ? projects.find((p) => p.id === task.projectId) : undefined}
                goal={goalForTask(goals, task.id)}
                onToggle={() => toggleComplete(task.id)}
                onOpen={() => openTask(task.id)}
                onToggleImportant={() => toggleImportant(task.id)}
                compact
              />
            </div>
            <button
              className="btn btn-ghost btn-sm mr-2 shrink-0"
              onClick={() => apply([task.id], { dueDate: today }, 'Scheduled for today')}
            >
              Today
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
