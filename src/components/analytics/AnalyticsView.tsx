import { useMemo } from 'react'
import { ArrowRight, CheckCircle2, Flame, ListChecks, Play, Timer, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { computeInsights, hoursLabel } from '@/lib/insights'
import { computeDashboardStats } from '@/lib/stats'
import {
  completionSeries,
  computeVizKpis,
  focusMinuteSeries,
  goalProgressRows,
  heatmapDays,
  plannedDoneSeries,
  prioritySeries,
  projectSeries,
  tagSeries,
  weeklyCompletionSeries,
} from '@/lib/viz'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { EmptyState } from '@/components/ui/states'
import { LoadingRows } from '@/components/ui/states'
import { KpiCard } from './KpiCard'
import { ActivityHeatmap } from './ActivityHeatmap'
import {
  CompletionTrendChart,
  FocusMinutesChart,
  NamedBarsChart,
  PlannedDoneChart,
  PriorityDonutChart,
  WeeklyCompletionsChart,
} from './Charts'

export function AnalyticsView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const progress = useStore((s) => s.progress)
  const energy = useStore((s) => s.settings.energy ?? 'medium')
  const weekStartMonday = useStore((s) => s.settings.weekStartMonday !== false)
  const hydrated = useStore((s) => s.hydrated)
  const navigate = useUIStore((s) => s.navigate)
  const setFocus = useUIStore((s) => s.setFocus)

  const report = useMemo(
    () => computeInsights(tasks, goals, progress.sessions, energy),
    [tasks, goals, progress.sessions, energy]
  )
  const stats = useMemo(() => computeDashboardStats(tasks), [tasks])
  const kpis = useMemo(() => computeVizKpis(tasks, progress.sessions), [tasks, progress.sessions])
  const weekly = useMemo(() => weeklyCompletionSeries(tasks), [tasks])
  const trend = useMemo(() => completionSeries(tasks, 14), [tasks])
  const planned = useMemo(() => plannedDoneSeries(report.trend), [report.trend])
  const focus = useMemo(() => focusMinuteSeries(tasks, progress.sessions, 7), [tasks, progress.sessions])
  const priorities = useMemo(() => prioritySeries(tasks), [tasks])
  const projectsSeries = useMemo(() => projectSeries(tasks, projects), [tasks, projects])
  const tags = useMemo(() => tagSeries(tasks), [tasks])
  const heat = useMemo(() => heatmapDays(tasks, progress.sessions, 84), [tasks, progress.sessions])
  const goalsRows = useMemo(() => goalProgressRows(goals, tasks), [goals, tasks])
  const empty = tasks.filter((t) => !t.archived).length === 0

  if (!hydrated) return <LoadingRows rows={6} />

  if (empty) {
    return (
      <div className="space-y-4">
        <Header onFocus={() => setFocus(true)} onInsights={() => navigate('dashboard')} />
        <EmptyState
          icon="trendingUp"
          title="Analytics appear after you capture work"
          description="Add a task, complete it, or run a focus session. Charts here use only your real history."
          action={
            <button type="button" className="btn btn-primary w-full" onClick={() => navigate('today')}>
              Go to Today
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Header onFocus={() => setFocus(true, report.nextTaskId)} onInsights={() => navigate('dashboard')} />

      <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          icon={<ListChecks size={18} className="text-[var(--tf-accent-text)]" />}
          label="Total tasks"
          value={kpis.total}
          sub={`${kpis.open} open · ${kpis.completed} done`}
          onClick={() => navigate('all')}
        />
        <KpiCard
          icon={<CheckCircle2 size={18} className="text-green-500" />}
          label="Completed"
          value={kpis.completed}
          suffix={`${kpis.completionPct}%`}
          sub={`${kpis.completedToday} finished today`}
          onClick={() => navigate('completed')}
        />
        <KpiCard
          icon={<AlertTriangle size={18} className="text-red-500" />}
          label="Overdue"
          value={kpis.overdue}
          sub={kpis.dueToday ? `${kpis.dueToday} still due today` : 'Nothing due today'}
          onClick={() => navigate('overdue')}
        />
        <KpiCard
          icon={<Flame size={18} className="text-orange-500" />}
          label="Streak"
          value={kpis.streak}
          suffix={kpis.streak === 1 ? 'day' : 'days'}
          sub={stats.bestStreak ? `Best ${stats.bestStreak} days` : 'Complete a task to start'}
          onClick={() => navigate('completed')}
          accent
        />
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          icon={<Timer size={18} className="text-sky-500" />}
          label="Focus this week"
          value={Math.round(kpis.focusWeekMin)}
          suffix="m"
          sub={kpis.focusWeekMin === 0 ? 'Start a session to log time' : `${hoursLabel(kpis.focusWeekMin)} in the last 7 days`}
          onClick={() => setFocus(true, report.nextTaskId)}
        />
        <div className="card flex items-center gap-4 p-4">
          <ProgressRing value={stats.todayGoalPct} size={72} stroke={8}>
            <span className="text-[13px] font-bold tabular-nums text-[var(--tf-text)]">{stats.todayGoalPct}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Today</p>
            <p className="text-[15px] font-semibold text-[var(--tf-text)]">
              {kpis.completedToday} of {kpis.completedToday + kpis.dueToday}
            </p>
            <p className="text-[11.5px] text-[var(--tf-text-faint)]">Plan complete</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <ProgressRing value={report.week.pct} size={72} stroke={8} color="#2f9e6e">
            <span className="text-[13px] font-bold tabular-nums text-[var(--tf-text)]">{report.week.pct}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">This week</p>
            <p className="text-[15px] font-semibold text-[var(--tf-text)]">
              {report.week.done} of {report.week.planned || report.week.done}
            </p>
            <p className="text-[11.5px] text-[var(--tf-text-faint)]">Planned vs done</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-4">
          <ProgressRing value={kpis.completionPct} size={72} stroke={8} color="#f59e0b">
            <span className="text-[13px] font-bold tabular-nums text-[var(--tf-text)]">{kpis.completionPct}%</span>
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">All time</p>
            <p className="text-[15px] font-semibold text-[var(--tf-text)]">{kpis.completed} completed</p>
            <p className="text-[11.5px] text-[var(--tf-text-faint)]">of {kpis.total} visible tasks</p>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-5">
        <div className="min-w-0 space-y-4 xl:col-span-3">
          <WeeklyCompletionsChart data={weekly} />
          <CompletionTrendChart data={trend} />
        </div>
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <PriorityDonutChart data={priorities} />
          <NamedBarsChart title="By project" data={projectsSeries} empty="No project activity yet." />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <PlannedDoneChart data={planned} />
        <FocusMinutesChart data={focus} />
      </div>

      <ActivityHeatmap days={heat} weekStartMonday={weekStartMonday} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <NamedBarsChart title="By tag" data={tags} empty="Tag a few tasks to see categories." />
        <NamedBarsChart title="Goal progress" data={goalsRows} empty="Create a goal to track progress here." valueLabel="%" />
      </div>
    </div>
  )
}

function Header({ onFocus, onInsights }: { onFocus: () => void; onInsights: () => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">Analytics</p>
        <h2 className="display mt-1 text-[26px] font-semibold leading-tight tracking-tight text-[var(--tf-text)] sm:text-[30px]">
          Your real work, visualized
        </h2>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--tf-text-secondary)]">
          Completions, focus minutes, and streaks from this device — nothing invented.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 self-start sm:self-auto">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onInsights}>
          Insights <ArrowRight size={14} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={onFocus}>
          <Play size={13} /> Focus
        </button>
      </div>
    </div>
  )
}
