import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { buildRiskRadar } from '@/lib/workspace'
import { EmptyState } from '@/components/ui/states'

const KIND_LABEL = {
  overdue: 'Overdue',
  deadline: 'Approaching',
  blocked: 'Blocked',
  stale: 'Stale',
  goal: 'Goal',
  conflict: 'Conflict',
} as const

export function RiskView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const openTask = useUIStore((s) => s.openTask)
  const navigate = useUIStore((s) => s.navigate)
  const items = useMemo(() => buildRiskRadar(tasks, projects, goals), [tasks, projects, goals])

  if (items.length === 0) {
    return <EmptyState icon="checkCheck" title="No calculated risks" description="Overdue work, blockers, stale tasks, and at-risk goals show up here. This is a rule list, not an AI score." />
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Risk radar</h2>
        <p className="text-[13px] text-[var(--tf-text-muted)]">Calculated from your tasks and goals. Not a prediction.</p>
      </header>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-faint)]">{KIND_LABEL[item.kind]}</p>
              <p className="text-[14px] font-medium text-[var(--tf-text)]">{item.title}</p>
              <p className="text-[12.5px] text-[var(--tf-text-muted)]">{item.why} · {item.next}</p>
            </div>
            {item.taskId && (
              <button className="btn btn-secondary btn-sm" onClick={() => openTask(item.taskId!)}>Open</button>
            )}
            {item.goalId && (
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('goals')}>Goals</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
