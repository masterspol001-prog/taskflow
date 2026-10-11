import type {
  Goal,
  GoalCategory,
  GoalHorizon,
  GoalMilestone,
  GoalProgressType,
  GoalStatus,
  Project,
  Task,
} from '@/lib/types'
import { addDaysISO, diffInDays, toISODate, todayISO } from '@/lib/dates'

// ---------------------------------------------------------------------------
// Horizons — the visual heartbeat of the planning system.
// Think long-term → plan realistically → act today.
// ---------------------------------------------------------------------------

export interface HorizonMeta {
  id: GoalHorizon
  label: string
  short: string
  tagline: string
  icon: string
  days: number
}

export const HORIZONS: HorizonMeta[] = [
  { id: '5y', label: '5 Years', short: '5Y', tagline: 'Your vision', icon: 'sparkles', days: 1825 },
  { id: '3y', label: '3 Years', short: '3Y', tagline: 'Your direction', icon: 'compass', days: 1095 },
  { id: '1y', label: '1 Year', short: '1Y', tagline: 'Your year', icon: 'flag', days: 365 },
  { id: '6m', label: '6 Months', short: '6M', tagline: 'Create measurable change', icon: 'target', days: 183 },
  { id: 'month', label: 'This Month', short: 'Month', tagline: 'Build momentum', icon: 'calendarDays', days: 30 },
  { id: 'week', label: 'This Week', short: 'Week', tagline: 'Make meaningful progress', icon: 'calendarClock', days: 7 },
  { id: 'today', label: 'Today', short: 'Today', tagline: 'Win today', icon: 'sun', days: 1 },
]

/** Descending breadth — used for ordering (vision first) and nesting. */
export const HORIZON_ORDER: GoalHorizon[] = HORIZONS.map((h) => h.id)

/** Ascending urgency — used for "what to do next". */
export const HORIZON_URGENCY: GoalHorizon[] = [...HORIZON_ORDER].reverse()

export function horizonMeta(id: GoalHorizon | null | undefined): HorizonMeta {
  return HORIZONS.find((h) => h.id === id) ?? HORIZONS.find((h) => h.id === 'month')!
}

export function horizonIndex(id: GoalHorizon | null | undefined): number {
  const i = HORIZON_ORDER.indexOf(id ?? 'month')
  return i < 0 ? HORIZON_ORDER.indexOf('month') : i
}

/** The natural child horizon, e.g. 1y → 6m → month → week → today. */
export function childHorizon(id: GoalHorizon): GoalHorizon | null {
  const i = HORIZON_ORDER.indexOf(id)
  return i >= 0 && i < HORIZON_ORDER.length - 1 ? HORIZON_ORDER[i + 1] : null
}

export function defaultTargetDate(horizon: GoalHorizon, from = todayISO()): string {
  return addDaysISO(from, horizonMeta(horizon).days)
}

export const GOAL_CATEGORIES: { id: GoalCategory; label: string; icon: string; color: string }[] = [
  { id: 'health', label: 'Health', icon: 'heart', color: '#e5484d' },
  { id: 'finance', label: 'Finance', icon: 'dollarSign', color: '#2f9e6e' },
  { id: 'career', label: 'Career', icon: 'briefcase', color: '#3b82f6' },
  { id: 'learning', label: 'Learning', icon: 'graduationCap', color: '#8e5cf7' },
  { id: 'relationships', label: 'Relationships', icon: 'user', color: '#e7549e' },
  { id: 'personal', label: 'Personal', icon: 'sparkles', color: '#f97316' },
]

export function categoryMeta(id: GoalCategory | null | undefined) {
  return GOAL_CATEGORIES.find((c) => c.id === id) ?? null
}

export const PROGRESS_TYPES: { id: GoalProgressType; label: string; hint: string }[] = [
  { id: 'task', label: 'Task-based', hint: 'Progress follows linked tasks' },
  { id: 'milestone', label: 'Milestone', hint: 'Progress follows milestones checked' },
  { id: 'percentage', label: 'Percentage', hint: 'Track a % you update' },
  { id: 'numeric', label: 'Numeric', hint: 'Track a number toward a target' },
  { id: 'habit', label: 'Habit', hint: 'Track a day streak' },
]

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface GoalProgress {
  pct: number
  done: number
  total: number
  label: string
  source: GoalProgressType
}

export function goalLinkedTasks(goal: Goal, tasks: Task[]): Task[] {
  const taskIds = new Set(goal.taskIds ?? [])
  const projectIds = new Set(goal.projectIds ?? [])
  return tasks.filter(
    (t) => !t.archived && (taskIds.has(t.id) || (!!t.projectId && projectIds.has(t.projectId)))
  )
}

