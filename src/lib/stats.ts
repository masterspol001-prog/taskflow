import type { Task } from '@/lib/types'
import { todayISO, toISODate, parseISODate } from '@/lib/dates'

export interface DayBucket {
  date: string
  count: number
  weekday: string
  isToday: boolean
}

export interface DashboardStats {
  total: number
  completedToday: number
  remainingToday: number
  overdueCount: number
  dueTodayCount: number
  upcomingCount: number
  importantOpen: number
  completionPct: number
  streak: number
  bestStreak: number
  productivityScore: number
  weekly: DayBucket[]
  todayBucket: DayBucket
  todayGoalPct: number
}

export function countCompletedOnDate(tasks: Task[], dateISO: string): number {
  return tasks.filter((t) => t.completed && t.completedAt && toISODate(new Date(t.completedAt)) === dateISO).length
}

/** Compute the number of consecutive days ending today with >=1 completed task. */
export function computeStreak(tasks: Task[]): number {
  const completedDays = new Set<string>()
  for (const t of tasks) {
    if (t.completed && t.completedAt) completedDays.add(toISODate(new Date(t.completedAt)))
  }
  if (completedDays.size === 0) return 0
  let streak = 0
  const cursor = parseISODate(todayISO())
  if (!cursor) return 0
  // Include today only if it has activity; otherwise start from yesterday.
  if (!completedDays.has(todayISO())) cursor.setDate(cursor.getDate() - 1)
  while (completedDays.has(toISODate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function computeBestStreak(tasks: Task[]): number {
  const days = new Set<string>()
  for (const t of tasks) {
    if (t.completed && t.completedAt) days.add(toISODate(new Date(t.completedAt)))
  }
  const sorted = [...days].sort()
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const d of sorted) {
    const cur = parseISODate(d)
    if (!cur) continue
    if (prev) {
      const diff = Math.round((cur.getTime() - prev.getTime()) / 86400000)
      run = diff === 1 ? run + 1 : 1
    } else {
      run = 1
    }
    best = Math.max(best, run)
    prev = cur
  }
  return best
}

export function weeklyBuckets(tasks: Task[], days = 7): DayBucket[] {
  const out: DayBucket[] = []
  const today = parseISODate(todayISO())
  if (!today) return out
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const iso = toISODate(d)
    out.push({
      date: iso,
      count: countCompletedOnDate(tasks, iso),
      weekday: d.toLocaleDateString(undefined, { weekday: 'short' }),
      isToday: iso === todayISO(),
    })
  }
  return out
}

/** A 0-100 "productivity score" for today, weighting completed tasks by priority
 *  against the number that were due today plus overdue items. */
export interface ExecutionScore {
  score: number
  label: 'Excellent' | 'Strong' | 'Steady' | 'Needs work'
  focusPct: number
  completionPct: number
  priorityPct: number
}

export function computeExecutionScore(tasks: Task[], now = new Date()): ExecutionScore {
  const visible = tasks.filter((t) => !t.archived)
  const today = todayISO()
  const dueToday = visible.filter((t) => t.dueDate === today)
  const dueDone = dueToday.filter((t) => t.completed)
  const overdue = visible.filter((t) => isTaskOverdue(t, now))
  const expected = dueToday.length + overdue.length
  const completionPct = expected ? Math.round((dueDone.length / expected) * 100) : dueDone.length > 0 ? 100 : 0

  const plannedMin = dueToday.reduce((n, t) => n + (typeof t.estimate === 'number' && t.estimate > 0 ? t.estimate : 30), 0)
  const loggedMin = visible.reduce((n, t) => {
    const hist = t.actualMinutes ?? []
    if (!hist.length) return n
    if (t.completed && t.completedAt && toISODate(new Date(t.completedAt)) === today) {
      return n + hist[hist.length - 1]
    }
    if (!t.completed && t.dueDate === today) return n + hist.reduce((a, b) => a + b, 0)
    return n
  }, 0)
  const focusPct = plannedMin ? Math.min(100, Math.round((loggedMin / plannedMin) * 100)) : loggedMin > 0 ? 100 : 0

  const high = visible.filter((t) => !t.archived && (t.priority >= 3 || t.important) && (t.dueDate === today || isTaskOverdue(t, now) || (t.completed && t.completedAt && toISODate(new Date(t.completedAt)) === today)))
  const highDone = high.filter((t) => t.completed).length
  const priorityPct = high.length ? Math.round((highDone / high.length) * 100) : completionPct

  const score = Math.round(completionPct * 0.45 + focusPct * 0.25 + priorityPct * 0.3)
  const label: ExecutionScore['label'] = score >= 82 ? 'Excellent' : score >= 65 ? 'Strong' : score >= 45 ? 'Steady' : 'Needs work'
  return { score, label, focusPct, completionPct, priorityPct }
}

export function computeProductivityScore(tasks: Task[], completedToday: number, dueToday: number, overdue: number): number {
  const weight = (p: Task['priority']) => [1, 2, 3, 4][p - 1] ?? 2
  let doneWeight = 0
  for (const t of tasks) {
    if (t.completed && t.completedAt && toISODate(new Date(t.completedAt)) === todayISO()) {
      doneWeight += weight(t.priority)
    }
  }
  const expected = Math.max(dueToday + overdue, 1)
  return Math.round(Math.min(1, doneWeight / expected) * 100)
}

export function computeDashboardStats(tasks: Task[]): DashboardStats {
  const now = new Date()
  const visible = tasks.filter((t) => !t.archived)
  const open = visible.filter((t) => !t.completed)
  const completedToday = countCompletedOnDate(visible, todayISO())
  const todayDue = open.filter((t) => t.dueDate === todayISO())
  const overdue = open.filter((t) => t.dueDate && isBeforeToday(t.dueDate, now))
  const upcoming = open.filter((t) => t.dueDate && t.dueDate > todayISO())
  const completedTotal = visible.filter((t) => t.completed).length
  const completionPct = visible.length ? Math.round((completedTotal / visible.length) * 100) : 0
  const weekly = weeklyBuckets(visible, 7)
  const todayBucket = weekly.find((b) => b.date === todayISO()) ?? { date: todayISO(), count: 0, weekday: '', isToday: true }

  return {
    total: open.length,
    completedToday,
    remainingToday: todayDue.length,
    overdueCount: overdue.length,
    dueTodayCount: todayDue.length,
    upcomingCount: upcoming.length,
    importantOpen: open.filter((t) => t.important).length,
    completionPct,
    streak: computeStreak(visible),
    bestStreak: computeBestStreak(visible),
    productivityScore: computeProductivityScore(visible, completedToday, todayDue.length, overdue.length),
    weekly,
    todayBucket,
    todayGoalPct: todayDue.length ? Math.round((completedToday / (todayDue.length + completedToday)) * 100) : (completedToday > 0 ? 100 : 0),
  }
}

function isBeforeToday(iso: string, now: Date): boolean {
  const d = parseISODate(iso)
  if (!d) return false
  d.setHours(23, 59, 59, 999)
  return d.getTime() < now.getTime()
}

export function priorityBreakdown(tasks: Task[]): Record<number, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const t of tasks) {
    if (!t.completed && !t.archived && (counts[t.priority] !== undefined)) counts[t.priority]++
  }
  return counts
}

/** Project completion percentage including archived-hidden active tasks. */
export function projectProgress(projectTasks: Task[]): number {
  if (!projectTasks.length) return 0
  const done = projectTasks.filter((t) => t.completed && !t.archived).length
  return Math.round((done / projectTasks.length) * 100)
}

export function isTaskOverdue(t: Task, now = new Date()): boolean {
  if (!t.dueDate || t.completed || t.archived) return false
  const d = parseISODate(t.dueDate)
  if (!d) return false
  d.setHours(23, 59, 59, 999)
  return d.getTime() < now.getTime()
}

export { startOfToday } from '@/lib/dates'
