import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { buildTimeline } from '@/lib/timeline'
import { formatDateShort } from '@/lib/dates'
import { EmptyState } from '@/components/ui/states'

const KIND_LABEL = { task: 'Task', project: 'Project', goal: 'Goal' } as const

export function TimelineView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const openTask = useUIStore((s) => s.openTask)
  const navigate = useUIStore((s) => s.navigate)
  const lanes = useMemo(() => buildTimeline(tasks, projects, goals), [tasks, projects, goals])

  if (lanes.length === 0) {
    return (
      <EmptyState
        icon="calendarClock"
        title="Nothing on the timeline"
        description="Open tasks with a due date, project deadlines, and goal targets appear here. Dates you set, not a forecast."
      />
    )
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Timeline</h2>
        <p className="text-[13px] text-[var(--tf-text-muted)]">Due dates, deadlines, and goal targets on this device.</p>
      </header>
      {lanes.map((lane) => (
        <section key={lane.key} className="space-y-2">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--tf-text-muted)]">{lane.label}</h3>
          <ul className="space-y-1.5">
            {lane.events.map((e) => (
              <li key={e.id} className="card flex items-center gap-3 px-3.5 py-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color ?? 'var(--tf-text-faint)' }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-[var(--tf-text)]">{e.title}</p>
                  <p className="text-[11px] text-[var(--tf-text-faint)]">
                    {KIND_LABEL[e.kind]} · {formatDateShort(e.date)}
                    {e.overdue ? ' · overdue' : ''}
                  </p>
                </div>
                {e.taskId && (
                  <button className="btn btn-ghost btn-sm" onClick={() => openTask(e.taskId!)}>Open</button>
                )}
                {e.kind === 'project' && e.projectId && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('all', { projectId: e.projectId })}>Project</button>
                )}
                {e.kind === 'goal' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('goals')}>Goals</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
