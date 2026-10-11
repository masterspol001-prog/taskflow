import { useMemo, useState } from 'react'
import { Flame, Trophy, Zap, CheckCircle2, AlertTriangle, ArrowRight, CalendarClock, Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { computeDashboardStats, priorityBreakdown, isTaskOverdue } from '@/lib/stats'
import { PRIORITIES } from '@/lib/constants'
import { todayISO, formatDateShort } from '@/lib/dates'
import { formatTime } from '@/lib/time'
import { Icon } from '@/components/ui/Icon'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import type { Task } from '@/lib/types'
import { pickNextAction, buildWeeklyReview, durationInsights } from '@/lib/agent'
import { isPro, PLAN_PRICES } from '@/lib/pro'
import { computeGoalAnalytics } from '@/lib/goals'
import {
  ACHIEVEMENTS,
  activityCalendar,
  categoryPerformance,
  computeRuleStreak,
  dailySeries,
  estimatedRemainingMinutes,
  focusTrend,
  levelFromXp,
  peakProductivity,
  productivityBreakdown,
  todayPriorityBreakdown,
  weeklySeries,
} from '@/lib/progress'

export function DashboardView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const navigate = useUIStore((s) => s.navigate)
  const openTask = useUIStore((s) => s.openTask)
  const setAi = useUIStore((s) => s.setAi)
  const setFocus = useUIStore((s) => s.setFocus)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const postponeTask = useStore((s) => s.postponeTask)
  const settings = useStore((s) => s.settings)
  const goals = useStore((s) => s.goals)
  const progress = useStore((s) => s.progress)
  const openNewTask = useUIStore((s) => s.openNewTask)
  const setPaywall = useUIStore((s) => s.setPaywall)
  const [scoreOpen, setScoreOpen] = useState(false)
  const pro = isPro(settings)

  const stats = useMemo(() => computeDashboardStats(tasks), [tasks])
  const active = useMemo(() => tasks.filter((t) => !t.archived), [tasks])
  const today = todayISO()

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
        .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || b.priority - a.priority),
    [active]
  )
  const priorities = useMemo(() => priorityBreakdown(active), [active])
  const visibleProjects = useMemo(() => projects.filter((p) => !p.archived), [projects])

  const goalPct = Math.min(100, stats.completedToday > 0 ? Math.round((stats.completedToday / Math.max(stats.remainingToday + stats.completedToday, 1)) * 100) : 0)
  const next = useMemo(() => pickNextAction(tasks, settings.energy ?? 'medium'), [tasks, settings.energy])
  const review = useMemo(() => buildWeeklyReview(tasks, projects, goals), [tasks, projects, goals])
  const insights = useMemo(() => durationInsights(tasks).filter((i) => i.bias !== 'unknown').slice(0, 5), [tasks])
  const goalAnalytics = useMemo(() => computeGoalAnalytics(goals, tasks), [goals, tasks])
  const level = useMemo(() => levelFromXp(progress.xp), [progress.xp])
  const score = useMemo(() => productivityBreakdown(tasks), [tasks])
  const streak = useMemo(
    () => computeRuleStreak(tasks, settings.streakRule ?? 'any-task', progress.freezeUsedDates),
    [tasks, settings.streakRule, progress.freezeUsedDates]
  )
  const heat = useMemo(() => activityCalendar(tasks, progress.sessions, 84), [tasks, progress.sessions])
  const remainMin = useMemo(() => estimatedRemainingMinutes(tasks, today), [tasks, today])
  const priToday = useMemo(() => todayPriorityBreakdown(tasks, today), [tasks, today])
  const recentUnlocks = useMemo(
    () =>
      [...progress.achievements]
        .sort((a, b) => b.unlockedAt - a.unlockedAt)
        .slice(0, 3)
        .map((u) => ACHIEVEMENTS.find((a) => a.id === u.id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [progress.achievements]
  )
  const daily = useMemo(() => dailySeries(tasks, 14), [tasks])
  const weekly = useMemo(() => weeklySeries(tasks, 8), [tasks])
  const focusDays = useMemo(() => focusTrend(progress.sessions, tasks, 7), [progress.sessions, tasks])
  const cats = useMemo(() => categoryPerformance(tasks).slice(0, 6), [tasks])
  const peak = useMemo(() => peakProductivity(tasks), [tasks])

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">
            {greeting()} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="display mt-1 text-[26px] font-semibold leading-tight tracking-tight text-[var(--tf-text)] sm:text-[30px]">
            {stats.remainingToday > 0
              ? `${stats.remainingToday} left today`
              : stats.overdueCount > 0
              ? 'Clear the backlog'
              : 'Today is clear'}
          </p>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--tf-text-secondary)]">
            {[
              `${stats.completedToday} done`,
              stats.overdueCount > 0 ? `${stats.overdueCount} overdue` : null,
              goalAnalytics.total > 0 ? `${goalAnalytics.completionRate}% goals on track` : null,
              streak > 0 ? `${streak}-day streak` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button className="btn btn-secondary btn-sm" onClick={() => openNewTask()}>
            <Plus size={13} /> Add
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setFocus(true)}>
            <Zap size={13} /> Focus
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => (pro ? setAi(true) : setPaywall(true))}>
            Plan my day <ArrowRight size={14} />
          </button>
        </div>
      </div>
      {!pro && (
        <button
          type="button"
          onClick={() => setPaywall(true)}
          className="card flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-[var(--tf-text)]">Goals and Plan my day are Pro</span>
            <span className="block text-xs text-[var(--tf-text-muted)]">7-day trial, then {PLAN_PRICES.monthly.inr}/month. Free stays 40 tasks and 3 projects.</span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-[var(--tf-accent-text)]">Start trial</span>
        </button>
      )}

      <div className="card-rich flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <ProgressRing value={level.pct} size={92} stroke={8}>
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Lvl</div>
            <div className="display text-[22px] font-semibold leading-none">{level.level}</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Command center</p>
          <p className="display mt-0.5 text-[18px] font-semibold text-[var(--tf-text)]">
            Level {level.level} — {level.title}
          </p>
          <p className="text-[12.5px] tabular-nums text-[var(--tf-text-secondary)]">
            {level.xpIntoLevel.toLocaleString()} / {level.xpForLevel.toLocaleString()} XP
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
            <div className="xp-bar h-full rounded-full bg-gradient-to-r from-[var(--tf-accent-light)] to-[var(--tf-accent-deep)]" style={{ width: `${level.pct}%` }} />
          </div>
        </div>
        <button
          type="button"
          className="rounded-2xl border border-[var(--tf-border)] bg-[var(--tf-surface-2)] px-4 py-3 text-left"
          onClick={() => setScoreOpen((v) => !v)}
          aria-expanded={scoreOpen}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Productivity</p>
          <p className="display text-[28px] font-semibold leading-none text-[var(--tf-accent-text-strong)]">{score.score}</p>
          <p className="mt-1 max-w-[16rem] text-[11.5px] leading-snug text-[var(--tf-text-muted)]">{score.summary}</p>
        </button>
      </div>
      {scoreOpen && (
        <div className="card p-4 text-[12.5px] text-[var(--tf-text-secondary)]">
          <p className="mb-2 text-[13px] font-semibold text-[var(--tf-text)]">How the score is calculated</p>
          <ScoreRow label="Completion" value={score.completion} weight="30%" />
          <ScoreRow label="Priority" value={score.priority} weight="20%" />
          <ScoreRow label="Consistency" value={score.consistency} weight="15%" />
          <ScoreRow label="Focus" value={score.focus} weight="15%" />
          <ScoreRow label="Deadlines" value={score.deadlines} weight="10%" />
          <ScoreRow label="Planning" value={score.planning} weight="10%" />
        </div>
      )}

      {next && (
        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Do this next</p>
            <p className="mt-1 truncate text-[17px] font-semibold text-[var(--tf-text)]">{next.task.title}</p>
            <p className="text-[12.5px] text-[var(--tf-text-muted)]">{next.reason}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => setFocus(true, next.task.id)}>
              <Zap size={13} /> Start
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => postponeTask(next.task.id)}>Later</button>
            <button className="btn btn-ghost btn-sm" onClick={() => openTask(next.task.id)}>Open</button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Flame size={18} className="text-orange-500" />}
          label="Current streak"
          value={streak}
          suffix={streak === 1 ? 'day' : 'days'}
          sub={streak > 0 ? 'Keep it alive today' : 'Complete a task to start'}
          onClick={() => navigate('rewards')}
        />
        <StatCard
          icon={<Trophy size={18} className="text-amber-500" />}
          label="Best streak"
          value={Math.max(stats.bestStreak, progress.records.longestStreak)}
          suffix={Math.max(stats.bestStreak, progress.records.longestStreak) === 1 ? 'day' : 'days'}
          sub="Your all-time record"
          onClick={() => navigate('rewards')}
        />
        <StatCard
          icon={<Zap size={18} className="text-[var(--tf-accent-text)]" />}
          label="Productivity score"
          value={score.score}
          suffix="/100"
          sub={score.summary}
          accent
          onClick={() => setScoreOpen(true)}
        />
        <StatCard
          icon={<CheckCircle2 size={18} className="text-green-500" />}
          label="Completion rate"
          value={stats.completionPct}
          suffix="%"
          sub={`${stats.total} open ${plural(stats.total, 'task')} · ${stats.completionPct}% of all non-archived`}
          onClick={() => navigate('all')}
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left column: ring + chart */}
        <div className="space-y-4 lg:col-span-3">
          <div className="card flex flex-col items-center gap-5 p-6 sm:flex-row">
            <ProgressRing value={goalPct} size={116} stroke={10} color="var(--tf-accent)">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--tf-text)]">{stats.completedToday}</div>
                <div className="text-[11px] font-medium text-[var(--tf-text-muted)]">
                  of {stats.completedToday + stats.remainingToday} today
                </div>
              </div>
            </ProgressRing>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="flex items-center justify-center gap-2 text-[15px] font-semibold text-[var(--tf-text)] sm:justify-start">
                Today's progress <Icon name="sun" size={16} className="text-amber-400" />
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--tf-text-secondary)]">
                {stats.completedToday > 0
                  ? `Nice work — you've completed ${stats.completedToday} ${plural(stats.completedToday, 'task')} so far.`
                  : 'Your day is clear. Add one meaningful task.'}
              </p>
              <p className="mt-1 text-[12px] text-[var(--tf-text-muted)]">
                {remainMin > 0 ? `About ${remainMin} min remaining` : 'No estimated work left today'}
                {` · focus score ${score.focus}`}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Metric label="Overdue" value={stats.overdueCount} tone="red" onClick={() => navigate('overdue')} />
                <Metric label="Due today" value={stats.remainingToday} tone="brand" onClick={() => navigate('today')} />
                <Metric label="Upcoming" value={stats.upcomingCount} tone="muted" onClick={() => navigate('upcoming')} />
                <Metric label="Important" value={stats.importantOpen} tone="amber" onClick={() => navigate('important')} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {([4, 3, 2, 1] as const).map((p) => {
                  const row = priToday[p]
                  if (!row || row.open + row.done === 0) return null
                  return (
                    <span key={p} className="rounded-full bg-[var(--tf-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--tf-text-muted)]">
                      {PRIORITIES[p].label} {row.done}/{row.open + row.done}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          <WeekChart buckets={stats.weekly} />

          <MiniBars title="Daily completions" items={daily.map((d) => ({ key: d.date, label: d.label.slice(0, 3), value: d.count }))} empty="Complete a few tasks and your productivity trends will appear here." />
          <MiniBars title="Weekly completions" items={weekly.map((d) => ({ key: d.start, label: compactWeekLabel(d.label), value: d.count }))} empty="A few weeks of work will draw this chart." />
          <MiniBars title="Focus minutes" items={focusDays.map((d) => ({ key: d.date, label: d.label.slice(0, 3), value: d.minutes }))} empty="Finish a focus session to track time." suffix="m" />

          {(review.wins.length > 0 || review.slips.length > 0) && (
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">This week</h3>
                <button className="text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline" onClick={() => setAi(true, 'review')}>
                  Full review
                </button>
              </div>
              <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
                {review.summary || `${review.completed} done · ${review.overdue} overdue · ${review.projectHealth.filter((p) => p.status !== 'healthy').length} projects need attention`}
              </p>
            </div>
          )}

          {insights.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-3 text-[13px] font-semibold text-[var(--tf-text)]">Estimate vs actual</h3>
              <div className="space-y-2">
                {insights.map((i) => (
                  <button
                    key={i.taskId}
                    type="button"
                    onClick={() => openTask(i.taskId)}
                    className="flex w-full items-center justify-between gap-2 text-left text-[12.5px]"
                  >
                    <span className="min-w-0 truncate font-medium text-[var(--tf-text-secondary)]">{i.title}</span>
                    <span className="shrink-0 tabular-nums text-[var(--tf-text-muted)]">
                      {i.estimate ?? '—'}m est · {i.actualAvg ?? '—'}m avg
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        i.bias === 'under'
                          ? 'bg-amber-500/15 text-amber-600'
                          : i.bias === 'over'
                          ? 'bg-sky-500/15 text-sky-600'
                          : 'bg-emerald-500/15 text-emerald-600'
                      }`}
                    >
                      {i.bias === 'under' ? 'slow' : i.bias === 'over' ? 'fast' : 'on'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Streak</h3>
              <button className="text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline" onClick={() => navigate('rewards')}>
                Rewards
              </button>
            </div>
            <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
              {streak} current · {Math.max(stats.bestStreak, progress.records.longestStreak)} best · {progress.streakFreezes} freeze{progress.streakFreezes === 1 ? '' : 's'}
            </p>
            <div className="mt-3 grid grid-flow-col grid-rows-7 gap-[3px]">
              {heat.map((d) => (
                <span
                  key={d.date}
                  title={`${d.date}: ${d.count}`}
                  className="aspect-square rounded-[2px]"
                  style={{ background: ['var(--tf-surface-3)', 'rgb(var(--tf-accent-rgb) / 0.22)', 'rgb(var(--tf-accent-rgb) / 0.42)', 'rgb(var(--tf-accent-rgb) / 0.68)', 'var(--tf-accent)'][d.intensity] }}
                />
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-2 text-[13px] font-semibold text-[var(--tf-text)]">Achievements</h3>
            {recentUnlocks.length === 0 ? (
              <p className="text-[13px] text-[var(--tf-text-faint)]">Your first achievement is one completed task away.</p>
            ) : (
              <div className="space-y-2">
                {recentUnlocks.map((a) => (
                  <div key={a.id} className="rounded-lg bg-[var(--tf-accent-soft)] px-3 py-2">
                    <p className="text-[13px] font-semibold text-[var(--tf-text)]">{a.title}</p>
                    <p className="text-[11.5px] text-[var(--tf-text-muted)]">{a.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cats.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-2 text-[13px] font-semibold text-[var(--tf-text)]">Categories</h3>
              <div className="flex flex-wrap gap-1.5">
                {cats.map((c) => (
                  <span key={c.tag} className="rounded-full bg-[var(--tf-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--tf-text-muted)]">
                    {c.tag} · {c.done} done
                  </span>
                ))}
              </div>
              {peak.weekday !== '—' && (
                <p className="mt-2 text-[12px] text-[var(--tf-text-muted)]">
                  Peak: {peak.weekday}
                  {peak.hour ? ` around ${peak.hour}` : ''}
                </p>
              )}
            </div>
          )}

          {goalAnalytics.total > 0 && (
            <div className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Goal momentum</h3>
                <button className="text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline" onClick={() => navigate('goals')}>
                  Goals
                </button>
              </div>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-[26px] font-bold leading-none text-[var(--tf-text)]">{goalAnalytics.completionRate}%</span>
                <span className="text-[11.5px] text-[var(--tf-text-muted)]">
                  completion rate
                  <br />
                  {goalAnalytics.completedThisMonth} completed this month
                </span>
              </div>
              <div className="space-y-2">
                {goalAnalytics.longTerm.map((h) => (
                  <div key={h.horizon} className="flex items-center gap-2 text-[12px]">
                    <span className="w-16 shrink-0 text-[var(--tf-text-muted)]">{h.label}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
                      <span className="block h-full rounded-full bg-[var(--tf-accent)]" style={{ width: `${h.pct}%` }} />
                    </span>
                    <span className="w-8 text-right tabular-nums text-[var(--tf-text-faint)]">{h.pct}%</span>
                  </div>
                ))}
              </div>
              {goalAnalytics.byCategory.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {goalAnalytics.byCategory.map((c) => (
                    <span key={c.category} className="rounded-full bg-[var(--tf-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--tf-text-muted)]">
                      {c.label} · {c.count}
                    </span>
                  ))}
                </div>
              )}
              {goalAnalytics.completed > 0 && (
                <div className="mt-3">
                  <ColorBars
                    items={goalAnalytics.completedPerMonth.map((m) => ({
                      key: m.label,
                      label: m.label,
                      value: m.count,
                    }))}
                  />
                </div>
              )}
            </div>
          )}

          {/* Priority breakdown */}
          <div className="card p-4">
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--tf-text)]">Open tasks by priority</h3>
            <div className="space-y-2.5">
              {([4, 3, 2, 1] as const).map((p) => {
                const count = priorities[p] ?? 0
                const totalOpen = active.filter((t) => !t.completed).length
                const pct = totalOpen ? Math.round((count / totalOpen) * 100) : 0
                return (
                  <div key={p} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PRIORITIES[p].color }} />
                    <span className="w-16 text-[12px] font-medium text-[var(--tf-text-secondary)]">{PRIORITIES[p].label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: PRIORITIES[p].color }} />
                    </div>
                    <span className="w-6 text-right text-[12px] font-semibold tabular-nums text-[var(--tf-text)]">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Projects progress */}
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Project progress</h3>
              <button className="text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline" onClick={() => navigate('all')}>
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
                  <button key={p.id} onClick={() => navigate('all', { projectId: p.id })} className="flex w-full items-center gap-2.5 text-left">
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

      {/* Due today + overdue */}
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
  icon: React.ReactNode
  label: string
  value: number
  suffix?: string
  sub: string
  accent?: boolean
  onClick?: () => void
}) {
  const Comp: React.ElementType = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick} className={`card card-hover flex flex-col gap-1.5 p-4 text-left ${onClick ? 'cursor-pointer' : ''}`}>
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
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full bg-[var(--tf-surface-2)] px-2.5 py-1 text-[12px] font-medium text-[var(--tf-text-secondary)] transition-colors hover:bg-[var(--tf-surface-3)]"
    >
      <span className={`text-[13px] font-bold tabular-nums ${color}`}>{value}</span>
      {label}
    </button>
  )
}

function barHeightPct(value: number, max: number): number {
  if (value <= 0) return 10
  return Math.max(22, Math.round((value / Math.max(max, 1)) * 100))
}

function barGradient(value: number, max: number, highlight = false): string {
  if (highlight) return 'from-[var(--tf-accent-deep)] via-[var(--tf-accent)] to-[var(--tf-accent-light)]'
  if (value <= 0) return 'from-[var(--tf-surface-3)] to-[var(--tf-surface-2)]'
  const r = value / Math.max(max, 1)
  if (r < 0.34) return 'from-sky-500 to-cyan-300'
  if (r < 0.67) return 'from-violet-600 to-fuchsia-400'
  return 'from-emerald-600 to-teal-300'
}

function BarLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] text-[var(--tf-text-muted)]">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--tf-surface-3)]" /> None</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-sky-400" /> Low</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-500" /> Mid</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" /> High</span>
    </div>
  )
}

function ColorBars({
  items,
  suffix,
}: {
  items: { key: string; label: string; value: number; highlight?: boolean }[]
  suffix?: string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <>
      <div className="flex h-40 items-end gap-1 pt-5 sm:gap-2">
        {items.map((i) => {
          const h = barHeightPct(i.value, max)
          return (
            <div key={i.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <div className="relative flex w-full justify-center" style={{ height: `${h}%` }}>
                <span
                  className={`absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[110%] text-[11px] font-bold tabular-nums leading-none ${
                    i.value > 0 ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-faint)]'
                  }`}
                >
                  {i.value}
                  {suffix ?? ''}
                </span>
                <div
                  className={`h-full w-[72%] max-w-10 rounded-t-xl bg-gradient-to-t shadow-[0_6px_14px_-8px_rgba(15,23,42,0.35)] ${barGradient(i.value, max, i.highlight)} ${
                    i.highlight ? 'glow-sm' : ''
                  }`}
                  title={`${i.label}: ${i.value}${suffix ?? ''}`}
                />
              </div>
              <span
                className={`max-w-full truncate text-center text-[10px] font-medium leading-tight ${
                  i.highlight ? 'font-bold text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text-muted)]'
                }`}
              >
                {i.label}
              </span>
            </div>
          )
        })}
      </div>
      <BarLegend />
    </>
  )
}

function WeekChart({ buckets }: { buckets: { date: string; count: number; weekday: string; isToday: boolean }[] }) {
  const hasAny = buckets.some((b) => b.count > 0)
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock size={15} className="text-[var(--tf-text-muted)]" />
        <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Last 7 days</h3>
        <span className="ml-auto text-[11px] text-[var(--tf-text-faint)]">Tasks completed</span>
      </div>
      {!hasAny ? (
        <p className="py-4 text-center text-[13px] text-[var(--tf-text-faint)]">No activity yet this week — complete a task to see your rhythm.</p>
      ) : (
        <ColorBars
          items={buckets.map((b) => ({
            key: b.date,
            label: b.weekday,
            value: b.count,
            highlight: b.isToday,
          }))}
        />
      )}
    </div>
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
  icon: React.ReactNode
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
        <button className="ml-auto flex items-center gap-0.5 text-[12px] font-semibold text-[var(--tf-text-muted)] transition-colors hover:text-[var(--tf-text)]" onClick={onSeeAll}>
          See all <ArrowRight size={13} />
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

function priorityThenTime(a: Task, b: Task): number {
  if (b.priority !== a.priority) return b.priority - a.priority
  return (a.dueTime ?? '').localeCompare(b.dueTime ?? '')
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

function ScoreRow({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="w-24 text-[var(--tf-text-muted)]">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
        <span className="block h-full rounded-full bg-[var(--tf-accent)]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </span>
      <span className="w-10 text-right tabular-nums text-[var(--tf-text)]">{value}</span>
      <span className="w-8 text-right text-[11px] text-[var(--tf-text-faint)]">{weight}</span>
    </div>
  )
}

function compactWeekLabel(label: string): string {
  const m = /^([A-Za-z]{3})\s+(\d{1,2})$/.exec(label.trim())
  if (m) return `${m[1]} ${m[2]}`
  return label
}

function MiniBars({
  title,
  items,
  empty,
  suffix,
}: {
  title: string
  items: { key: string; label: string; value: number }[]
  empty: string
  suffix?: string
}) {
  const hasAny = items.some((i) => i.value > 0)
  return (
    <div className="card p-4">
      <h3 className="mb-2 text-[13px] font-semibold text-[var(--tf-text)]">{title}</h3>
      {!hasAny ? (
        <p className="py-3 text-center text-[13px] text-[var(--tf-text-faint)]">{empty}</p>
      ) : (
        <ColorBars items={items} suffix={suffix} />
      )}
    </div>
  )
}