export function goalProgress(goal: Goal, tasks: Task[]): GoalProgress {
  const type: GoalProgressType =
    goal.progressType ?? ((goal.milestones ?? []).length ? 'milestone' : 'task')

  if (type === 'milestone') {
    const ms = goal.milestones ?? []
    const done = ms.filter((m) => m.done).length
    return {
      pct: ms.length ? Math.round((done / ms.length) * 100) : 0,
      done,
      total: ms.length,
      label: ms.length ? `${done}/${ms.length} milestones` : 'No milestones yet',
      source: type,
    }
  }

  if (type === 'numeric') {
    const target = goal.targetValue ?? 0
    const current = goal.currentValue ?? 0
    const unit = goal.unit ? ` ${goal.unit}` : ''
    return {
      pct: target > 0 ? clamp(Math.round((current / target) * 100)) : 0,
      done: current,
      total: target,
      label: target > 0 ? `${current}/${target}${unit}` : 'Set a target value',
      source: type,
    }
  }

  if (type === 'percentage') {
    const value = clamp(Math.round(goal.currentValue ?? 0))
    return { pct: value, done: value, total: 100, label: `${value}%`, source: type }
  }

  if (type === 'habit') {
    const target = goal.targetValue && goal.targetValue > 0 ? Math.round(goal.targetValue) : 7
    const streak = goalStreak(goal, tasks)
    return {
      pct: clamp(Math.round((streak / target) * 100)),
      done: streak,
      total: target,
      label: `${streak}-day streak`,
      source: type,
    }
  }

  const linked = goalLinkedTasks(goal, tasks)
  const done = linked.filter((t) => t.completed).length
  return {
    pct: linked.length ? Math.round((done / linked.length) * 100) : 0,
    done,
    total: linked.length,
    label: linked.length ? `${done}/${linked.length} tasks` : 'No linked tasks yet',
    source: 'task',
  }
}

