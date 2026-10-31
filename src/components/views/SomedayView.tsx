import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { EmptyState } from '@/components/ui/states'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TaskItem } from '@/components/tasks/TaskItem'
import { isParked } from '@/lib/dayflow'
import { goalForTask } from '@/lib/goals'

export function SomedayView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const toggleImportant = useStore((s) => s.toggleImportant)
  const unparkTask = useStore((s) => s.unparkTask)
  const openTask = useUIStore((s) => s.openTask)

  const parked = useMemo(
    () => tasks.filter((t) => !t.archived && !t.completed && isParked(t)),
    [tasks]
  )

  if (parked.length === 0) {
    return (
      <EmptyState
        icon="compass"
        title="Someday is empty"
        description="Park work that is not this week. It stays out of Today and Plan until you pull it back."
        action={<AddTaskRow placeholder="Park a someday idea…" parked />}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Someday</h2>
        <p className="text-sm text-[var(--tf-text-muted)]">
          {parked.length} parked · pull onto today when it is time, or leave it here.
        </p>
      </div>
      <AddTaskRow placeholder="Park a someday idea…" parked />
      <div className="overflow-hidden rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)]">
        {parked.map((task) => (
          <div key={task.id} className="flex items-center gap-1 border-b border-[var(--tf-border)] last:border-b-0">
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
            <button className="btn btn-secondary btn-sm mr-2 shrink-0" onClick={() => unparkTask(task.id)}>
              Today
            </button>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[var(--tf-text-faint)]">
        New captures land in Inbox. Park from Today, All tasks, or the task editor.
      </p>
    </div>
  )
}
