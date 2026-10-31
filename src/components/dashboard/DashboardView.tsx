import { useMemo, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Flame,
  Play,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import type { Task, ViewId } from '@/lib/types'
import { computeInsights, type InsightSuggestion } from '@/lib/insights'
import { computeDashboardStats, isTaskOverdue } from '@/lib/stats'
import { explainNext, planToday } from '@/lib/rank'
import { recommendTodayActions } from '@/lib/goals'
import { todayISO, formatDateShort } from '@/lib/dates'
import { dueLabel } from '@/lib/query'
import { formatTime } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { EmptyState } from '@/components/ui/states'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import { FEATURES_UNLOCKED, isPro, PLAN_PRICES } from '@/lib/pro'
import { RecoveryPanel } from '@/components/dashboard/RecoveryPanel'
import { WeeklyReviewCard } from '@/components/dashboard/WeeklyReviewCard'
import { hoursLabel } from '@/lib/insights'
import { ActivityHeatmap } from '@/components/analytics/ActivityHeatmap'
import { FocusMinutesChart, PlannedDoneChart, PriorityDonutChart, WeeklyCompletionsChart } from '@/components/analytics/Charts'
import {
  computeVizKpis,
  heatmapDays,
  plannedDoneSeries,
  prioritySeries,
  weeklyCompletionSeries,
} from '@/lib/viz'

export function DashboardView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const progress = useStore((s) => s.progress)
  const energy = useStore((s) => s.settings.energy ?? 'medium')
  const settings = useStore((s) => s.settings)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const navigate = useUIStore((s) => s.navigate)
  const openTask = useUIStore((s) => s.openTask)
  const setFocus = useUIStore((s) => s.setFocus)
  const setPaywall = useUIStore((s) => s.setPaywall)
  const pro = isPro(settings)
  const today = todayISO()

  const report = useMemo(
    () => computeInsights(tasks, goals, progress.sessions, energy),
    [tasks, goals, progress.sessions, energy]
  )
  const stats = useMemo(() => computeDashboardStats(tasks), [tasks])
  const active = useMemo(() => tasks.filter((t) => !t.archived), [tasks])
  const dayPlan = useMemo(() => planToday(tasks, goals, energy, today), [tasks, goals, energy, today])
  const next = dayPlan.must[0] ?? dayPlan.should[0] ?? dayPlan.habits[0]

  const dueToday = useMemo(
    () =>
      active
        .filter((t) => !t.completed && t.dueDate === today)
        .sort((a, b) => priorityThenTime(a, b)),
    [active, today]
  )
  const overdue = useMemo(
    () =>
      active
        .filter((t) => isTaskOverdue(t))
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || b.priority - a.priority),
    [active]
  )
  const upcoming = useMemo(
    () =>
      active
        .filter((t) => !t.completed && t.dueDate && t.dueDate > today)
        .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.sortOrder - b.sortOrder)
        .slice(0, 4),
    [active, today]
  )
  const visibleProjects = useMemo(() => projects.filter((p) => !p.archived), [projects])
  const goalActions = useMemo(() => recommendTodayActions(goals, tasks, new Date(), 3), [goals, tasks])
  const kpis = useMemo(() => computeVizKpis(tasks, progress.sessions), [tasks, progress.sessions])
  const weeklySeries = useMemo(() => weeklyCompletionSeries(tasks), [tasks])
  const plannedSeries = useMemo(() => plannedDoneSeries(report.trend), [report.trend])
  const priorityChart = useMemo(() => prioritySeries(tasks), [tasks])
  const heat = useMemo(() => heatmapDays(tasks, progress.sessions, 84), [tasks, progress.sessions])

  const goalPct =
    stats.completedToday + stats.remainingToday > 0
      ? Math.round((stats.completedToday / (stats.completedToday + stats.remainingToday)) * 100)
      : report.today.pct
  const empty = active.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">Insights</p>
          <h2 className="display mt-1 text-[26px] font-semibold leading-tight tracking-tight text-[var(--tf-text)] sm:text-[30px]">
            {headline(report)}
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--tf-text-secondary)]">
            {greeting()} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('analytics')}>
            Analytics <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('upcoming')}>
            Plan upcoming <ArrowRight size={14} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setFocus(true, report.nextTaskId)}>
            <Play size={13} /> Focus
          </button>
        </div>
      </div>

      {!FEATURES_UNLOCKED && !pro && (
        <button type="button" onClick={() => setPaywall(true)} className="card flex w-full items-center justify-between gap-3 p-4 text-left">
          <span>
            <span className="block text-sm font-semibold text-[var(--tf-text)]">Plan my day and weekly review are Pro</span>
            <span className="block text-xs text-[var(--tf-text-muted)]">
              Ranking stays on-device. 7-day trial, then a prepaid {PLAN_PRICES.monthly.price} / 32-day license. Free stays 40 tasks and 3 projects.
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-[var(--tf-accent-text)]">{settings.trialUsed ? 'Buy Pro' : 'Start trial'}</span>
        </button>
      )}

      <AddTaskRow placeholder="Capture anything…" defaultDueDate={today} />

      {next && (
        <section aria-label="Do this next" className="next-card overflow-hidden rounded-[1.5rem] border border-[var(--tf-border)] bg-[var(--tf-surface)] p-4 shadow-[var(--tf-shadow)] sm:p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">Do this next</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
            <TaskCheckbox
              completed={false}
              priority={next.task.priority}
              onToggle={() => toggleComplete(next.task.id)}
              label={`Complete ${next.task.title}`}
            />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openTask(next.task.id)} aria-label={`Open ${next.task.title}`}>
              <p className="display text-[22px] font-semibold leading-tight tracking-tight text-[var(--tf-text)] sm:text-[26px]">{next.task.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--tf-text-muted)]">
                {explainNext(next)}
              </p>
            </button>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setFocus(true, next.task.id)} aria-label={`Start focusing on ${next.task.title}`}>
                <Play size={16} /> Start
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('today')}>
                Today
              </button>
            </div>
          </div>
        </section>
      )}

      {empty ? (
        <EmptyState
          icon="layoutDashboard"
          title="Insights appear after you capture work"
          description="Add a task above. This page then shows planned vs done, focus hours, and what to postpone."
          action={
            <button type="button" className="btn btn-primary w-full" onClick={() => navigate('today')}>
              Go to Today
            </button>
          }
        />
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              icon={<Flame size={18} className="text-orange-500" />}
              label="Current streak"
              value={stats.streak}
              suffix={stats.streak === 1 ? 'day' : 'days'}
              sub={stats.streak > 0 ? 'Keep it alive today' : 'Complete a task to start'}
              onClick={() => navigate('completed')}
            />
            <StatCard
              icon={<Trophy size={18} className="text-amber-500" />}
              label="Best streak"
              value={stats.bestStreak}
              suffix={stats.bestStreak === 1 ? 'day' : 'days'}
              sub="Your all-time record"
              onClick={() => navigate('completed')}
            />
            <StatCard
              icon={<Zap size={18} className="text-[var(--tf-accent-text)]" />}
              label="Focus this week"
              value={Math.round(report.focusWeekMin)}
              suffix="m"
              sub={report.focusWeekMin === 0 ? 'Start a session to log time' : `${hoursLabel(report.focusWeekMin)} in the last 7 days`}
              accent
              onClick={() => setFocus(true, report.nextTaskId)}
            />
            <StatCard
              icon={<CheckCircle2 size={18} className="text-green-500" />}
              label="Week planned vs done"
              value={report.week.pct}
              suffix="%"
              sub={
                report.week.planned
                  ? `${report.week.done} of ${report.week.planned} planned tasks`
                  : 'No planned tasks this week'
              }
              onClick={() => navigate('completed')}
            />
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-cols-5">
            <div className="min-w-0 space-y-4 xl:col-span-3">
              <div className="card flex flex-col items-center gap-5 p-5 sm:flex-row">
                <ProgressRing value={goalPct} size={116} stroke={10} color="var(--tf-accent)">
                  <div className="text-center">
                    <div className="display text-2xl font-bold leading-none text-[var(--tf-text)]">{stats.completedToday}</div>
                    <div className="mt-0.5 text-[11px] font-medium text-[var(--tf-text-muted)]">
                      of {stats.completedToday + stats.remainingToday} today
                    </div>
                  </div>
                </ProgressRing>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="flex items-center justify-center gap-2 text-[15px] font-semibold text-[var(--tf-text)] sm:justify-start">
                    Today&apos;s progress <Icon name="sun" size={16} className="text-amber-400" />
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--tf-text-secondary)]">
                    {stats.completedToday > 0
                      ? `Nice work — you've completed ${stats.completedToday} ${plural(stats.completedToday, 'task')} so far.`
                      : 'No completions yet. Start with the first task below to light up your streak.'}
                  </p>
                   <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <Metric label="Total" value={kpis.total} tone="muted" onClick={() => navigate('all')} />
                    <Metric label="Overdue" value={stats.overdueCount} tone="red" onClick={() => navigate('overdue')} />
                    <Metric label="Due today" value={stats.remainingToday} tone="brand" onClick={() => navigate('today')} />
                    <Metric label="Upcoming" value={stats.upcomingCount} tone="muted" onClick={() => navigate('upcoming')} />
                    <Metric label="Important" value={stats.importantOpen} tone="amber" onClick={() => navigate('important')} />
                  </div>
                </div>
              </div>
              <WeeklyCompletionsChart data={weeklySeries} />
            </div>

            <div className="min-w-0 space-y-4 xl:col-span-2">
              <PriorityDonutChart data={priorityChart} />

              <div className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Project progress</h3>
                  <button type="button" className="text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline" onClick={() => navigate('all')}>
                    View all
                  </button>
                </div>
                <div className="space-y-3">
                  {visibleProjects.length === 0 && <p className="text-[13px] text-[var(--tf-text-faint)]">No projects yet.</p>}
                  {visibleProjects.map((p) => {
                    const pt = active.filter((t) => t.projectId === p.id)
                    const done = pt.filter((t) => t.completed).length
                    const pct = pt.length ? Math.round((done / pt.length) * 100) : 0
                    return (
                      <button key={p.id} type="button" onClick={() => navigate('all', { projectId: p.id })} className="flex w-full items-center gap-2.5 text-left">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: p.color + '22', color: p.color }}>
                          <Icon name={p.icon} size={13} />
                        </span>
                        <span className="flex-1">
                          <span className="flex items-baseline justify-between">
                            <span className="truncate text-[12.5px] font-medium text-[var(--tf-text-secondary)]">{p.name}</span>
                            <span className="text-[11px] font-semibold tabular-nums text-[var(--tf-text-faint)]">
                              {done}/{pt.length}
                            </span>
                          </span>
                          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
                            <span className="block h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: p.color }} />
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <WeeklyReviewCard />

          <RecoveryPanel />

          {report.suggestions.length > 0 && (
            <section aria-label="What to do next">
              <h3 className="mb-2.5 display text-[18px] font-semibold text-[var(--tf-text)]">What to protect</h3>
              <div className="space-y-2">
                {report.suggestions.map((s) => (
                  <SuggestionRow
                    key={s.id}
                    suggestion={s}
                    onAction={() => {
                      if (s.kind === 'focus') setFocus(true, report.nextTaskId)
                      else if (s.kind === 'estimate') document.getElementById('insights-estimates')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      else if (s.kind === 'overdue') document.getElementById('insights-recovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      else if (s.taskId) openTask(s.taskId)
                      else if (s.view) navigate(s.view as ViewId)
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <PlannedDoneChart data={plannedSeries} />
            <FocusMinutesChart data={report.focusDays.map((d) => ({ date: d.date, label: d.label, value: d.minutes }))} />
          </div>

          <ActivityHeatmap days={heat} weekStartMonday={settings.weekStartMonday !== false} />

          {(goalActions.length > 0 || upcoming.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {goalActions.length > 0 && (
                <SnapshotCard title="Goals" onSeeAll={() => navigate('goals')} seeAllLabel="Open Goals">
                  {goalActions.map((a) => (
                    <button
                      key={a.goalId}
                      type="button"
                      onClick={() => (a.taskId ? openTask(a.taskId) : navigate('goals'))}
                      className="flex w-full items-start gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-[var(--tf-hover)]"
                    >
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.goalColor }} aria-hidden="true" />
                      <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[var(--tf-text)]">{a.action}</span>
                      <span className="block truncate text-[11.5px] text-[var(--tf-text-muted)]">
                        {a.goalTitle} · {a.reason}
                      </span>
                      </span>
                    </button>
                  ))}
                </SnapshotCard>
              )}
              {upcoming.length > 0 && (
                <SnapshotCard title="Upcoming" onSeeAll={() => navigate('upcoming')} seeAllLabel="See upcoming">
                  {upcoming.map((t) => (
                    <SnapshotTask
                      key={t.id}
                      task={t}
                      onOpen={() => openTask(t.id)}
                      onToggle={() => toggleComplete(t.id)}
                      meta={t.dueDate ? dueLabel(t.dueDate) : undefined}
                    />
                  ))}
                </SnapshotCard>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <TaskGroupCard
              title="Due today"
              icon={<Icon name="calendarDays" size={15} className="text-[var(--tf-accent-text)]" />}
              tasks={dueToday}
              empty="Nothing due today."
              onSeeAll={() => navigate('today')}
              onOpenTask={openTask}
              onToggle={toggleComplete}
            />
            <TaskGroupCard
              title="Overdue"
              icon={<AlertTriangle size={15} className="text-red-500" />}
              tasks={overdue}
              empty="Nothing overdue. Impressive."
              onSeeAll={() => navigate('overdue')}
              onOpenTask={openTask}
              onToggle={toggleComplete}
              overdue
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[var(--tf-text)]">Overdue patterns</h3>
              {report.overdue.count === 0 ? (
                <p className="py-3 text-[13px] text-[var(--tf-text-faint)]">Nothing overdue. Keep the list honest.</p>
              ) : (
                <>
                  <p className="text-[13px] text-[var(--tf-text-secondary)]">
                    {report.overdue.count} open past due
                    {report.overdue.oldestTitle ? ` · oldest: ${report.overdue.oldestTitle}` : ''}
                    {report.overdue.postponed > 0 ? ` · ${report.overdue.postponed} postponed` : ''}
                  </p>
                  {report.weekdayOverdue.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {report.weekdayOverdue.map((w) => (
                        <span key={w.weekday} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500">
                          {w.weekday} · {w.count}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="mt-3 text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline"
                    onClick={() => document.getElementById('insights-recovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    Recover overdue
                  </button>
                </>
              )}
            </section>

            <section id="insights-estimates" className="card p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[var(--tf-text)]">Estimate vs actual</h3>
              {report.estimates.rows.length === 0 ? (
                <p className="py-3 text-[13px] text-[var(--tf-text-faint)]">Log focus time on a task to compare estimates.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[12.5px] text-[var(--tf-text-muted)]">
                    {report.estimates.under} ran long · {report.estimates.over} finished early · {report.estimates.on} on target
                  </p>
                  {report.estimates.rows.map((row) => (
                    <button
                      key={row.taskId}
                      type="button"
                      onClick={() => openTask(row.taskId)}
                      className="flex w-full items-center justify-between gap-2 text-left text-[12.5px]"
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--tf-text-secondary)]">{row.title}</span>
                      <span className="shrink-0 tabular-nums text-[var(--tf-text-muted)]">
                        {row.estimate ?? '—'}m est · {row.actualAvg ?? '—'}m avg
                      </span>
                      <BiasPill bias={row.bias} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function headline(report: ReturnType<typeof computeInsights>): string {
  if (report.burnout.level === 'high') return 'Protect a shorter day'
  if (report.overdue.count > 0) {
    return report.overdue.count === 1 ? '1 task needs a decision' : `${report.overdue.count} tasks need a decision`
  }
  if (report.today.planned > 0 && report.today.remaining === 0) return 'Today’s plan is done'
  if (report.today.remaining > 0) return `${report.today.remaining} left to finish`
  return 'A clear view of the week'
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Working late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`
}

function priorityThenTime(a: Task, b: Task): number {
  if (b.priority !== a.priority) return b.priority - a.priority
  return (a.dueTime ?? '').localeCompare(b.dueTime ?? '')
}

function SuggestionRow({ suggestion, onAction }: { suggestion: InsightSuggestion; onAction: () => void }) {
  const icon =
    suggestion.kind === 'burnout' || suggestion.kind === 'protect' ? (
      <Flame size={15} className="text-amber-500" />
    ) : suggestion.kind === 'overdue' ? (
      <AlertTriangle size={15} className="text-red-500" />
    ) : suggestion.kind === 'focus' ? (
      <Zap size={15} className="text-[var(--tf-accent-text)]" />
    ) : suggestion.kind === 'celebrate' ? (
      <Target size={15} className="text-emerald-500" />
    ) : (
      <Clock size={15} className="text-[var(--tf-text-muted)]" />
    )
  return (
    <div className="card flex items-start gap-3 p-3.5">
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[var(--tf-text)]">{suggestion.title}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">{suggestion.detail}</p>
      </div>
      {suggestion.actionLabel && (
        <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={onAction}>
          {suggestion.actionLabel} <ArrowRight size={12} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  sub,
  accent,
  onClick,
}: {
  icon: ReactNode
  label: string
  value: number
  suffix?: string
  sub: string
  accent?: boolean
  onClick?: () => void
}) {
  const Comp: React.ElementType = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={`card flex flex-col gap-1.5 p-4 text-left transition-shadow ${onClick ? 'hover:shadow-pop' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">{label}</span>
        {icon}
      </div>
      <div className={`text-[26px] font-bold leading-none tracking-tight ${accent ? 'text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text)]'}`}>
        {value}
        {suffix && <span className="ml-1 text-[13px] font-medium text-[var(--tf-text-muted)]">{suffix}</span>}
      </div>
      <span className="text-[11.5px] text-[var(--tf-text-faint)]">{sub}</span>
    </Comp>
  )
}

function Metric({ label, value, tone, onClick }: { label: string; value: number; tone: 'red' | 'brand' | 'muted' | 'amber'; onClick?: () => void }) {
  const color =
    tone === 'red' ? 'text-red-500' : tone === 'brand' ? 'text-[var(--tf-accent-text-strong)]' : tone === 'amber' ? 'text-amber-500' : 'text-[var(--tf-text-muted)]'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full bg-[var(--tf-surface-2)] px-2.5 py-1 text-[12px] font-medium text-[var(--tf-text-secondary)] transition-colors hover:bg-[var(--tf-surface-3)]"
    >
      <span className={`text-[13px] font-bold tabular-nums ${color}`}>{value}</span>
      {label}
    </button>
  )
}

function TaskGroupCard({
  title,
  icon,
  tasks,
  empty,
  overdue: isOverdueCard,
  onSeeAll,
  onOpenTask,
  onToggle,
}: {
  title: string
  icon: ReactNode
  tasks: Task[]
  empty: string
  overdue?: boolean
  onSeeAll: () => void
  onOpenTask: (id: string) => void
  onToggle: (id: string) => void
}) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">{title}</h3>
        <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${isOverdueCard ? 'bg-red-500/10 text-red-500' : 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]'}`}>
          {tasks.length}
        </span>
        <button type="button" className="ml-auto flex items-center gap-0.5 text-[12px] font-semibold text-[var(--tf-text-muted)] transition-colors hover:text-[var(--tf-text)]" onClick={onSeeAll}>
          See all <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-0.5">
        {tasks.length === 0 && <p className="py-3 text-[13px] text-[var(--tf-text-faint)]">{empty}</p>}
        {tasks.slice(0, 5).map((t) => (
          <div
            key={t.id}
            className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-[var(--tf-hover)]"
            onClick={() => onOpenTask(t.id)}
          >
            <TaskCheckbox completed={false} priority={t.priority} onToggle={() => onToggle(t.id)} label={`Complete ${t.title}`} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-[var(--tf-text)]">{t.title}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--tf-text-faint)]">
              {t.dueTime && <span>{formatTime(t.dueTime)}</span>}
              {t.dueDate && !isOverdueCard && <span>{formatDateShort(t.dueDate)}</span>}
              {isOverdueCard && t.dueDate && <span className="font-medium text-red-500">{formatDateShort(t.dueDate)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SnapshotCard({
  title,
  onSeeAll,
  seeAllLabel,
  children,
}: {
  title: string
  onSeeAll: () => void
  seeAllLabel: string
  children: ReactNode
}) {
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">{title}</h3>
        <button type="button" className="ml-auto text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline" onClick={onSeeAll}>
          {seeAllLabel}
        </button>
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}

function SnapshotTask({
  task,
  onOpen,
  onToggle,
  meta,
}: {
  task: Task
  onOpen: () => void
  onToggle: () => void
  meta?: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-[var(--tf-hover)]">
      <TaskCheckbox completed={false} priority={task.priority} onToggle={onToggle} label={`Complete ${task.title}`} size="sm" />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Open ${task.title}`}>
        <span className="block truncate text-[13px] text-[var(--tf-text)]">{task.title}</span>
      </button>
      {(meta || task.dueTime) && (
        <span className="shrink-0 text-[11px] text-[var(--tf-text-faint)]">{meta ?? formatTime(task.dueTime)}</span>
      )}
    </div>
  )
}

function BiasPill({ bias }: { bias: 'over' | 'under' | 'on' | 'unknown' }) {
  const cls =
    bias === 'under'
      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
      : bias === 'over'
        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  const label = bias === 'under' ? 'slow' : bias === 'over' ? 'fast' : bias === 'on' ? 'on' : 'n/a'
  return <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${cls}`}>{label}</span>
}