/** Consecutive days ending today (or yesterday) with a completed linked task. */
export function goalStreak(goal: Goal, tasks: Task[], now = new Date()): number {
  const days = new Set<string>()
  for (const t of goalLinkedTasks(goal, tasks)) {
    if (t.completed && t.completedAt) days.add(toISODate(new Date(t.completedAt)))
  }
  if (days.size === 0) return 0
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  if (!days.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(toISODate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// ---------------------------------------------------------------------------
// Health — encouraging, never guilt-inducing.
// ---------------------------------------------------------------------------

export type GoalHealth = 'completed' | 'not_started' | 'on_track' | 'attention' | 'at_risk'

export type GoalRiskReason =
  | 'behind_pace'
  | 'slow_velocity'
  | 'missed_milestone'
  | 'no_linked_work'
  | 'overdue_work'
  | 'stale'
  | 'paused'

export interface GoalForecast {
  expectedPct: number
  projectedPct: number
  etaISO: string | null
  onPace: boolean
  velocityPerWeek: number
}

export interface GoalHealthInfo {
  status: GoalHealth
  label: string
  tone: 'green' | 'amber' | 'red' | 'blue' | 'gray'
  /** Optional short encouragement. */
  note: string
  reasons: GoalRiskReason[]
  forecast: GoalForecast
}

export function goalVelocityPerWeek(goal: Goal, tasks: Task[], now = new Date()): number {
  const linked = goalLinkedTasks(goal, tasks)
  const nowISO = toISODate(now)
  const weekAgo = addDaysISO(nowISO, -7)
  const twoWeeksAgo = addDaysISO(nowISO, -14)
  const recent = linked.filter(
    (t) => t.completed && t.completedAt && toISODate(new Date(t.completedAt)) >= weekAgo
  ).length
  const prior = linked.filter((t) => {
    if (!t.completed || !t.completedAt) return false
    const iso = toISODate(new Date(t.completedAt))
    return iso >= twoWeeksAgo && iso < weekAgo
  }).length
  const open = linked.filter((t) => !t.completed).length
  const progress = goalProgress(goal, tasks)
  if (progress.source === 'numeric' || progress.source === 'percentage') {
    const startISO = toISODate(new Date(goal.createdAt))
    const weeks = Math.max(1, diffInDays(startISO, nowISO) / 7)
    return progress.pct / weeks
  }
  if (progress.source === 'milestone') {
    const ms = goal.milestones ?? []
    const done = ms.filter((m) => m.done).length
    const startISO = toISODate(new Date(goal.createdAt))
    const weeks = Math.max(1, diffInDays(startISO, nowISO) / 7)
    return ms.length ? (done / ms.length) * 100 / weeks : 0
  }
  if (linked.length === 0) return 0
  const blended = recent * 0.7 + prior * 0.3
  return open + recent > 0 ? (blended / Math.max(1, open + recent)) * 100 : blended
}

export function goalForecast(goal: Goal, tasks: Task[], now = new Date()): GoalForecast {
  const progress = goalProgress(goal, tasks)
  const nowISO = toISODate(now)
  const startISO = toISODate(new Date(goal.createdAt))
  const span = goal.targetDate ? Math.max(1, diffInDays(startISO, goal.targetDate)) : 0
  const elapsed = span ? clamp(diffInDays(startISO, nowISO), 0, span) : diffInDays(startISO, nowISO)
  const expectedPct = span ? Math.round((elapsed / span) * 100) : progress.pct
  const velocity = goalVelocityPerWeek(goal, tasks, now)
  const remaining = Math.max(0, 100 - progress.pct)
  const weeksNeeded = velocity > 0.4 ? remaining / velocity : remaining > 0 ? 52 : 0
  const projectedPct = goal.targetDate
    ? clamp(Math.round(progress.pct + velocity * Math.max(0, (span - elapsed) / 7)))
    : clamp(Math.round(progress.pct + velocity))
  const etaISO = remaining <= 0 ? nowISO : velocity > 0.4 ? addDaysISO(nowISO, Math.ceil(weeksNeeded * 7)) : null
  return {
    expectedPct,
    projectedPct,
    etaISO,
    onPace: !goal.targetDate || projectedPct >= expectedPct - 5,
    velocityPerWeek: Math.round(velocity * 10) / 10,
  }
}

function collectRiskReasons(goal: Goal, tasks: Task[], now = new Date()): GoalRiskReason[] {
  const reasons: GoalRiskReason[] = []
  if (goal.status === 'paused') reasons.push('paused')
  const linked = goalLinkedTasks(goal, tasks)
  const progress = goalProgress(goal, tasks)
  const forecast = goalForecast(goal, tasks, now)
  const nowISO = toISODate(now)
  const hasWork = linked.length > 0 || (goal.milestones ?? []).length > 0
  if (!hasWork && progress.source === 'task') reasons.push('no_linked_work')
  const missed = (goal.milestones ?? []).some((m) => !m.done && m.dueDate && m.dueDate < nowISO)
  if (missed) reasons.push('missed_milestone')
  if (linked.some((t) => !t.completed && t.dueDate && t.dueDate < nowISO)) reasons.push('overdue_work')
  const lastTouch = Math.max(
    goal.createdAt,
    ...linked.map((t) => t.updatedAt || t.createdAt),
    ...(goal.milestones ?? []).filter((m) => m.done).map(() => goal.createdAt)
  )
  if (now.getTime() - lastTouch > 14 * 86_400_000 && progress.pct < 100) reasons.push('stale')
  if (goal.targetDate && forecast.expectedPct - progress.pct > 20) reasons.push('behind_pace')
  if (progress.pct < 100 && forecast.velocityPerWeek < 2 && (forecast.expectedPct >= 15 || linked.length > 0)) {
    reasons.push('slow_velocity')
  }
  return reasons
}

export function goalHealthInfo(goal: Goal, tasks: Task[], now = new Date()): GoalHealthInfo {
  const status = computeGoalHealth(goal, tasks, now)
  const forecast = goalForecast(goal, tasks, now)
  const reasons = status === 'completed' ? [] : collectRiskReasons(goal, tasks, now)
  const next = nextOpenLinkedTask(goal, tasks)?.title ?? nextOpenMilestone(goal)?.title
  switch (status) {
    case 'completed':
      return { status, label: 'Completed', tone: 'blue', note: 'You did it.', reasons, forecast }
    case 'on_track':
      return {
        status,
        label: 'On track',
        tone: 'green',
        note: next ? `Next: ${next}` : 'Right on pace.',
        reasons,
        forecast,
      }
    case 'attention':
      return {
        status,
        label: 'Needs attention',
        tone: 'amber',
        note: reasons.includes('missed_milestone')
          ? 'A milestone slipped — pick it back up.'
          : reasons.includes('no_linked_work')
            ? 'Link a task so this becomes real.'
            : next
              ? `A small push: ${next}`
              : 'A small push this week.',
        reasons,
        forecast,
      }
    case 'at_risk':
      return {
        status,
        label: 'At risk',
        tone: 'red',
        note: reasons.includes('slow_velocity')
          ? forecast.etaISO
            ? `At this pace, finish around ${forecast.etaISO}.`
            : 'Pace is too slow to hit the target.'
          : next
            ? `Let's make it real: ${next}`
            : "Let's make it real.",
        reasons,
        forecast,
      }
    default:
      return { status, label: 'Not started', tone: 'gray', note: 'Pick the first step.', reasons, forecast }
  }
}

export function computeGoalHealth(goal: Goal, tasks: Task[], now = new Date()): GoalHealth {
  if (goal.status === 'completed') return 'completed'
  const progress = goalProgress(goal, tasks)
  const linked = goalLinkedTasks(goal, tasks)
  const hasActivity = progress.done > 0 || linked.some((t) => t.completed)
  if (progress.pct >= 100) return 'completed'

  if (goal.status === 'paused') return 'attention'

  const forecast = goalForecast(goal, tasks, now)
  const reasons = collectRiskReasons(goal, tasks, now)
  const hardRisk =
    reasons.includes('missed_milestone') ||
    (reasons.includes('no_linked_work') && forecast.expectedPct >= 10) ||
    (reasons.includes('slow_velocity') && forecast.expectedPct >= 25 && !forecast.onPace) ||
    reasons.filter((r) => r === 'overdue_work' || r === 'stale' || r === 'behind_pace').length >= 2

  if (!goal.targetDate) {
    if (!hasActivity && reasons.includes('no_linked_work')) return 'not_started'
    if (!hasActivity) return 'not_started'
    if (hardRisk || reasons.includes('overdue_work') || reasons.includes('stale')) return 'attention'
    return 'on_track'
  }

  const delta = progress.pct - forecast.expectedPct

  if (!hasActivity && forecast.expectedPct < 5 && !reasons.includes('missed_milestone')) return 'not_started'
  if (hardRisk || delta < -20) return 'at_risk'
  if (delta >= -5 && !reasons.includes('missed_milestone') && !reasons.includes('overdue_work')) return 'on_track'
  if (delta >= -20 && !hardRisk) return 'attention'
  return 'at_risk'
}

export function tasksFromMilestone(goal: Goal, milestone: GoalMilestone): { title: string; dueDate: string | null; important: boolean } {
  return {
    title: milestone.title,
    dueDate: milestone.dueDate ?? goal.targetDate ?? todayISO(),
    important: (goal.horizon ?? 'month') === 'today' || (goal.horizon ?? 'month') === 'week',
  }
}

export function milestonesNeedingTasks(goal: Goal, tasks: Task[]): GoalMilestone[] {
  const ids = new Set(tasks.map((t) => t.id))
  return (goal.milestones ?? []).filter((m) => !m.done && (!m.taskId || !ids.has(m.taskId)))
}

// ---------------------------------------------------------------------------
// Overview stats
// ---------------------------------------------------------------------------

export interface GoalStats {
  total: number
  active: number
  completed: number
  atRisk: number
  needsAttention: number
  overallPct: number
  streak: number
}

export function computeGoalStats(goals: Goal[], tasks: Task[], now = new Date()): GoalStats {
  const live = goals.filter((g) => g.status !== 'archived')
  const active = live.filter((g) => g.status !== 'completed')
  const completed = live.filter((g) => g.status === 'completed')
  let atRisk = 0
  let needsAttention = 0
  let progressSum = 0
  for (const g of live) {
    const health = computeGoalHealth(g, tasks, now)
    if (health === 'at_risk') atRisk += 1
    if (health === 'attention') needsAttention += 1
    progressSum += goalProgress(g, tasks).pct
  }
  const overallPct = live.length ? Math.round(progressSum / live.length) : 0

  const activeFiltered = active.filter((g) => (g.taskIds ?? []).length || (g.projectIds ?? []).length)
  const pool = activeFiltered.length ? activeFiltered : active
  let streak = 0
  for (const g of pool) streak = Math.max(streak, goalStreak(g, tasks, now))

  return {
    total: live.length,
    active: active.length,
    completed: completed.length,
    atRisk,
    needsAttention,
    overallPct,
    streak,
  }
}

export interface HorizonRollup {
  horizon: GoalHorizon
  meta: HorizonMeta
  count: number
  pct: number
  nextMilestone: string | null
  nextAction: string | null
}

export function horizonRollups(goals: Goal[], tasks: Task[]): HorizonRollup[] {
  return HORIZONS.map((meta) => {
    const inHorizon = goals.filter((g) => g.status !== 'archived' && (g.horizon ?? 'month') === meta.id)
    const pct = inHorizon.length
      ? Math.round(inHorizon.reduce((n, g) => n + goalProgress(g, tasks).pct, 0) / inHorizon.length)
      : 0
    let nextMilestone: string | null = null
    let nextAction: string | null = null
    for (const g of inHorizon) {
      if (!nextMilestone) nextMilestone = nextOpenMilestone(g)?.title ?? null
      if (!nextAction) nextAction = nextOpenLinkedTask(g, tasks)?.title ?? null
    }
    return { horizon: meta.id, meta, count: inHorizon.length, pct, nextMilestone, nextAction }
  })
}

// ---------------------------------------------------------------------------
// Hierarchy
// ---------------------------------------------------------------------------

export function goalChildren(goals: Goal[], id: string): Goal[] {
  return goals.filter((g) => g.parentId === id && g.status !== 'archived')
}

export function goalAncestors(goals: Goal[], id: string): Goal[] {
  const out: Goal[] = []
  let cur = goals.find((g) => g.id === id)
  const guard = new Set<string>()
  while (cur?.parentId && !guard.has(cur.id)) {
    guard.add(cur.id)
    const parent = goals.find((g) => g.id === cur!.parentId)
    if (!parent) break
    out.unshift(parent)
    cur = parent
  }
  return out
}

export function goalDescendants(goals: Goal[], id: string): Goal[] {
  const out: Goal[] = []
  const walk = (parentId: string) => {
    for (const child of goals.filter((g) => g.parentId === parentId)) {
      out.push(child)
      walk(child.id)
    }
  }
  walk(id)
  return out
}

/** Roots plus any goal whose parent is missing (keeps orphans visible). */
export function rootGoals(goals: Goal[], statusFilter?: GoalStatus): Goal[] {
  const ids = new Set(goals.map((g) => g.id))
  return goals.filter(
    (g) => (!g.parentId || !ids.has(g.parentId)) && (!statusFilter || (g.status ?? 'active') === statusFilter)
  )
}

export function nextOpenMilestone(goal: Goal): GoalMilestone | null {
  return (goal.milestones ?? []).find((m) => !m.done) ?? null
}

export function nextOpenLinkedTask(goal: Goal, tasks: Task[]): Task | null {
  const open = goalLinkedTasks(goal, tasks).filter((t) => !t.completed)
  if (!open.length) return null
  return open.sort(
    (a, b) =>
      (a.dueDate ? 0 : 1) - (b.dueDate ? 0 : 1) ||
      (a.dueDate ?? '').localeCompare(b.dueDate ?? '') ||
      b.priority - a.priority
  )[0]
}

// ---------------------------------------------------------------------------
// Today's goals — what can you do today that moves a bigger goal forward?
// ---------------------------------------------------------------------------

export interface GoalAction {
  goalId: string
  goalTitle: string
  goalColor: string
  horizon: GoalHorizon
  health: GoalHealth
  action: string
  reason: string
  taskId?: string
  milestoneId?: string
}

function actionScore(goal: Goal, health: GoalHealth): number {
  const healthWeight: Record<GoalHealth, number> = { at_risk: 40, attention: 25, not_started: 20, on_track: 10, completed: 0 }
  const urgency = HORIZON_URGENCY.indexOf(goal.horizon ?? 'month')
  const urgencyWeight = (HORIZON_URGENCY.length - urgency) * 5
  return healthWeight[health] + urgencyWeight
}

export function recommendTodayActions(
  goals: Goal[],
  tasks: Task[],
  now = new Date(),
  limit = 5
): GoalAction[] {
  const candidates: (GoalAction & { score: number })[] = []
  for (const goal of goals) {
    if (goal.status === 'completed' || goal.status === 'archived' || goal.status === 'paused') continue
    const health = computeGoalHealth(goal, tasks, now)
    const linked = nextOpenLinkedTask(goal, tasks)
    if (linked) {
      candidates.push({
        goalId: goal.id,
        goalTitle: goal.title,
        goalColor: goal.color,
        horizon: goal.horizon ?? 'month',
        health,
        action: linked.title,
        reason: 'Next linked task',
        taskId: linked.id,
        score: actionScore(goal, health) + (linked.priority ?? 2),
      })
      continue
    }
    const milestone = nextOpenMilestone(goal)
    if (milestone) {
      candidates.push({
        goalId: goal.id,
        goalTitle: goal.title,
        goalColor: goal.color,
        horizon: goal.horizon ?? 'month',
        health,
        action: milestone.title,
        reason: 'Next milestone',
        milestoneId: milestone.id,
        score: actionScore(goal, health),
      })
      continue
    }
    candidates.push({
      goalId: goal.id,
      goalTitle: goal.title,
      goalColor: goal.color,
      horizon: goal.horizon ?? 'month',
      health,
      action: goal.metric ? `Take one step toward: ${goal.metric}` : `Take one step toward “${goal.title}”`,
      reason: 'Define the first step',
      score: actionScore(goal, health) - 5,
    })
  }
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...rest }) => rest)
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface GoalTemplate {
  id: string
  label: string
  icon: string
  category: GoalCategory
  horizon: GoalHorizon
  title: string
  why: string
  metric: string
  milestones: string[]
  todayAction: string
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'health',
    label: 'Health',
    icon: 'heart',
    category: 'health',
    horizon: '6m',
    title: 'Get strong and healthy',
    why: 'Energy compounds into everything else I do.',
    metric: 'Train 4x a week for 6 months',
    milestones: ['Book a check-up', 'Complete 4 weeks of training', 'Hit a 3-month streak'],
    todayAction: 'Do a 25-minute workout',
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: 'dollarSign',
    category: 'finance',
    horizon: '1y',
    title: 'Save a year of runway',
    why: 'Money buys freedom and calm.',
    metric: 'Save the target amount this year',
    milestones: ['Set a monthly budget', 'Automate savings', 'Hit 6-month checkpoint'],
    todayAction: 'Transfer this week’s savings',
  },
  {
    id: 'career',
    label: 'Career',
    icon: 'briefcase',
    category: 'career',
    horizon: '1y',
    title: 'Level up in my career',
    why: 'I want work that stretches me and pays well.',
    metric: 'Earn a promotion or new role',
    milestones: ['Update portfolio', 'Ship one visible project', 'Ask for the next step'],
    todayAction: 'Spend 25 minutes on a portfolio piece',
  },
  {
    id: 'learning',
    label: 'Learning',
    icon: 'graduationCap',
    category: 'learning',
    horizon: '6m',
    title: 'Learn a new skill',
    why: 'Learning keeps me curious and capable.',
    metric: 'Finish a structured course and build one project',
    milestones: ['Pick the course', 'Finish lessons 1–4', 'Build a small project'],
    todayAction: 'Complete one lesson',
  },
  {
    id: 'relationships',
    label: 'Relationships',
    icon: 'user',
    category: 'relationships',
    horizon: 'month',
    title: 'Invest in the people who matter',
    why: 'Life is better shared.',
    metric: 'One meaningful moment with someone each week',
    milestones: ['Reach out to 3 people', 'Plan a get-together'],
    todayAction: 'Send a message to someone you miss',
  },
  {
    id: 'personal',
    label: 'Personal',
    icon: 'sparkles',
    category: 'personal',
    horizon: 'month',
    title: 'Build a habit I’m proud of',
    why: 'Small daily actions become who I am.',
    metric: 'A 30-day streak',
    milestones: ['Define the cue', '7-day streak', '21-day streak'],
    todayAction: 'Do it once today',
  },
]

