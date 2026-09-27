import { useMemo } from 'react'
import { CalendarClock, Check, Repeat } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { ProPrompt } from '@/components/paywall/ProPrompt'
import { isPro } from '@/lib/pro'
import { todayISO } from '@/lib/dates'
import { EmptyState } from '@/components/ui/states'
import type { Recurrence } from '@/lib/types'

export function RoutinesView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const settings = useStore((s) => s.settings)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const skipOccurrence = useStore((s) => s.skipOccurrence)
  const openTask = useUIStore((s) => s.openTask)

  const routines = useMemo(
    () =>
      tasks
        .filter((t) => !t.archived && !t.completed && t.recurrence)
        .sort((a, b) => ((a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1)),
    [tasks]
  )
  const byFreq = (f: Recurrence['freq']) => routines.filter((t) => t.recurrence?.freq === f)

  if (!isPro(settings)) {
    return <ProPrompt feature="Routines" />
  }

  if (routines.length === 0) {
    return (
      <EmptyState
        icon="repeat"
        title="No routines yet"
        description="Daily, weekly or monthly habits show up here. Add a recurring task (e.g. “Water plants every Friday”) and it becomes a routine."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Routines</h2>
        <p className="text-sm text-[var(--tf-text-muted)]">{routines.length} active · mark done today to roll to the next occurrence</p>
      </div>

      {(['daily', 'weekly', 'monthly'] as const).map((freq) => {
        const list = byFreq(freq)
        if (list.length === 0) return null
        return (
          <section key={freq} className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--tf-text-secondary)]">
              <Repeat size={13} /> {freq === 'daily' ? 'Daily' : freq === 'weekly' ? 'Weekly' : 'Monthly'}
              <span className="rounded-full bg-[var(--tf-surface-3)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--tf-text-muted)]">{list.length}</span>
            </h3>
            <div className="space-y-1.5">
              {list.map((t) => {
                const p = projects.find((x) => x.id === t.projectId)
                const overdue = !!t.dueDate && t.dueDate < todayISO()
                return (
                  <div key={t.id} className={`card flex items-center gap-3 p-3 ${overdue ? 'border-l-2 border-l-red-400' : ''}`}>
                    <button
                      onClick={() => toggleComplete(t.id, true)}
                      aria-label={`Mark ${t.title} done for today`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--tf-border-strong)] text-[var(--tf-text-faint)] transition-colors hover:border-[var(--tf-accent)] hover:text-[var(--tf-accent)]"
                    >
                      <Check size={15} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <button className="block max-w-full truncate text-left text-sm font-medium text-[var(--tf-text)] hover:underline" onClick={() => openTask(t.id)} title={t.title}>
                        {t.title}
                      </button>
                      <p className="flex items-center gap-2 text-xs text-[var(--tf-text-muted)]">
                        {p && <span style={{ color: p.color }}>{p.name}</span>}
                        {t.dueDate && (
                          <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-500' : ''}`}>
                            <CalendarClock size={11} />
                            {new Date(t.dueDate + 'T12:00:00').toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm shrink-0"
                      onClick={() => skipOccurrence(t.id)}
                      aria-label={`Skip this occurrence of ${t.title}`}
                    >
                      Skip
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
