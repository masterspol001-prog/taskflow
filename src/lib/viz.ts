import type { FocusSession, Goal, Project, Task } from '@/lib/types'
import { PRIORITIES } from '@/lib/constants'
import { addDaysISO, parseISODate, todayISO } from '@/lib/dates'
import { goalProgress } from '@/lib/goals'
import { activityCalendar, focusMinutesOn, focusMinutesOnTasks } from '@/lib/progress'
import { computeStreak, countCompletedOnDate, isTaskOverdue, weeklyBuckets } from '@/lib/stats'

export interface VizKpis {
  total: number
  open: number
  completed: number
  overdue: number
  dueToday: number
  completedToday: number
  completionPct: number
  streak: number
  focusWeekMin: number
  focusTodayMin: number
}

export interface SeriesPoint {
  date: string
  label: string
  value: number
  extra?: number
  isToday?: boolean
}

export interface NamedMetric {
  key: string
  label: string
  value: number
  color?: string
  done?: number
  pct?: number
}

export interface HeatDay {
  date: string
  count: number
  intensity: 0 | 1 | 2 | 3 | 4
  empty?: boolean
}

export function visibleTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.archived)
}

export function computeVizKpis(tasks: Task[], sessions: FocusSession[] = []): VizKpis {
  const visible = visibleTasks(tasks)
  const open = visible.filter((t) => !t.completed)
  const completed = visible.filter((t) => t.completed)
  const today = todayISO()
  const overdue = open.filter((t) => isTaskOverdue(t))
  const dueToday = open.filter((t) => t.dueDate === today)
  const completedToday = countCompletedOnDate(visible, today)
  let focusWeekMin = 0
  let focusTodayMin = 0
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(today, -i)
    const minutes = focusMinutesOn(sessions, date) + focusMinutesOnTasks(visible, date)
    focusWeekMin += minutes
    if (i === 0) focusTodayMin = minutes
  }
  return {
    total: visible.length,
    open: open.length,
    completed: completed.length,
    overdue: overdue.length,
    dueToday: dueToday.length,
    completedToday,
    completionPct: visible.length ? Math.round((completed.length / visible.length) * 100) : 0,
    streak: computeStreak(visible),
    focusWeekMin,
    focusTodayMin,
  }
}

export function weeklyCompletionSeries(tasks: Task[]): SeriesPoint[] {
  return weeklyBuckets(visibleTasks(tasks), 7).map((b) => ({
    date: b.date,
    label: b.weekday,
    value: b.count,
    isToday: b.isToday,
  }))
}

export function completionSeries(tasks: Task[], days = 14): SeriesPoint[] {
  const visible = visibleTasks(tasks)
  const today = todayISO()
  const out: SeriesPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysISO(today, -i)
    const d = parseISODate(date)
    out.push({
      date,
      label: i === 0 ? 'Today' : (d?.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) ?? date),
      value: countCompletedOnDate(visible, date),
    })
  }
  return out
}

export function plannedDoneSeries(
  trend: { date: string; label: string; done: number; planned: number }[]
): SeriesPoint[] {
  return trend.map((d) => ({
    date: d.date,
    label: d.label,
    value: d.done,
    extra: d.planned,
  }))
}

export function focusMinuteSeries(
  tasks: Task[],
  sessions: FocusSession[],
  days = 7
): SeriesPoint[] {
  const visible = visibleTasks(tasks)
  const today = todayISO()
  const out: SeriesPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysISO(today, -i)
    const d = parseISODate(date)
    out.push({
      date,
      label: i === 0 ? 'Today' : (d?.toLocaleDateString(undefined, { weekday: 'short' }) ?? date),
      value: focusMinutesOn(sessions, date) + focusMinutesOnTasks(visible, date),
    })
  }
  return out
}

export function prioritySeries(tasks: Task[]): NamedMetric[] {
  const open = visibleTasks(tasks).filter((t) => !t.completed)
  return ([4, 3, 2, 1] as const).map((p) => ({
    key: String(p),
    label: PRIORITIES[p].label,
    value: open.filter((t) => t.priority === p).length,
    color: PRIORITIES[p].color,
  }))
}

export function completionSplit(tasks: Task[]): NamedMetric[] {
  const kpis = computeVizKpis(tasks)
  return [
    { key: 'completed', label: 'Completed', value: kpis.completed, color: '#2f9e6e' },
    { key: 'open', label: 'Open', value: kpis.open, color: '#6c5ce7' },
  ]
}

export function projectSeries(tasks: Task[], projects: Project[]): NamedMetric[] {
  const visible = visibleTasks(tasks)
  const rows: NamedMetric[] = projects
    .filter((p) => !p.archived)
    .map((p) => {
      const pt = visible.filter((t) => t.projectId === p.id)
      const done = pt.filter((t) => t.completed).length
      return {
        key: p.id,
        label: p.name,
        value: pt.length,
        done,
        color: p.color,
        pct: pt.length ? Math.round((done / pt.length) * 100) : 0,
      }
    })
    .filter((r) => (r.value ?? 0) > 0)
  const inbox = visible.filter((t) => !t.projectId)
  if (inbox.length) {
    const done = inbox.filter((t) => t.completed).length
    rows.push({
      key: 'inbox',
      label: 'Inbox',
      value: inbox.length,
      done,
      color: '#8a8ea3',
      pct: Math.round((done / inbox.length) * 100),
    })
  }
  return rows.sort((a, b) => b.value - a.value)
}

export function tagSeries(tasks: Task[], limit = 8): NamedMetric[] {
  const counts = new Map<string, number>()
  for (const t of visibleTasks(tasks)) {
    for (const tag of t.tags ?? []) {
      const key = tag.trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ key: label, label, value }))
}

export function goalProgressRows(goals: Goal[], tasks: Task[]): NamedMetric[] {
  return goals
    .filter((g) => g.status !== 'archived' && g.status !== 'paused')
    .map((g) => {
      const p = goalProgress(g, tasks)
      return {
        key: g.id,
        label: g.title,
        value: p.pct,
        done: p.done,
        pct: p.pct,
        color: g.color,
      }
    })
    .sort((a, b) => b.value - a.value)
}

export function heatmapDays(
  tasks: Task[],
  sessions: FocusSession[] = [],
  days = 84,
  now = new Date()
): HeatDay[] {
  return activityCalendar(visibleTasks(tasks), sessions, days, now)
}

export function padHeatmap(days: HeatDay[], weekStartMonday = true): HeatDay[] {
  if (!days.length) return days
  const first = parseISODate(days[0].date)
  if (!first) return days
  const dow = first.getDay()
  const offset = weekStartMonday ? (dow === 0 ? 6 : dow - 1) : dow
  const pads: HeatDay[] = Array.from({ length: offset }, (_, i) => ({
    date: `pad-${i}`,
    count: 0,
    intensity: 0,
    empty: true,
  }))
  return [...pads, ...days]
}

export function hasValues(items: { value: number }[]): boolean {
  return items.some((i) => i.value > 0)
}