// ---------------------------------------------------------------------------
// Plan with AI — turn a sentence into a 5-year → today ladder.
// Deterministic, editable, and never creates anything without confirmation.
// ---------------------------------------------------------------------------

export interface GoalPlanStep {
  horizon: GoalHorizon
  title: string
  why: string
  metric: string
  milestone: string
  todayAction: string
}

export interface GoalPlan {
  prompt: string
  category: GoalCategory
  summary: string
  steps: GoalPlanStep[]
}

export function suggestGoalPlan(prompt: string): GoalPlan {
  const clean = prompt.trim().replace(/[.?!]+$/, '')
  const subject = clean && clean.length <= 80 ? clean.replace(/^i (want to|wanna|would like to)\s+/i, '') : clean || 'something that matters'
  const category = inferCategory(clean)
  const theme = categoryLabel(category)
  const short = truncate(subject, 48)

  const steps: GoalPlanStep[] = [
    {
      horizon: '5y',
      title: `Make ${short} a core part of who I am`,
      why: `Long-term ${theme.toLowerCase()} becomes a lasting strength.`,
      metric: `${capitalize(short)} is simply how I live`,
      milestone: 'Five years of steady progress',
      todayAction: `Take one small step toward ${short}`,
    },
    {
      horizon: '3y',
      title: `Reach real mastery in ${short}`,
      why: 'Three years turns intent into identity.',
      metric: 'A level others notice',
      milestone: 'Consistent for 3 years',
      todayAction: `Plan this month’s step for ${short}`,
    },
    {
      horizon: '1y',
      title: `${capitalize(short)} — a year of measurable progress`,
      why: 'A year is enough to change the trajectory.',
      metric: 'Hit a clear yearly milestone',
      milestone: 'First big milestone done',
      todayAction: `Block 25 minutes for ${short}`,
    },
    {
      horizon: '6m',
      title: `Build the foundation for ${short}`,
      why: 'Six months of foundation makes the rest feel easy.',
      metric: 'A repeatable weekly rhythm',
      milestone: '12 weeks of consistency',
      todayAction: `Do the smallest version of ${short}`,
    },
    {
      horizon: 'month',
      title: `Create momentum on ${short}`,
      why: 'A month sets the pace.',
      metric: 'One visible result this month',
      milestone: 'First milestone completed',
      todayAction: `Start the first task for ${short}`,
    },
    {
      horizon: 'week',
      title: `Make meaningful progress on ${short}`,
      why: 'This week decides the month.',
      metric: '3 focused sessions',
      milestone: 'Weekly target hit',
      todayAction: `Schedule this week’s sessions`,
    },
    {
      horizon: 'today',
      title: `Take the first action on ${short}`,
      why: 'Today is the only place to start.',
      metric: 'One action completed',
      milestone: 'First step done',
      todayAction: `Spend 25 minutes on ${short}`,
    },
  ]

  return {
    prompt: clean,
    category,
    summary: `A ${theme.toLowerCase()} ladder from your 5-year vision down to today.`,
    steps,
  }
}

