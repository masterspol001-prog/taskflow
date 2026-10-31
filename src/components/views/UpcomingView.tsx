import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { todayISO, addDaysISO, formatDateShort } from '@/lib/dates'
import { groupByDay } from '@/lib/viewTasks'
import { GroupedTaskListView } from '@/components/tasks/GroupedTaskListView'
import { EmptyState } from '@/components/ui/states'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'

export function UpcomingView() {
  const tasks = useStore((s) => s.tasks)
  const navigate = useUIStore((s) => s.navigate)
  const today = todayISO()
  const weekEnd = addDaysISO(today, 7)

  const upcoming = useMemo(
    () =>
      tasks
        .filter((t) => !t.archived && !t.completed && !t.parked && t.dueDate && t.dueDate > today)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.sortOrder - b.sortOrder),
    [tasks, today]
  )

  const thisWeek = useMemo(() => upcoming.filter((t) => t.dueDate && t.dueDate <= weekEnd), [upcoming, weekEnd])
  const later = useMemo(() => upcoming.filter((t) => t.dueDate && t.dueDate > weekEnd), [upcoming, weekEnd])
  const groups = useMemo(() => groupByDay(upcoming, false), [upcoming])

  if (upcoming.length === 0) {
    return (
      <div className="space-y-4">
        <header>
          <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Upcoming</h2>
          <p className="text-[13px] text-[var(--tf-text-muted)]">Future due dates, grouped by day.</p>
        </header>
        <EmptyState
          icon="calendarClock"
          title="Nothing upcoming"
          description="Tasks with a future due date will show here."
          action={<AddTaskRow placeholder="Add something for tomorrow…" defaultDueDate={addDaysISO(today, 1)} />}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Upcoming</h2>
          <p className="text-[13px] text-[var(--tf-text-muted)]">
            {thisWeek.length} this week · {later.length} later
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('calendar')}>
            Calendar
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('board')}>
            Board
          </button>
        </div>
      </header>

      {thisWeek.length > 0 && later.length > 0 && (
        <p className="text-[12px] text-[var(--tf-text-faint)]">
          Next due {formatDateShort(upcoming[0]?.dueDate)} · last in view {formatDateShort(upcoming[upcoming.length - 1]?.dueDate)}
        </p>
      )}

      <GroupedTaskListView
        groups={groups}
        emptyIcon="calendarClock"
        empty={{ title: 'Nothing upcoming' }}
        defaultDueDate={addDaysISO(today, 1)}
      />
    </div>
  )
}
