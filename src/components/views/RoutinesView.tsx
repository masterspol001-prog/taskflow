import { useMemo, useState } from 'react'
import { CalendarClock, Check, ChevronLeft, ChevronRight, Repeat } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { todayISO, toISODate, parseISODate } from '@/lib/dates'
import { EmptyState } from '@/components/ui/states'
import type { Recurrence, Task } from '@/lib/types'
import { routineStreak } from '@/lib/agent'

export function RoutinesView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const settings = useStore((s) => s.settings)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const skipOccurrence = useStore((s) => s.skipOccurrence)
  const logRoutineDay = useStore((s) => s.logRoutineDay)
  const addTask = useStore((s) => s.addTask)
  const toast = useStore((s) => s.toast)
  const openTask = useUIStore((s) => s.openTask)
  const openNewTask = useUIStore((s) => s.openNewTask)
  const [calOffset, setCalOffset] = useState(0)
  const [calRoutineId, setCalRoutineId] = useState<string | null>(null)

  const routines = useMemo(
    () =>
      tasks
        .filter((t) => !t.archived && !t.completed && t.recurrence)
        .sort((a, b) => ((a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1)),
    [tasks]
  )
  const byFreq = (f: Recurrence['freq']) => routines.filter((t) => t.recurrence?.freq === f)

  const templates = (
    <div className="flex flex-wrap gap-2">
      {[
        { title: 'Morning review', freq: 'daily' as const, estimate: 15, tags: ['deep-work'] },
        { title: 'Workout', freq: 'daily' as const, estimate: 45, tags: ['health'] },
        { title: 'Deep work block', freq: 'weekly' as const, estimate: 90, tags: ['deep-work'] },
      ].map((tpl) => (
        <button
          key={tpl.title}
          className="btn btn-secondary btn-sm"
          onClick={() => {
            const created = addTask({
              title: tpl.title,
              dueDate: todayISO(),
              estimate: tpl.estimate,
              tags: tpl.tags,
              recurrence: { freq: tpl.freq, interval: 1 },
            })
            if (created) toast({ title: 'Routine added', message: tpl.title, kind: 'success' })
          }}
        >
          + {tpl.title}
        </button>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => openNewTask({ dueDate: todayISO() })}>
        Custom
      </button>
    </div>
  )

  if (routines.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="repeat"
          title="No routines yet"
          description="Daily, weekly or monthly habits show up here. Start from a template below, or add a recurring task."
        />
        {templates}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Routines</h2>
        <p className="text-sm text-[var(--tf-text-muted)]">{routines.length} active · mark done today to roll to the next occurrence</p>
        <div className="mt-3">{templates}</div>
      </div>

      <RoutineMonthCalendar
        routines={routines}
        tasks={tasks}
        selectedId={calRoutineId ?? routines[0]?.id ?? null}
        onSelect={setCalRoutineId}
        monthOffset={calOffset}
        onMonth={setCalOffset}
        onToggleDay={logRoutineDay}
        weekStartMonday={settings.weekStartMonday}
      />

      {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => {
        const list = byFreq(freq)
        if (list.length === 0) return null
        return (
          <section key={freq} className="space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--tf-text-secondary)]">
               <Repeat size={13} /> {freq === 'daily' ? 'Daily' : freq === 'weekly' ? 'Weekly' : freq === 'monthly' ? 'Monthly' : 'Yearly'}
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
                        <span>{routineStreak(tasks, t)} day streak</span>
                      </p>
                    </div>
                      <button
                        className="btn btn-ghost btn-sm shrink-0"
                        onClick={() => setCalRoutineId(t.id)}
                        aria-label={`Show calendar for ${t.title}`}
                      >
                        Month
                      </button>
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

const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function RoutineMonthCalendar({
  routines,
  tasks,
  selectedId,
  onSelect,
  monthOffset,
  onMonth,
  onToggleDay,
  weekStartMonday,
}: {
  routines: Task[]
  tasks: Task[]
  selectedId: string | null
  onSelect: (id: string) => void
  monthOffset: number
  onMonth: (fn: (n: number) => number) => void
  onToggleDay: (id: string, dateISO: string) => void
  weekStartMonday: boolean
}) {
  const today = todayISO()
  const selected = routines.find((t) => t.id === selectedId) ?? routines[0]
  const anchor = useMemo(() => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(1)
    d.setMonth(d.getMonth() + monthOffset)
    return d
  }, [monthOffset])

  const doneDays = useMemo(() => {
    if (!selected) return new Set<string>()
    const set = new Set<string>()
    for (const t of tasks) {
      if (!t.completed || t.title !== selected.title) continue
      if (t.dueDate) set.add(t.dueDate)
      else if (t.completedAt) set.add(toISODate(new Date(t.completedAt)))
    }
    return set
  }, [tasks, selected])

  const cells = useMemo(() => {
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const first = new Date(year, month, 1, 12)
    const startDow = first.getDay()
    const lead = weekStartMonday ? (startDow === 0 ? -6 : 1 - startDow) : -startDow
    const gridStart = new Date(year, month, 1 + lead, 12)
    const out: { iso: string; inMonth: boolean; isToday: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      const iso = toISODate(d)
      out.push({ iso, inMonth: d.getMonth() === month, isToday: iso === today })
    }
    return out
  }, [anchor, today, weekStartMonday])

  if (!selected) return null
  const weekdays = weekStartMonday ? WEEKDAYS_MON : WEEKDAYS_SUN
  const monthLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <section className="card space-y-3 p-4" aria-label="Routine month">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Month check-off</h3>
        <select
          className="h-8 max-w-[14rem] rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] px-2 text-[12px]"
          value={selected.id}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="Routine to check off"
        >
          {routines.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        <button className="icon-btn h-8 w-8" aria-label="Previous month" onClick={() => onMonth((n) => n - 1)}>
          <ChevronLeft size={15} />
        </button>
        <span className="text-[12.5px] font-medium tabular-nums text-[var(--tf-text-secondary)]">{monthLabel}</span>
        <button className="icon-btn h-8 w-8" aria-label="Next month" onClick={() => onMonth((n) => n + 1)}>
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-text-faint)]">
        {weekdays.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const done = doneDays.has(cell.iso)
          const future = cell.iso > today
          const day = parseISODate(cell.iso)?.getDate() ?? 0
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={future || !cell.inMonth}
              onClick={() => !done && onToggleDay(selected.id, cell.iso)}
              aria-label={`${cell.iso}${done ? ' logged' : ''}`}
              className={`flex h-9 items-center justify-center rounded-lg text-[12px] tabular-nums ${
                !cell.inMonth
                  ? 'text-[var(--tf-text-faint)] opacity-30'
                  : done
                    ? 'bg-[var(--tf-accent)] font-semibold text-white'
                    : cell.isToday
                      ? 'border border-[var(--tf-accent)] font-semibold text-[var(--tf-accent-text)]'
                      : future
                        ? 'text-[var(--tf-text-faint)]'
                        : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
              }`}
            >
              {day}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-[var(--tf-text-faint)]">Tap a past day to log this routine. Already-logged days stay marked.</p>
    </section>
  )
}
