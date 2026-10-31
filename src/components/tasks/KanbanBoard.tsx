import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { todayISO, addDaysISO } from '@/lib/dates'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import type { Task } from '@/lib/types'

type ColId = 'overdue' | 'today' | 'week' | 'later'

const COLS: { id: ColId; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'later', label: 'Later' },
]

function colOf(task: Task, today: string): ColId {
  if (task.dueDate && task.dueDate < today) return 'overdue'
  if (task.dueDate === today) return 'today'
  if (task.dueDate && task.dueDate <= addDaysISO(today, 7)) return 'week'
  return 'later'
}

export function KanbanBoard({ projectId }: { projectId?: string }) {
  const tasks = useStore((s) => s.tasks)
  const updateTask = useStore((s) => s.updateTask)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const openTask = useUIStore((s) => s.openTask)
  const today = todayISO()
  const open = useMemo(
    () => tasks.filter((t) => !t.archived && !t.completed && !t.parked && (!projectId || t.projectId === projectId)),
    [tasks, projectId]
  )
  const grouped = useMemo(() => {
    const map: Record<ColId, Task[]> = { overdue: [], today: [], week: [], later: [] }
    for (const t of open) map[colOf(t, today)].push(t)
    return map
  }, [open, today])

  const dropOn = (col: ColId, id: string) => {
    if (col === 'overdue') return
    const dueDate = col === 'today' ? today : col === 'week' ? addDaysISO(today, 3) : addDaysISO(today, 10)
    updateTask(id, { dueDate })
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLS.map((col) => (
        <section
          key={col.id}
          aria-label={col.label}
          className="rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)] p-2 min-h-[12rem]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData('text/task-id')
            if (id) dropOn(col.id, id)
          }}
        >
          <h3 className="px-2 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">
            {col.label} · {grouped[col.id].length}
          </h3>
          <ul className="space-y-1.5">
            {grouped[col.id].map((t) => (
              <li
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/task-id', t.id)}
                className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 hover:border-[var(--tf-border)] hover:bg-[var(--tf-hover)]"
              >
                <TaskCheckbox completed={false} priority={t.priority} onToggle={() => toggleComplete(t.id)} label={`Complete ${t.title}`} />
                <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-[var(--tf-text)]" onClick={() => openTask(t.id)}>
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
