import type { EnergyLevel, FocusSession, Goal, Task } from './types'
import { addDaysISO, toISODate } from './dates'
import { isTaskOverdue } from './stats'
import { durationInsights } from './agent'
import { completedOn, focusMinutesOn, focusMinutesOnTasks, plannedToday } from './progress'
import { planToday } from './rank'

export type SuggestionKind =
  | 'protect'
  | 'postpone'
  | 'overdue'
  | 'burnout'
  | 'estimate'
  | 'focus'
  | 'capture'
  | 'celebrate'

export interface InsightSuggestion {
  id: string
  kind: SuggestionKind
  title: string
  detail: string
  actionLabel?: string
  view?: string
  taskId?: string
}

export interface EstimateRow {
  taskId: string
  title: string
  estimate: number | null
  actualAvg: number | null
  bias: 'over' | 'under' | 'on' | 'unknown'
}

export interface InsightsReport {
  today: { planned: number; done: number; remaining: number; pct: number }
  week: { planned: number; done: number; pct: number }
  focusTodayMin: number
  focusWeekMin: number
  overdue: { count: number; postponed: number; oldestTitle: string | null }
  weekdayOverdue: { weekday: string; count: number }[]
  estimates: { under: number; over: number; on: number; rows: EstimateRow[] }
  burnout: { level: 'ok' | 'watch' | 'high'; message: string | null }
  trend: { date: string; label: string; done: number; planned: number }[]
  focusDays: { date: string; label: string; minutes: number }[]
  suggestions: InsightSuggestion[]
  nextTaskId: string | null
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return '—'
  return WEEKDAYS[new Date(y, m - 1, d, 12).getDay()] ?? '—'
}

function shortLabel(iso: string, today: string): string {
  if (iso === today) return 'Today'
  return weekdayOf(iso)
}

