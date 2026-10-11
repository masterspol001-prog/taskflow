import { useMemo, useState, type ReactNode } from 'react'
import { Play, ChevronDown, ChevronRight, Sun, CalendarClock, ArrowRight, Target, Clock, Repeat, Hourglass } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import type { Task } from '@/lib/types'
import { todayISO } from '@/lib/dates'
import { dueLabel } from '@/lib/query'
import { isTaskOverdue } from '@/lib/stats'
import { estimateLabel, formatTime } from '@/lib/time'
import { adaptBehindSchedule, tasksThatFitNow } from '@/lib/agent'
import { computeGoalHealth, recommendTodayActions } from '@/lib/goals'
import { planToday, type RankedTask } from '@/lib/rank'
import { PRIORITIES } from '@/lib/constants'
import { EmptyState } from '@/components/ui/states'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Good evening'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function TodayView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const energy = useStore((s) => s.settings.energy ?? 'medium')
  const name = useStore((s) => s.settings.name)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const toggleImportant = useStore((s) => s.toggleImportant)
  const openTask = useUIStore((s) => s.openTask)
  const navigate = useUIStore((s) => s.navigate)
  const setFocus = useUIStore((s) => s.setFocus)
  const setQuickAdd = useUIStore((s) => s.setQuickAdd)
  const postponeTask = useStore((s) => s.postponeTask)
  const updateTask = useStore((s) => s.updateTask)
  const toast = useStore((s) => s.toast)

  const today = todayISO()
  const [attentionOpen, setAttentionOpen] = useState(true)
  const adapt = useMemo(() => adaptBehindSchedule(tasks), [tasks])
  const hour = new Date().getHours()
  const minutesFree = hour >= 9 && hour < 18 ? Math.max(15, Math.min(90, (18 - hour) * 30)) : 45
  const fit = useMemo(() => tasksThatFitNow(tasks, minutesFree), [tasks, minutesFree])

  const data = useMemo(() => {
    const active = tasks.filter((t) => !t.archived)
    const dueToday = active.filter((t) => t.dueDate === today)
    const open = dueToday.filter((t) => !t.completed)
    const done = dueToday.filter((t) => t.completed)
    const overdue = active
      .filter((t) => !t.completed && isTaskOverdue(t))
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    const upcoming = active
      .filter((t) => !t.completed && t.dueDate && t.dueDate > today)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.sortOrder - b.sortOrder)
      .slice(0, 4)
    return { open, done, overdue, upcoming }
  }, [tasks, today])

  const totalToday = data.open.length + data.done.length

  const dayPlan = useMemo(() => planToday(tasks, goals, energy, today), [tasks, goals, energy, today])
  const plannedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const row of [...dayPlan.must, ...dayPlan.should, ...dayPlan.habits, ...dayPlan.waiting]) ids.add(row.task.id)
    return ids
  }, [dayPlan])
  const attentionOverdue = useMemo(() => data.overdue.filter((t) => !plannedIds.has(t.id)), [data.overdue, plannedIds])

  const nothingOpen =
    data.open.length === 0 &&
    data.overdue.length === 0 &&
    dayPlan.must.length === 0 &&
    dayPlan.should.length === 0 &&
    dayPlan.habits.length === 0
  const dayComplete = nothingOpen && data.done.length > 0
  const trulyEmpty = nothingOpen && data.done.length === 0 && tasks.filter((t) => !t.archived && !t.completed).length === 0
  const firstName = name ? name.trim().split(/\s+/)[0] : ''
  const next = dayPlan.must[0] ?? dayPlan.should[0] ?? dayPlan.habits[0]
  const restMust = dayPlan.must.slice(next && dayPlan.must[0]?.task.id === next.task.id ? 1 : 0)
  const restShould = dayPlan.should.filter((r) => r.task.id !== next?.task.id)
  const restHabits = dayPlan.habits.filter((r) => r.task.id !== next?.task.id)
  const donePct = totalToday > 0 ? Math.round((data.done.length / totalToday) * 100) : 0
  const overCapacity = dayPlan.totalMinutes > dayPlan.capacityMinutes
  const fitExtras = fit.tasks.filter((t) => t.id !== next?.task.id).slice(0, 3)

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--tf-text-muted)]">
          {greeting()}
          {firstName ? ` · ${firstName}` : ''}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-[28px] font-semibold leading-[1.08] tracking-tight text-[var(--tf-text)] sm:text-[34px]">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          {totalToday > 0 && (
            <p className="text-[13px] font-medium tabular-nums text-[var(--tf-text-muted)]">
              {data.done.length} of {totalToday} done
            </p>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--tf-accent-light)] to-[var(--tf-accent)] transition-all duration-500 ease-smooth"
            style={{ width: `${donePct}%` }}
          />
        </div>
      </header>

      {next && (
        <NextActionCard
          row={next}
          onToggle={() => toggleComplete(next.task.id)}
          onOpen={() => openTask(next.task.id)}
          onStart={() => setFocus(true, next.task.id)}
          onLater={() => postponeTask(next.task.id)}
        />
      )}

      {adapt && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          <span className="text-[13px] font-medium text-[var(--tf-text)]">{adapt.message}</span>
          <span className="flex-1" />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              updateTask(adapt.taskId, { dueDate: adapt.toDate, dueTime: adapt.toTime })
              toast({ title: 'Moved', message: `${adapt.title} → ${adapt.toDate} ${adapt.toTime}`, kind: 'success' })
            }}
          >
            Apply
          </button>
        </div>
      )}

      {!next && fitExtras.length > 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--tf-border-strong)] px-3.5 py-3">
          <p className="text-[12.5px] text-[var(--tf-text-muted)]">{fit.message}</p>
          {fitExtras.map((t) => (
            <div key={t.id} className="mt-1.5 flex items-center gap-2">
              <button className="min-w-0 flex-1 truncate text-left text-[13px] text-[var(--tf-text-secondary)]" onClick={() => openTask(t.id)}>
                {t.title} · {estimateLabel(t.estimate)}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setFocus(true, t.id)}>
                Start
              </button>
            </div>
          ))}
        </div>
      )}

      <AddTaskRow placeholder="Capture anything…" defaultDueDate={today} />

      {(dayPlan.must.length > 0 || dayPlan.should.length > 0 || dayPlan.habits.length > 0) && (
        <p className={`flex flex-wrap items-center gap-2 text-[12.5px] ${overCapacity ? 'text-amber-600' : 'text-[var(--tf-text-muted)]'}`}>
          <Clock size={13} /> {estimateLabel(dayPlan.totalMinutes)} of {estimateLabel(dayPlan.capacityMinutes)} planned
          {overCapacity && <span>· over capacity — postpone or drop something</span>}
          {!overCapacity && dayPlan.goalsImpacted.length > 0 && (
            <span>· moves {dayPlan.goalsImpacted.slice(0, 3).join(', ')}</span>
          )}
        </p>
      )}

      {restMust.length > 0 && (
        <section aria-label="Must do">
          <SectionTitle icon={<Sun size={14} />} label="Must-do" hint="then these" />
          <Panel>
            {restMust.map((row) => (
              <RankedRow key={row.task.id} row={row} onToggle={() => toggleComplete(row.task.id)} onOpen={() => openTask(row.task.id)} onStart={() => setFocus(true, row.task.id)} />
            ))}
          </Panel>
        </section>
      )}

      {restShould.length > 0 && (
        <section aria-label="Should do">
          <SectionTitle icon={<Target size={14} />} label="Should-do" hint={`${restShould.length}`} />
          <Panel>
            {restShould.map((row) => (
              <RankedRow key={row.task.id} row={row} onToggle={() => toggleComplete(row.task.id)} onOpen={() => openTask(row.task.id)} onStart={() => setFocus(true, row.task.id)} compact />
            ))}
          </Panel>
        </section>
      )}

      {restHabits.length > 0 && (
        <section aria-label="Habits">
          <SectionTitle icon={<Repeat size={14} />} label="Habits" />
          <Panel>
            {restHabits.map((row) => (
              <RankedRow key={row.task.id} row={row} onToggle={() => toggleComplete(row.task.id)} onOpen={() => openTask(row.task.id)} onStart={() => setFocus(true, row.task.id)} compact />
            ))}
          </Panel>
        </section>
      )}

      <TodaysGoals />

      {dayPlan.waiting.length > 0 && (
        <section aria-label="Waiting">
          <SectionTitle icon={<Hourglass size={14} />} label="Waiting" hint={`${dayPlan.waiting.length}`} />
          <Panel>
            {dayPlan.waiting.map((row) => (
              <TaskItem
                key={row.task.id}
                task={row.task}
                project={row.task.projectId ? projects.find((p) => p.id === row.task.projectId) : undefined}
                onToggle={() => toggleComplete(row.task.id)}
                onOpen={() => openTask(row.task.id)}
                onToggleImportant={() => toggleImportant(row.task.id)}
                compact
              />
            ))}
          </Panel>
        </section>
      )}

      {attentionOverdue.length > 0 && (
        <section aria-label="Needs attention">
          <button
            className="flex w-full items-center gap-2 text-left"
            onClick={() => setAttentionOpen((v) => !v)}
            aria-expanded={attentionOpen}
          >
            <span className="text-[15px] font-semibold text-[var(--tf-text)]">Needs attention</span>
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-500">
              {attentionOverdue.length} overdue
            </span>
            {attentionOpen ? <ChevronDown size={16} className="text-[var(--tf-text-faint)]" /> : <ChevronRight size={16} className="text-[var(--tf-text-faint)]" />}
          </button>
          {attentionOpen && (
            <Panel className="mt-2">
              {attentionOverdue.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  project={task.projectId ? projects.find((p) => p.id === task.projectId) : undefined}
                  onToggle={() => toggleComplete(task.id)}
                  onOpen={() => openTask(task.id)}
                  onToggleImportant={() => toggleImportant(task.id)}
                  compact
                  suppressOverduePill
                />
              ))}
            </Panel>
          )}
        </section>
      )}

      {trulyEmpty && (
        <EmptyState
          icon="sun"
          title="Capture your first task"
          description="Type above, or press ⌘K. Today will pick the next useful move."
          action={
            <button className="btn btn-primary w-full" onClick={() => setQuickAdd(true)}>
              Quick add
            </button>
          }
        />
      )}

      {dayComplete && (
        <EmptyState
          icon="checkCheck"
          title="Today is clear"
          description={
            data.upcoming.length > 0
              ? `${data.done.length} finished. Enjoy the calm, or peek at what is coming.`
              : `${data.done.length} finished. A quiet day to rest, or get ahead.`
          }
          action={
            <div className="flex flex-col gap-2">
              {data.upcoming.length > 0 && (
                <button className="btn btn-secondary w-full" onClick={() => navigate('upcoming')}>
                  See upcoming
                </button>
              )}
              <button className="btn btn-ghost w-full" onClick={() => setFocus(true)}>
                Start a focus session
              </button>
            </div>
          }
        />
      )}

      {nothingOpen && !trulyEmpty && !dayComplete && (
        <EmptyState
          icon="sun"
          title="Nothing planned for today"
          description={
            data.upcoming.length > 0
              ? 'Nothing is due. Capture something above, or peek at what is coming.'
              : 'Capture a task above, or rest. Both count.'
          }
          action={
            data.upcoming.length > 0 ? (
              <button className="btn btn-secondary w-full" onClick={() => navigate('upcoming')}>
                See upcoming
              </button>
            ) : undefined
          }
        />
      )}

      {data.upcoming.length > 0 && (
        <section aria-label="Coming up">
          <SectionTitle icon={<CalendarClock size={14} />} label="Coming up" />
          <Panel>
            {data.upcoming.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                project={task.projectId ? projects.find((p) => p.id === task.projectId) : undefined}
                onToggle={() => toggleComplete(task.id)}
                onOpen={() => openTask(task.id)}
                onToggleImportant={() => toggleImportant(task.id)}
                compact
              />
            ))}
            <button className="mt-1 w-full rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--tf-accent-text)] hover:bg-[var(--tf-hover)]" onClick={() => navigate('upcoming')}>
              See all upcoming →
            </button>
          </Panel>
        </section>
      )}
    </div>
  )
}

