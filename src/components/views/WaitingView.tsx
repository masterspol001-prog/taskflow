import { useMemo } from 'react'
import { GitBranch, Hourglass, Zap } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { waitingTasks, blockersOf } from '@/lib/agent'
import { EmptyState } from '@/components/ui/states'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import { formatDateShort } from '@/lib/dates'

export function WaitingView() {
  const tasks = useStore((s) => s.tasks)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const openTask = useUIStore((s) => s.openTask)
  const setFocus = useUIStore((s) => s.setFocus)
  const waiting = useMemo(() => waitingTasks(tasks), [tasks])

  if (waiting.length === 0) {
    return (
      <EmptyState
        icon="clock"
        title="Nothing waiting"
        description="Blocked, waiting, or dependent work shows up here so you can unblock it first. Tag a task #waiting or add a dependency."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Waiting</h2>
        <p className="text-sm text-[var(--tf-text-muted)]">Clear the blocker, then this moves.</p>
      </div>
      {waiting.map((t) => {
        const blockers = blockersOf(t, tasks)
        const tagged = (t.tags ?? []).filter((tag) => ['waiting', 'blocked'].includes(tag.toLowerCase()))
        return (
          <div key={t.id} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <TaskCheckbox completed={false} priority={t.priority} onToggle={() => toggleComplete(t.id)} label={`Complete ${t.title}`} />
            <button className="min-w-0 flex-1 text-left" onClick={() => openTask(t.id)}>
              <p className="truncate text-[14px] font-medium text-[var(--tf-text)]">{t.title}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--tf-text-muted)]">
                {blockers.length > 0 && (
                  <span className="flex items-center gap-1">
                    <GitBranch size={11} /> {blockers.map((b) => b.title).join(', ')}
                  </span>
                )}
                {tagged.map((tag) => (
                  <span key={tag} className="rounded-full bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold text-amber-600">
                    #{tag}
                  </span>
                ))}
                {t.dueDate && <span>{formatDateShort(t.dueDate)}</span>}
              </p>
            </button>
            {blockers[0] ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setFocus(true, blockers[0].id)}>
                <Zap size={13} /> Unblock
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setFocus(true, t.id)}>
                <Hourglass size={13} /> Focus
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
