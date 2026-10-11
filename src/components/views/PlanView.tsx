import { useMemo } from 'react'
import { Clock, Play, Sun, Target } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { todayISO } from '@/lib/dates'
import { estimateLabel } from '@/lib/time'
import { planToday } from '@/lib/rank'
import { EmptyState } from '@/components/ui/states'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'

export function PlanView() {
  const tasks = useStore((s) => s.tasks)
  const goals = useStore((s) => s.goals)
  const energy = useStore((s) => s.settings.energy ?? 'medium')
  const updateSettings = useStore((s) => s.updateSettings)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const postponeTask = useStore((s) => s.postponeTask)
  const updateTask = useStore((s) => s.updateTask)
  const openTask = useUIStore((s) => s.openTask)
  const setFocus = useUIStore((s) => s.setFocus)
  const navigate = useUIStore((s) => s.navigate)
  const today = todayISO()
  const dayPlan = useMemo(() => planToday(tasks, goals, energy, today), [tasks, goals, energy, today])
  const over = dayPlan.totalMinutes > dayPlan.capacityMinutes
  const rows = [...dayPlan.must, ...dayPlan.should]
  const inboxOpen = useMemo(
    () => tasks.filter((t) => !t.archived && !t.completed && !t.projectId && !t.dueDate).slice(0, 6),
    [tasks]
  )

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">Plan</p>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Commit to a realistic day</h2>
        <p className={`text-[13px] ${over ? 'text-amber-600' : 'text-[var(--tf-text-muted)]'}`}>
          <Clock size={13} className="mr-1 inline" />
          {estimateLabel(dayPlan.totalMinutes)} of {estimateLabel(dayPlan.capacityMinutes)} planned
          {over ? ' · over capacity — postpone or drop something' : ''}
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Energy for today">
        {(['high', 'medium', 'low'] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={`btn btn-sm ${energy === level ? 'btn-primary' : 'btn-secondary'}`}
            aria-pressed={energy === level}
            onClick={() => updateSettings({ energy: level })}
          >
            {level === 'high' ? 'High energy' : level === 'low' ? 'Low energy' : 'Medium'}
          </button>
        ))}
      </div>

      <AddTaskRow placeholder="Add something to today…" defaultDueDate={today} />

      {rows.length === 0 ? (
        <EmptyState
          icon="sun"
          title="Nothing committed yet"
          description="Pull from Inbox, or capture a task above. Plan compares time against your energy."
          action={
            inboxOpen.length > 0 ? (
              <button className="btn btn-secondary w-full" onClick={() => navigate('inbox')}>
                Process inbox
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)]">
          {rows.map((row) => (
            <div key={row.task.id} className="flex items-center gap-3 border-b border-[var(--tf-border)] px-3.5 py-3 last:border-b-0">
              <TaskCheckbox
                completed={row.task.completed}
                priority={row.task.priority}
                onToggle={() => toggleComplete(row.task.id)}
                label={`Mark "${row.task.title}" as done`}
              />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openTask(row.task.id)}>
                <p className="truncate text-[14px] font-medium text-[var(--tf-text)]">{row.task.title}</p>
                <p className="mt-0.5 text-[12px] text-[var(--tf-text-muted)]">
                  {row.why.slice(0, 2).join(' · ')}
                  {row.minutes ? ` · ${estimateLabel(row.minutes)}` : ''}
                </p>
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => postponeTask(row.task.id)}>
                Later
              </button>
              <button className="icon-btn h-8 w-8 text-[var(--tf-accent-text)]" onClick={() => setFocus(true, row.task.id)} aria-label={`Start ${row.task.title}`}>
                <Play size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {inboxOpen.length > 0 && (
        <section aria-label="Unscheduled inbox">
          <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-[var(--tf-text)]">
            <Target size={14} /> Pull from inbox
          </h3>
          <div className="overflow-hidden rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)]">
            {inboxOpen.map((t) => (
              <div key={t.id} className="flex items-center gap-3 border-b border-[var(--tf-border)] px-3.5 py-2.5 last:border-b-0">
                <p className="min-w-0 flex-1 truncate text-[14px] text-[var(--tf-text)]">{t.title}</p>
                <button className="btn btn-secondary btn-sm" onClick={() => updateTask(t.id, { dueDate: today })}>
                  Today
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
