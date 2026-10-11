import type { EnergyLevel, Goal, Task } from '@/lib/types'
import { todayISO } from '@/lib/dates'
import { learnedDuration } from '@/lib/agent'
import { computeGoalHealth } from '@/lib/goals'

export type RankBucket = 'must' | 'should' | 'habit' | 'waiting'

export interface RankedTask {
  task: Task
  score: number
  why: string[]
  bucket: RankBucket
  minutes: number
  goalTitles: string[]
}

export interface TodayPlan {
  must: RankedTask[]
  should: RankedTask[]
  habits: RankedTask[]
  waiting: RankedTask[]
  totalMinutes: number
  goalsImpacted: string[]
  capacityMinutes: number
}

export const DAY_CAPACITY: Record<EnergyLevel, number> = {
  high: 360,
  medium: 270,
  low: 180,
}

export function goalsForTask(task: Task, goals: Goal[]): Goal[] {
  return goals.filter(
    (g) =>
      g.status !== 'archived' &&
      g.status !== 'completed' &&
      ((g.taskIds ?? []).includes(task.id) || (!!task.projectId && g.projectIds.includes(task.projectId)))
  )
}

export function rankTask(
  task: Task,
  goals: Goal[],
  energy: EnergyLevel,
  nowISO = todayISO(),
  allTasks: Task[] = []
): RankedTask {
  const why: string[] = []
  const pool = allTasks.length ? allTasks : [task]

  const importance = task.important ? 1.35 : 1
  const urgency = [1, 1.05, 1.15, 1.3, 1.5][task.priority] ?? 1.15
  let deadline = 1
  let effort = 1
  let momentum = 1 + Math.min(0.25, (task.postponeCount ?? 0) * 0.06)

  let score = 8
  const prioW = [0, 4, 12, 25, 40][task.priority] ?? 12
  score += prioW
  if (task.priority >= 4) why.push('urgent')
  else if (task.priority >= 3) why.push('high priority')

  if (task.important) {
    score += 18
    why.push('important')
  }

  if (task.dueDate) {
    if (task.dueDate < nowISO) {
      score += 30
      deadline = 1.45
      why.push('overdue')
    } else if (task.dueDate === nowISO) {
      score += task.dueTime ? 22 : 16
      deadline = task.dueTime ? 1.28 : 1.18
      why.push(task.dueTime ? 'timed today' : 'due today')
    } else {
      const days = Math.max(0, (Date.parse(task.dueDate + 'T12:00:00') - Date.parse(nowISO + 'T12:00:00')) / 86400000)
      score += Math.max(0, 10 - days * 1.5)
      if (days <= 2) {
        deadline = 1.12
        why.push('deadline soon')
      } else {
        deadline = Math.max(0.85, 1 - days * 0.03)
      }
    }
  }

  const linked = goalsForTask(task, goals)
  let goalImpact = 1
  if (linked.length) {
    let impact = 12
    for (const g of linked) {
      const h = computeGoalHealth(g, pool)
      if (h === 'at_risk') {
        impact = Math.max(impact, 32)
        goalImpact = Math.max(goalImpact, 1.45)
      } else if (h === 'attention') {
        impact = Math.max(impact, 20)
        goalImpact = Math.max(goalImpact, 1.22)
      } else {
        goalImpact = Math.max(goalImpact, 1.12)
      }
    }
    score += impact
    why.push(impact >= 32 ? 'moves an at-risk goal' : impact >= 20 ? 'moves a goal that needs attention' : 'moves a goal')
  }

  const minutes = learnedDuration(task)
  if (energy === 'low' && minutes <= 25) {
    score += 6
    effort = 1.12
    why.push('fits low energy')
  } else if (energy === 'high' && minutes >= 45) {
    score += 6
    effort = 1.12
    why.push('deep-work sized')
  } else if (energy === 'medium' && minutes >= 15 && minutes <= 45) {
    score += 3
    effort = 1.06
  } else if (energy === 'low' && minutes > 60) {
    effort = 0.82
  }

  score += Math.min(8, (task.postponeCount ?? 0) * 2)
  if ((task.postponeCount ?? 0) > 0) why.push(`postponed ${task.postponeCount}x`)

  score = Math.round(score * importance * urgency * deadline * goalImpact * effort * momentum)

  let bucket: RankBucket = 'should'
  const waiting = isWaiting(task)
  if (waiting) {
    bucket = 'waiting'
    why.push('waiting')
  } else if (task.recurrence?.freq === 'daily') bucket = 'habit'
  else if (task.dueDate && task.dueDate < nowISO) bucket = 'must'
  else if (task.important || task.priority >= 4) bucket = 'must'

  if (!why.length) why.push('open work')

  return {
    task,
    score,
    why: why.slice(0, 3),
    bucket,
    minutes,
    goalTitles: linked.map((g) => g.title),
  }
}

export function isWaiting(task: Task): boolean {
  return (task.dependsOn ?? []).length > 0 || (task.tags ?? []).some((tag) => ['waiting', 'blocked'].includes(tag.toLowerCase()))
}

function fillBucket(rows: RankedTask[], limit: number, cap: number, used: { n: number }, keepFirst = false): RankedTask[] {
  const out: RankedTask[] = []
  for (const r of rows) {
    if (out.length >= limit) break
    const would = used.n + r.minutes
    if (would > cap && out.length > 0) continue
    if (would > cap && !keepFirst) continue
    out.push(r)
    used.n += r.minutes
  }
  return out
}

export function planToday(
  tasks: Task[],
  goals: Goal[],
  energy: EnergyLevel = 'medium',
  nowISO = todayISO()
): TodayPlan {
  const open = tasks.filter((t) => !t.archived && !t.completed)
  const ranked = open
    .map((t) => rankTask(t, goals, energy, nowISO, open))
    .sort((a, b) => b.score - a.score)

  const waiting = ranked.filter((r) => r.bucket === 'waiting' || isWaiting(r.task))
  const waitingIds = new Set(waiting.map((r) => r.task.id))
  const habits = ranked.filter((r) => !waitingIds.has(r.task.id) && r.task.recurrence?.freq === 'daily')
  const habitIds = new Set(habits.map((r) => r.task.id))

  const capacityMinutes = DAY_CAPACITY[energy]
  const used = { n: 0 }

  const actionable = ranked.filter((r) => !waitingIds.has(r.task.id) && !habitIds.has(r.task.id))
  const mustSeed = actionable.filter((r) => r.bucket === 'must' || r.score >= 40)
  const must = fillBucket(mustSeed.length ? mustSeed : actionable, 3, capacityMinutes, used, true)
  const mustIds = new Set(must.map((r) => r.task.id))
  const should = fillBucket(
    actionable.filter((r) => !mustIds.has(r.task.id)),
    5,
    capacityMinutes,
    used
  )
  const shownHabits = fillBucket(habits, 4, capacityMinutes, used)

  const shown = [...must, ...should, ...shownHabits]
  const totalMinutes = shown.reduce((n, r) => n + r.minutes, 0)
  const goalsImpacted = [...new Set(shown.flatMap((r) => r.goalTitles))]

  return {
    must,
    should,
    habits: shownHabits,
    waiting: waiting.slice(0, 6),
    totalMinutes,
    goalsImpacted,
    capacityMinutes,
  }
}