function TodaysGoals() {
  const goals = useStore((s) => s.goals)
  const tasks = useStore((s) => s.tasks)
  const addTaskToGoal = useStore((s) => s.addTaskToGoal)
  const toast = useStore((s) => s.toast)
  const setFocus = useUIStore((s) => s.setFocus)
  const navigate = useUIStore((s) => s.navigate)

  const actions = useMemo(() => recommendTodayActions(goals, tasks, new Date(), 5), [goals, tasks])
  const atRisk = useMemo(
    () =>
      goals.filter((g) => {
        if (g.status === 'completed' || g.status === 'archived' || g.status === 'paused') return false
        const h = computeGoalHealth(g, tasks)
        return h === 'at_risk' || h === 'attention'
      }).length,
    [goals, tasks]
  )
  if (actions.length === 0) return null

  return (
    <section aria-label="Today's goals">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">
          <Target size={14} />
        </span>
        <h2 className="display text-[18px] font-semibold text-[var(--tf-text)]">Today&apos;s goals</h2>
        <span className="text-xs text-[var(--tf-text-faint)]">
          · {atRisk > 0 ? `${atRisk} need a push` : 'why it matters'}
        </span>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline"
          onClick={() => navigate('goals')}
        >
          All goals <ArrowRight size={12} />
        </button>
      </div>
      <div className="overflow-hidden rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-[var(--tf-shadow)]">
        {actions.map((a) => (
          <div key={`${a.goalId}-${a.action}`} className="flex items-center gap-3 border-b border-[var(--tf-border)] px-3.5 py-3 last:border-b-0 hover:bg-[var(--tf-hover)]">
            <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.goalColor }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[var(--tf-text)]">{a.action}</p>
              <p className="truncate text-[11.5px] text-[var(--tf-text-muted)]">
                {a.goalTitle} · {a.health === 'at_risk' ? 'at risk' : a.health === 'attention' ? 'needs attention' : a.reason}
              </p>
            </div>
            {a.taskId ? (
              <button className="btn btn-primary btn-sm shrink-0" onClick={() => setFocus(true, a.taskId)}>
                <Play size={12} /> Start
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-sm shrink-0"
                onClick={() => {
                  const created = addTaskToGoal(a.goalId, { title: a.action, dueDate: todayISO() })
                  if (created) toast({ title: 'Added to today', message: a.action, kind: 'success' })
                }}
              >
                Add to today
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionTitle({ icon, label, hint }: { icon: ReactNode; label: string; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">{icon}</span>
      <h2 className="display text-[18px] font-semibold text-[var(--tf-text)]">{label}</h2>
      {hint && <span className="text-xs text-[var(--tf-text-faint)]">· {hint}</span>}
      <span className="ml-auto" />
    </div>
  )
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-[var(--tf-shadow)] ${className ?? ''}`}>
      {children}
    </div>
  )
}

function NextActionCard({
  row,
  onToggle,
  onOpen,
  onStart,
  onLater,
}: {
  row: RankedTask
  onToggle: () => void
  onOpen: () => void
  onStart: () => void
  onLater: () => void
}) {
  const task = row.task
  return (
    <section aria-label="Do this next" className="next-card overflow-hidden rounded-[1.5rem] border border-[var(--tf-border)] bg-[var(--tf-surface)] p-4 shadow-[var(--tf-shadow)] sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">Do this next</p>
      <div className="relative mt-3 flex items-start gap-3">
        <FocusCheck onToggle={onToggle} task={task} />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Open ${task.title}`}>
          <p className="display text-[22px] font-semibold leading-tight tracking-tight text-[var(--tf-text)] sm:text-[26px]">{task.title}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-[var(--tf-text-muted)]">
            <span>{row.why.join(' · ')}</span>
            {row.minutes ? <span>{estimateLabel(row.minutes)}</span> : null}
            {row.goalTitles[0] && <span className="text-[var(--tf-accent-text)]">{row.goalTitles[0]}</span>}
          </p>
        </button>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <button className="btn btn-primary btn-sm" onClick={onStart} aria-label={`Start focusing on ${task.title}`}>
            <Play size={16} /> Start
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onLater} aria-label={`Postpone ${task.title}`}>
            Later
          </button>
        </div>
      </div>
    </section>
  )
}

function RankedRow({
  row,
  onToggle,
  onOpen,
  onStart,
  compact,
}: {
  row: RankedTask
  onToggle: () => void
  onOpen: () => void
  onStart: () => void
  compact?: boolean
}) {
  const task = row.task
  return (
    <div className="flex items-center gap-3 border-b border-[var(--tf-border)] px-3.5 py-3 last:border-b-0 hover:bg-[var(--tf-hover)]">
      <FocusCheck onToggle={onToggle} task={task} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Open ${task.title}`}>
        <p className={`truncate font-medium text-[var(--tf-text)] ${compact ? 'text-[14px]' : 'text-[15px]'}`}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--tf-text-muted)]">
          <span>{row.why.join(' · ')}</span>
          {row.minutes ? <span>{estimateLabel(row.minutes)}</span> : null}
          {row.goalTitles[0] && <span className="text-[var(--tf-accent-text)]">{row.goalTitles[0]}</span>}
          {task.dueDate && task.dueTime && <span>{dueLabel(task.dueDate)} · {formatTime(task.dueTime)}</span>}
          <span style={{ color: PRIORITIES[task.priority].color }}>{PRIORITIES[task.priority].short}</span>
        </p>
      </button>
      <button
        className={compact ? 'icon-btn h-8 w-8 shrink-0 text-[var(--tf-accent-text)]' : 'btn btn-secondary btn-sm shrink-0'}
        onClick={(e) => {
          e.stopPropagation()
          onStart()
        }}
        aria-label={`Start focusing on ${task.title}`}
      >
        <Play size={13} />
        {!compact && ' Start'}
      </button>
    </div>
  )
}

function FocusCheck({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <TaskCheckbox
      completed={task.completed}
      priority={task.priority}
      onToggle={onToggle}
      label={`Mark "${task.title}" ${task.completed ? 'as not done' : 'as done'}`}
    />
  )
}