function inferCategory(text: string): GoalCategory {
  const t = text.toLowerCase()
  if (/(run|marathon|gym|fit|health|weight|sleep|yoga|muscle|diet)/.test(t)) return 'health'
  if (/(save|money|invest|budget|rich|debt|finance|salary|wealth)/.test(t)) return 'finance'
  if (/(career|job|promotion|business|startup|freelance|company|work)/.test(t)) return 'career'
  if (/(learn|study|course|code|program|language|exam|read|skill|degree)/.test(t)) return 'learning'
  if (/(family|friend|relationship|partner|marriage|network|community)/.test(t)) return 'relationships'
  return 'personal'
}

function categoryLabel(id: GoalCategory): string {
  return GOAL_CATEGORIES.find((c) => c.id === id)?.label ?? 'Personal'
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1).trim()}…` : s
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export interface GoalNeedingAttention {
  id: string
  title: string
  pct: number
  health: GoalHealth
  nextAction: string | null
}

export interface GoalReview {
  completedGoals: string[]
  progressed: { id: string; title: string; pct: number }[]
  needsAttention: GoalNeedingAttention[]
  milestonesDone: number
  contributing: { title: string; goalTitle: string }[]
  nextActions: string[]
}

export function buildGoalReview(
  goals: Goal[],
  tasks: Task[],
  projects: Project[],
  sinceMs: number
): GoalReview {
  const live = goals.filter((g) => g.status !== 'archived')
  const completedGoals = live
    .filter((g) => g.status === 'completed' && (g.completedAt ?? 0) >= sinceMs)
    .map((g) => g.title)

  const progressed = live
    .filter((g) => g.status !== 'completed')
    .map((g) => ({ id: g.id, title: g.title, pct: goalProgress(g, tasks).pct }))
    .filter((g) => g.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6)

  const needsAttention: GoalNeedingAttention[] = live
    .filter((g) => g.status !== 'completed')
    .map((g) => {
      const health = computeGoalHealth(g, tasks)
      return {
        id: g.id,
        title: g.title,
        pct: goalProgress(g, tasks).pct,
        health,
        nextAction: nextOpenMilestone(g)?.title ?? nextOpenLinkedTask(g, tasks)?.title ?? null,
      }
    })
    .filter((g) => g.health === 'at_risk' || g.health === 'attention')
    .sort((a, b) => (a.health === 'at_risk' ? -1 : 1) - (b.health === 'at_risk' ? -1 : 1))

  let milestonesDone = 0
  for (const g of live) for (const m of g.milestones ?? []) if (m.done) milestonesDone += 1

  const contributing: { title: string; goalTitle: string }[] = []
  const goalByTask = new Map<string, Goal>()
  for (const g of live) {
    for (const id of g.taskIds ?? []) goalByTask.set(id, g)
  }
  for (const t of tasks) {
    if (!t.completed || !t.completedAt || t.completedAt < sinceMs) continue
    const direct = goalByTask.get(t.id)
    const byProject = live.find((g) => !!t.projectId && g.projectIds.includes(t.projectId))
    const goal = direct ?? byProject
    if (goal) contributing.push({ title: t.title, goalTitle: goal.title })
  }

  const nextActions = needsAttention
    .map((g) => (g.nextAction ? `${g.title}: ${g.nextAction}` : `Add a next step to “${g.title}”`))
    .slice(0, 4)

  return {
    completedGoals,
    progressed,
    needsAttention,
    milestonesDone,
    contributing: contributing.slice(0, 6),
    nextActions,
  }
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface GoalAnalytics {
  total: number
  active: number
  completed: number
  completionRate: number
  completedThisMonth: number
  byCategory: { category: GoalCategory; label: string; count: number }[]
  completedPerMonth: { label: string; count: number }[]
  longTerm: { horizon: GoalHorizon; label: string; pct: number; count: number }[]
  goalsLinkedToTasks: number
}

export function computeGoalAnalytics(goals: Goal[], tasks: Task[], now = new Date()): GoalAnalytics {
  const live = goals.filter((g) => g.status !== 'archived')
  const completed = live.filter((g) => g.status === 'completed')
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const byCategoryMap = new Map<GoalCategory, number>()
  for (const g of live) {
    const c = g.category ?? 'personal'
    byCategoryMap.set(c, (byCategoryMap.get(c) ?? 0) + 1)
  }
  const byCategory = GOAL_CATEGORIES.map((c) => ({
    category: c.id,
    label: c.label,
    count: byCategoryMap.get(c.id) ?? 0,
  })).filter((c) => c.count > 0)

  const completedPerMonth: { label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const count = completed.filter((g) => g.completedAt && toISODate(new Date(g.completedAt)).startsWith(key)).length
    completedPerMonth.push({ label: d.toLocaleDateString(undefined, { month: 'short' }), count })
  }

  const longTerm = HORIZONS.filter((h) => h.id !== 'today' && h.id !== 'week' && h.id !== 'month').map((h) => {
    const inHorizon = live.filter((g) => (g.horizon ?? 'month') === h.id)
    const pct = inHorizon.length
      ? Math.round(inHorizon.reduce((n, g) => n + goalProgress(g, tasks).pct, 0) / inHorizon.length)
      : 0
    return { horizon: h.id, label: h.label, pct, count: inHorizon.length }
  })

  const completedThisMonth = completed.filter(
    (g) => g.completedAt && toISODate(new Date(g.completedAt)).startsWith(monthKey)
  ).length

  return {
    total: live.length,
    active: live.filter((g) => g.status !== 'completed').length,
    completed: completed.length,
    completionRate: live.length ? Math.round((completed.length / live.length) * 100) : 0,
    completedThisMonth,
    byCategory,
    completedPerMonth,
    longTerm,
    goalsLinkedToTasks: live.filter((g) => (g.taskIds ?? []).length > 0).length,
  }
}

// ---------------------------------------------------------------------------
// Filtering / sorting
// ---------------------------------------------------------------------------

export type GoalSort = 'smart' | 'progress' | 'deadline' | 'recent'

export interface GoalFilters {
  query?: string
  horizon?: GoalHorizon | 'all'
  category?: GoalCategory | 'all'
  status?: GoalStatus | 'all'
  sort?: GoalSort
}

export function filterAndSortGoals(goals: Goal[], tasks: Task[], filters: GoalFilters = {}): Goal[] {
  const q = (filters.query ?? '').trim().toLowerCase()
  const out = goals.filter((g) => {
    if (g.status === 'archived' && filters.status !== 'archived') return false
    if (filters.horizon && filters.horizon !== 'all' && (g.horizon ?? 'month') !== filters.horizon) return false
    if (filters.category && filters.category !== 'all' && (g.category ?? 'personal') !== filters.category) return false
    if (filters.status && filters.status !== 'all' && (g.status ?? 'active') !== filters.status) return false
    if (q && !`${g.title} ${g.why ?? ''} ${g.metric ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
  const sort = filters.sort ?? 'smart'
  return out.sort((a, b) => {
    if (sort === 'progress') return goalProgress(b, tasks).pct - goalProgress(a, tasks).pct
    if (sort === 'deadline') return (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999')
    if (sort === 'recent') return b.createdAt - a.createdAt
    // smart: breadth first (vision → today), then health urgency
    const hi = horizonIndex(a.horizon) - horizonIndex(b.horizon)
    if (hi !== 0) return hi
    return b.createdAt - a.createdAt
  })
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n))
}
