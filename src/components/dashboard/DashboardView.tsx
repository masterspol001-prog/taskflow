import { useMemo } from 'react'
import { Flame, Trophy, Zap, CheckCircle2, AlertTriangle, ArrowRight, CalendarClock } from 'lucide-react'
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

export function DashboardView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const navigate = useUIStore((s) => s.navigate)
  const openTask = useUIStore((s) => s.openTask)
  const toggleComplete = useStore((s) => s.toggleComplete)

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

  const weekMax = Math.max(1, ...stats.weekly.map((d) => d.count))
  const goalPct = Math.min(100, stats.completedToday > 0 ? Math.round((stats.completedToday / Math.max(stats.remainingToday + stats.completedToday, 1)) * 100) : 0)

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">
            {greeting()} · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="display mt-1 text-[26px] font-semibold leading-tight tracking-tight text-[var(--tf-text)] sm:text-[30px]">
            Your rhythm
          </p>
          <p className="mt-1.5 text-sm text-[var(--tf-text-secondary)]">
            {stats.overdueCount > 0
              ? `You have ${stats.overdueCount} overdue ${plural(stats.overdueCount, 'task')} waiting.`
              : stats.remainingToday > 0
              ? `${stats.remainingToday} ${plural(stats.remainingToday, 'task')} left today — you're ${stats.completedToday > 0 ? 'making' : ''} great progress.`
              : 'Nothing due today. A great day to plan ahead.'}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm self-start sm:self-auto" onClick={() => navigate('upcoming')}>
          Plan upcoming <ArrowRight size={14} />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          label="Productivity score"
          value={stats.productivityScore}
          suffix="/100"
          sub={stats.productivityScore >= 70 ? 'Outstanding rhythm' : 'Keep chipping away'}
          accent
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
                  : 'No completions yet. Start with the first task below to light up your streak.'}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Metric label="Overdue" value={stats.overdueCount} tone="red" onClick={() => navigate('overdue')} />
                <Metric label="Due today" value={stats.remainingToday} tone="brand" onClick={() => navigate('today')} />
                <Metric label="Upcoming" value={stats.upcomingCount} tone="muted" onClick={() => navigate('upcoming')} />
                <Metric label="Important" value={stats.importantOpen} tone="amber" onClick={() => navigate('important')} />
              </div>
            </div>
          </div>

          <WeekChart buckets={stats.weekly} max={weekMax} />
        </div>

        {/* Right column */}
        <div className="space-y-4 lg:col-span-2">
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

function WeekChart({ buckets, max }: { buckets: { date: string; count: number; weekday: string; isToday: boolean }[]; max: number }) {
  const hasAny = buckets.some((b) => b.count > 0)
  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock size={15} className="text-[var(--tf-text-muted)]" />
        <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Last 7 days</h3>
        <span className="ml-auto text-[11px] text-[var(--tf-text-faint)]">Tasks completed</span>
      </div>
      {!hasAny ? (
        <p className="py-4 text-center text-[13px] text-[var(--tf-text-faint)]">No activity yet this week — complete a task to see your rhythm.</p>
      ) : (
        <div className="flex h-36 items-end gap-2 sm:gap-3">
          {buckets.map((b) => {
            const h = max ? Math.max(b.count > 0 ? 14 : 4, Math.round((b.count / max) * 100)) : 4
            return (
              <div key={b.date} className="group flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold tabular-nums text-[var(--tf-text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                  {b.count}
                </span>
                <div className="flex w-full flex-1 items-end rounded-lg">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${
                      b.isToday
                        ? 'bg-gradient-to-t from-[var(--tf-accent-deep)] to-[var(--tf-accent-light)] glow-sm'
                        : b.count > 0
                        ? 'bg-[var(--tf-accent-soft-strong)] group-hover:bg-[var(--tf-accent-soft-strong)]'
                        : 'bg-[var(--tf-surface-3)]'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className={`text-[11px] font-medium ${b.isToday ? 'font-bold text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text-muted)]'}`}>{b.weekday}</span>
              </div>
            )
          })}
        </div>
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