export function hoursLabel(minutes: number): string {
  if (minutes <= 0) return '0h'
  if (minutes < 60) return `${minutes}m`
  const h = minutes / 60
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1).replace(/\.0$/, '')}h`
}

function buildSuggestions(input: {
  planned: number
  remaining: number
  doneToday: number
  overdue: Task[]
  postponed: Task[]
  overCapacity: boolean
  dayPlanMinutes: number
  capacity: number
  focusTodayMin: number
  estimates: InsightsReport['estimates']
  burnoutLevel: InsightsReport['burnout']['level']
  oldest: Task | null
}): InsightSuggestion[] {
  const out: InsightSuggestion[] = []

  if (input.burnoutLevel === 'high') {
    out.push({
      id: 'burnout',
      kind: 'burnout',
      title: 'Protect the rest of today',
      detail: 'Too much is open. Keep one must-do, postpone the rest, and stop adding.',
      actionLabel: 'Open Today',
      view: 'today',
    })
  } else if (input.overCapacity) {
    const extra = Math.max(15, input.dayPlanMinutes - input.capacity)
    out.push({
      id: 'protect',
      kind: 'protect',
      title: 'Today is over capacity',
      detail: `About ${extra} extra minutes planned. Postpone one task so the rest can finish.`,
      actionLabel: 'Review Today',
      view: 'today',
    })
  }

  if (input.overdue.length > 0) {
    const title = input.oldest?.title ?? 'an overdue task'
    out.push({
      id: 'overdue',
      kind: 'overdue',
      title: `${input.overdue.length} overdue ${input.overdue.length === 1 ? 'task needs' : 'tasks need'} a decision`,
      detail: input.oldest
        ? `Start with "${title}", or recover a smaller catch-up plan. Nothing is moved until you apply it.`
        : 'Recover a smaller catch-up plan so Today stays trustworthy.',
      actionLabel: 'Recover overdue',
      view: 'overdue',
      taskId: input.oldest?.id,
    })
  }

  if (input.postponed.length >= 3) {
    out.push({
      id: 'postpone',
      kind: 'postpone',
      title: 'Some tasks keep slipping',
      detail: `${input.postponed.length} open tasks have been postponed. Break one down, or drop it.`,
      actionLabel: 'Open Today',
      view: 'today',
    })
  }

  if (input.estimates.under >= 2) {
    out.push({
      id: 'estimate',
      kind: 'estimate',
      title: 'Estimates are running short',
      detail: `${input.estimates.under} tasks took longer than planned. Give deep work more room tomorrow.`,
      actionLabel: 'See estimates',
      view: 'estimates',
    })
  }

  if (input.planned >= 2 && input.focusTodayMin === 0 && input.remaining > 0) {
    out.push({
      id: 'focus',
      kind: 'focus',
      title: 'Start one focus block',
      detail: 'A 25-minute session on the next task beats rearranging the list.',
      actionLabel: 'Start focus',
      view: 'today',
    })
  }

  if (input.planned === 0 && input.doneToday === 0) {
    out.push({
      id: 'capture',
      kind: 'capture',
      title: 'Capture one thing for today',
      detail: 'Today is empty. Add a single meaningful task, or enjoy the clear day.',
      actionLabel: 'Go to Today',
      view: 'today',
    })
  }

  if (input.planned > 0 && input.remaining === 0 && input.overdue.length === 0) {
    out.push({
      id: 'celebrate',
      kind: 'celebrate',
      title: "Today's plan is done",
      detail: 'Protect the finish. Peek at upcoming only if you want to get ahead.',
      actionLabel: 'See upcoming',
      view: 'upcoming',
    })
  }

  return out.slice(0, 4)
}

export function computeInsights(
  tasks: Task[],
  goals: Goal[],
  sessions: FocusSession[] = [],
  energy: EnergyLevel = 'medium',
  now = new Date()
): InsightsReport {
  const today = toISODate(now)
  const visible = tasks.filter((t) => !t.archived)
  const planned = plannedToday(visible, today)
  const doneToday = planned.filter((t) => t.completed).length
  const remaining = planned.length - doneToday
  const extraDone = completedOn(visible, today).length
  const todayPct = planned.length ? Math.round((doneToday / planned.length) * 100) : extraDone > 0 ? 100 : 0

  let weekPlanned = 0
  let weekDone = 0
  const trend: InsightsReport['trend'] = []
  const focusDays: InsightsReport['focusDays'] = []
  let focusWeekMin = 0

  for (let i = 6; i >= 0; i--) {
    const date = addDaysISO(today, -i)
    const dayPlanned = plannedToday(visible, date)
    const dayDone = dayPlanned.filter((t) => t.completed).length
    const completed = completedOn(visible, date).length
    weekPlanned += dayPlanned.length
    weekDone += dayPlanned.length ? dayDone : completed
    const minutes = focusMinutesOn(sessions, date) + focusMinutesOnTasks(visible, date)
    focusWeekMin += minutes
    trend.push({
      date,
      label: shortLabel(date, today),
      done: dayPlanned.length ? dayDone : completed,
      planned: dayPlanned.length,
    })
    focusDays.push({ date, label: shortLabel(date, today), minutes })
  }

  const weekPct = weekPlanned ? Math.round((weekDone / weekPlanned) * 100) : weekDone > 0 ? 100 : 0
  const focusTodayMin = focusMinutesOn(sessions, today) + focusMinutesOnTasks(visible, today)
  const overdueTasks = visible.filter((t) => !t.completed && isTaskOverdue(t, now))
  const postponed = visible.filter((t) => !t.completed && (t.postponeCount ?? 0) > 0)
  const oldest = [...overdueTasks].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0] ?? null

  const weekdayMap = new Map<string, number>()
  for (const t of overdueTasks) {
    if (!t.dueDate) continue
    const w = weekdayOf(t.dueDate)
    weekdayMap.set(w, (weekdayMap.get(w) ?? 0) + 1)
  }
  const weekdayOverdue = WEEKDAYS.map((weekday) => ({ weekday, count: weekdayMap.get(weekday) ?? 0 })).filter((r) => r.count > 0)

  const duration = durationInsights(visible).filter((i) => i.bias !== 'unknown')
  const estimates = {
    under: duration.filter((i) => i.bias === 'under').length,
    over: duration.filter((i) => i.bias === 'over').length,
    on: duration.filter((i) => i.bias === 'on').length,
    rows: duration.slice(0, 6).map((i) => ({
      taskId: i.taskId,
      title: i.title,
      estimate: i.estimate,
      actualAvg: i.actualAvg,
      bias: i.bias,
    })),
  }

  const dayPlan = planToday(tasks, goals, energy, today)
  const overCapacity = dayPlan.totalMinutes > dayPlan.capacityMinutes
  const heavyFocusDays = focusDays.filter((d) => d.minutes >= 240).length
  const slipDays = trend.filter((d) => d.planned >= 3 && d.done / d.planned < 0.4).length

  let burnoutLevel: InsightsReport['burnout']['level'] = 'ok'
  let burnoutMessage: string | null = null
  if (overdueTasks.length >= 8 || heavyFocusDays >= 4 || (overCapacity && overdueTasks.length >= 4)) {
    burnoutLevel = 'high'
    burnoutMessage = 'Load is high and slipping. Protect a shorter day — finish fewer things well.'
  } else if (overCapacity || overdueTasks.length >= 4 || slipDays >= 3 || postponed.length >= 5) {
    burnoutLevel = 'watch'
    burnoutMessage = 'The plan is outrunning the day. Postpone or drop something so today can finish.'
  }

  const suggestions = buildSuggestions({
    planned: planned.length,
    remaining,
    doneToday,
    overdue: overdueTasks,
    postponed,
    overCapacity,
    dayPlanMinutes: dayPlan.totalMinutes,
    capacity: dayPlan.capacityMinutes,
    focusTodayMin,
    estimates,
    burnoutLevel,
    oldest,
  })

  return {
    today: { planned: planned.length, done: doneToday, remaining, pct: todayPct },
    week: { planned: weekPlanned, done: weekDone, pct: weekPct },
    focusTodayMin,
    focusWeekMin,
    overdue: { count: overdueTasks.length, postponed: postponed.length, oldestTitle: oldest?.title ?? null },
    weekdayOverdue,
    estimates,
    burnout: { level: burnoutLevel, message: burnoutMessage },
    trend,
    focusDays,
    suggestions,
    nextTaskId: dayPlan.must[0]?.task.id ?? dayPlan.should[0]?.task.id ?? dayPlan.habits[0]?.task.id ?? null,
  }
}
