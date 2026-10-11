import type { EnergyLevel, Goal, Project, Task } from '@/lib/types'
import { addDaysISO, todayISO, toISODate } from '@/lib/dates'
import { isTaskOverdue } from '@/lib/stats'
import { parseQuickAdd, type ParsedQuickAdd } from '@/lib/nlparser'
import { taskDuration } from '@/lib/time'
import { computeGoalHealth, goalProgress as goalProgressOf, nextOpenLinkedTask, nextOpenMilestone } from '@/lib/goals'

export interface PlanSlot {
  taskId: string
  startMin: number
  endMin: number
  reason: string
  fixed: boolean
}

export interface Conflict {
  kind: 'overlap' | 'overloaded' | 'blocked' | 'energy-mismatch'
  taskIds: string[]
  message: string
}

export interface DayPlan {
  date: string
  slots: PlanSlot[]
  unscheduled: string[]
  conflicts: Conflict[]
  loadMinutes: number
  capacityMinutes: number
}

export interface NextAction {
  task: Task
  reason: string
  blockers: Task[]
}

export interface ProjectHealth {
  id: string
  name: string
  open: number
  overdue: number
  stale: number
  status: 'healthy' | 'watch' | 'at-risk'
}

export interface WeeklyReview {
  completed: number
  postponed: number
  overdue: number
  minutesLogged: number
  wins: string[]
  slips: string[]
  projectHealth: ProjectHealth[]
  goalProgress: { id: string; title: string; pct: number }[]
  nextWeekFocus: string[]
  goalsMoved: string[]
  stopDoing: string[]
  startDoing: string[]
  summary: string
}

const DAY_START = 9 * 60
const DAY_END = 18 * 60
const CAPACITY = DAY_END - DAY_START
const STALE_MS = 7 * 24 * 60 * 60 * 1000

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return DAY_START
  return h * 60 + m
}

export function minutesToHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function learnedDuration(task: Task, fallback = 30): number {
  const hist = task.actualMinutes ?? []
  if (hist.length === 0) return taskDuration(task, fallback)
  const avg = hist.reduce((a, b) => a + b, 0) / hist.length
  const est = typeof task.estimate === 'number' && task.estimate > 0 ? task.estimate : avg
  return Math.min(240, Math.max(5, Math.round((avg * hist.length + est) / (hist.length + 1))))
}

export function inferredEnergy(task: Task): EnergyLevel {
  if (task.energy) return task.energy
  const tags = (task.tags ?? []).map((t) => t.toLowerCase())
  if (tags.some((t) => ['errand', 'quick', 'admin', 'email'].includes(t))) return 'low'
  if (tags.some((t) => ['deep-work', 'deep', 'focus'].includes(t))) return 'high'
  const dur = learnedDuration(task)
  if (task.important || task.priority >= 3 || dur >= 60) return 'high'
  if (task.priority <= 1 || dur <= 20) return 'low'
  return 'medium'
}

export function blockersOf(task: Task, all: Task[]): Task[] {
  const ids = task.dependsOn ?? []
  if (!ids.length) return []
  const byId = new Map(all.map((t) => [t.id, t]))
  return ids
    .map((id) => byId.get(id))
    .filter((t): t is Task => !!t && !t.completed && !t.archived)
}

export function isBlocked(task: Task, all: Task[]): boolean {
  return blockersOf(task, all).length > 0
}

export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.archived && !t.completed)
}

function energyFit(task: Task, energy: EnergyLevel): number {
  const need = inferredEnergy(task)
  if (need === energy) return 0
  if (energy === 'high') return need === 'medium' ? 1 : 2
  if (energy === 'medium') return 1
  return need === 'high' ? 4 : 1
}

export function scoreTask(task: Task, energy: EnergyLevel, nowISO = todayISO()): number {
  const prio = 5 - (task.priority ?? 2)
  const imp = task.important ? 3 : 0
  let due = 1
  if (task.dueDate) {
    if (task.dueDate < nowISO) due = 6
    else if (task.dueDate === nowISO) due = 4
    else {
      const days = Math.max(0, (Date.parse(task.dueDate + 'T12:00:00') - Date.parse(nowISO + 'T12:00:00')) / 86400000)
      due = Math.max(0, 3 - days * 0.4)
    }
  }
  const postpone = Math.min(3, task.postponeCount ?? 0)
  return prio * 4 + imp * 3 + due * 3 + postpone - energyFit(task, energy) * 2
}

export function pickNextAction(tasks: Task[], energy: EnergyLevel, nowISO = todayISO()): NextAction | null {
  const open = openTasks(tasks)
  const ready = open.filter((t) => !isBlocked(t, tasks))
  const pool = ready.length ? ready : open
  if (!pool.length) return null
  const ranked = [...pool].sort((a, b) => scoreTask(b, energy, nowISO) - scoreTask(a, energy, nowISO))
  const task = ranked[0]
  const blockers = blockersOf(task, tasks)
  const reasons: string[] = []
  if (task.dueDate && task.dueDate < nowISO) reasons.push('overdue')
  else if (task.dueDate === nowISO) reasons.push('due today')
  if (task.important) reasons.push('marked important')
  if ((task.postponeCount ?? 0) > 0) reasons.push(`postponed ${task.postponeCount}x`)
  if (inferredEnergy(task) === energy) reasons.push(`fits ${energy} energy`)
  if (task.priority >= 3) reasons.push('high priority')
  if (blockers.length) reasons.push('still blocked')
  return {
    task,
    reason: reasons.length ? reasons.join(' · ') : 'highest leverage open work',
    blockers,
  }
}

export function detectConflicts(tasks: Task[], dateISO: string): Conflict[] {
  const open = openTasks(tasks)
  const timed = open
    .filter((t) => t.dueDate === dateISO && t.dueTime)
    .map((t) => {
      const start = hhmmToMinutes(t.dueTime!)
      return { task: t, start, end: start + learnedDuration(t) }
    })
    .sort((a, b) => a.start - b.start)

  const conflicts: Conflict[] = []
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]
      const b = timed[j]
      if (a.start < b.end && b.start < a.end) {
        conflicts.push({
          kind: 'overlap',
          taskIds: [a.task.id, b.task.id],
          message: `"${a.task.title}" overlaps "${b.task.title}"`,
        })
      }
    }
  }

  const load = open
    .filter((t) => !t.dueDate || t.dueDate === dateISO || t.dueDate < dateISO)
    .reduce((sum, t) => sum + learnedDuration(t), 0)
  if (load > CAPACITY + 30) {
    conflicts.push({
      kind: 'overloaded',
      taskIds: open.filter((t) => !t.dueDate || t.dueDate <= dateISO).map((t) => t.id),
      message: `About ${Math.round(load / 60)}h of work vs ${CAPACITY / 60}h of focus time`,
    })
  }

  for (const t of open) {
    if (isBlocked(t, tasks) && (t.dueDate === dateISO || (t.dueDate && t.dueDate < dateISO))) {
      const names = blockersOf(t, tasks).map((b) => b.title).join(', ')
      conflicts.push({
        kind: 'blocked',
        taskIds: [t.id, ...(t.dependsOn ?? [])],
        message: `"${t.title}" waits on ${names}`,
      })
    }
  }
  return conflicts
}

export function buildDayPlan(tasks: Task[], energy: EnergyLevel, dateISO = todayISO()): DayPlan {
  const open = openTasks(tasks)
  const conflicts = detectConflicts(tasks, dateISO)
  const byId = new Map(open.map((t) => [t.id, t]))

  const fixed = open
    .filter((t) => t.dueDate === dateISO && t.dueTime)
    .sort((a, b) => a.dueTime!.localeCompare(b.dueTime!))
    .map((t) => {
      const start = hhmmToMinutes(t.dueTime!)
      return {
        taskId: t.id,
        startMin: start,
        endMin: start + learnedDuration(t),
        reason: 'already timed',
        fixed: true,
      }
    })

  let float = open.filter((t) => !t.dueTime && (!t.dueDate || t.dueDate === dateISO || t.dueDate < dateISO) && !isBlocked(t, tasks))
  if (float.length === 0) {
    float = open.filter((t) => !t.dueTime && !t.dueDate && (t.important || t.priority >= 3)).slice(0, 6)
  }
  float.sort((a, b) => scoreTask(b, energy, dateISO) - scoreTask(a, energy, dateISO))

  const occupied = fixed.map((s) => ({ start: s.startMin, end: s.endMin }))
  const slots: PlanSlot[] = [...fixed]
  let cursor = DAY_START

  const place = (start: number, dur: number) => {
    let s = Math.max(start, DAY_START)
    for (const o of occupied.sort((a, b) => a.start - b.start)) {
      if (s < o.end && s + dur > o.start) s = o.end
    }
    if (s + dur > DAY_END) return null
    return s
  }

  for (const t of float) {
    const dur = learnedDuration(t)
    const start = place(cursor, dur)
    if (start == null) continue
    const need = inferredEnergy(t)
    const reasonParts = [need === energy ? `fits ${energy} energy` : `${need} energy`]
    if (t.dueDate && t.dueDate < dateISO) reasonParts.unshift('overdue')
    else if (t.dueDate === dateISO) reasonParts.unshift('due today')
    else if (t.important) reasonParts.unshift('important')
    slots.push({ taskId: t.id, startMin: start, endMin: start + dur, reason: reasonParts.join(' · '), fixed: false })
    occupied.push({ start, end: start + dur })
    cursor = start + dur + 5
  }

  slots.sort((a, b) => a.startMin - b.startMin)
  const scheduled = new Set(slots.map((s) => s.taskId))
  const unscheduled = float.filter((t) => !scheduled.has(t.id)).map((t) => t.id)
  const loadMinutes = slots.reduce((sum, s) => sum + (s.endMin - s.startMin), 0)

  const energyMismatches = slots
    .map((s) => byId.get(s.taskId))
    .filter((t): t is Task => !!t && inferredEnergy(t) === 'high' && energy === 'low')
  if (energyMismatches.length) {
    conflicts.push({
      kind: 'energy-mismatch',
      taskIds: energyMismatches.map((t) => t.id),
      message: 'Deep work is on the plan while energy is low — consider lighter tasks first',
    })
  }

  return { date: dateISO, slots, unscheduled, conflicts, loadMinutes, capacityMinutes: CAPACITY }
}

export function suggestSubtasks(title: string): string[] {
  const raw = title.trim()
  if (!raw) return []
  const numbered = raw
    .split(/\s*(?:\d+[.)]|[-*])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
  if (numbered.length >= 3) return numbered.slice(0, 8)

  const split = raw
    .split(/\s*(?:,|;|\band then\b|\bthen\b)\s+/i)
    .map((s) => s.replace(/^and\s+/i, '').trim())
    .filter((s) => s.length > 2 && s.length < 80)
  if (split.length >= 2 && split.length <= 6) return split

  const lower = raw.toLowerCase()
  if (/^(prepare|plan|write|draft|launch|ship|organize|build|create|finish|study)\b/.test(lower)) {
    return [`Outline ${raw}`, `Do the work`, `Review and wrap up`]
  }
  return []
}

export function captureFromText(input: string): ParsedQuickAdd {
  return parseQuickAdd(input)
}

export function goalProgressPct(goal: Goal, tasks: Task[]): number {
  const set = new Set(goal.projectIds)
  const related = tasks.filter((t) => !t.archived && t.projectId && set.has(t.projectId))
  if (!related.length) return 0
  const done = related.filter((t) => t.completed).length
  return Math.round((done / related.length) * 100)
}

export function buildWeeklyReview(tasks: Task[], projects: Project[], goals: Goal[], now = new Date()): WeeklyReview {
  const weekStart = new Date(now)
  const dow = weekStart.getDay()
  const back = dow === 0 ? 6 : dow - 1
  weekStart.setDate(weekStart.getDate() - back)
  weekStart.setHours(0, 0, 0, 0)
  const startMs = weekStart.getTime()
  const startISO = toISODate(weekStart)

  const completedList = tasks.filter((t) => t.completed && t.completedAt && t.completedAt >= startMs)
  const postponed = tasks.reduce((n, t) => n + (t.postponeCount ?? 0), 0)
  const overdue = tasks.filter((t) => isTaskOverdue(t, now)).length
  const minutesLogged = tasks.reduce((n, t) => n + (t.actualMinutes ?? []).reduce((a, b) => a + b, 0), 0)

  const wins = completedList
    .sort((a, b) => b.priority - a.priority || (b.important ? 1 : 0) - (a.important ? 1 : 0))
    .slice(0, 5)
    .map((t) => t.title)

  const slips = openTasks(tasks)
    .filter((t) => (t.postponeCount ?? 0) > 0 || isTaskOverdue(t, now))
    .sort((a, b) => (b.postponeCount ?? 0) - (a.postponeCount ?? 0))
    .slice(0, 5)
    .map((t) => t.title)

  const projectHealth: ProjectHealth[] = projects
    .filter((p) => !p.archived)
    .map((p) => {
      const pt = tasks.filter((t) => t.projectId === p.id && !t.archived)
      const open = pt.filter((t) => !t.completed)
      const overdueN = open.filter((t) => isTaskOverdue(t, now)).length
      const stale = open.filter((t) => now.getTime() - t.updatedAt > STALE_MS).length
      const status: ProjectHealth['status'] = overdueN >= 3 || stale >= 4 ? 'at-risk' : overdueN > 0 || stale > 0 ? 'watch' : 'healthy'
      return { id: p.id, name: p.name, open: open.length, overdue: overdueN, stale, status }
    })

  const goalProgress = goals.map((g) => ({ id: g.id, title: g.title, pct: goalProgressPct(g, tasks) }))

  const next = pickNextAction(tasks, 'medium', todayISO())
  const liveGoals = goals.filter((g) => g.status !== 'archived' && g.status !== 'completed')
  const goalsMoved = liveGoals
    .map((g) => ({ g, pct: goalProgressOf(g, tasks).pct, health: computeGoalHealth(g, tasks, now) }))
    .filter((row) => row.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4)
    .map((row) => `${row.g.title} (${row.pct}%)`)

  const atRisk = liveGoals
    .map((g) => ({ g, health: computeGoalHealth(g, tasks, now) }))
    .filter((row) => row.health === 'at_risk' || row.health === 'attention')

  const laggingGoal = atRisk[0]?.g ?? [...goalProgress].sort((a, b) => a.pct - b.pct)[0]
  const laggingTitle = laggingGoal && 'title' in laggingGoal ? laggingGoal.title : (laggingGoal as { title?: string } | undefined)?.title

  const mostPostponed = openTasks(tasks)
    .filter((t) => (t.postponeCount ?? 0) >= 2)
    .sort((a, b) => (b.postponeCount ?? 0) - (a.postponeCount ?? 0))[0]

  const stopDoing: string[] = []
  if (mostPostponed) stopDoing.push(`Stop postponing “${mostPostponed.title}” — finish or drop it`)
  if (overdue >= 3) stopDoing.push('Stop adding new work until overdue is under 3')
  const overloaded = projectHealth.find((p) => p.status === 'at-risk')
  if (overloaded) stopDoing.push(`Stop stretching ${overloaded.name} — cut or reschedule`)
  if (!stopDoing.length && postponed > 0) stopDoing.push('Stop sliding dates without a smaller next step')

  const startDoing: string[] = []
  for (const row of atRisk.slice(0, 2)) {
    const step = nextOpenLinkedTask(row.g, tasks)?.title ?? nextOpenMilestone(row.g)?.title
    startDoing.push(step ? `Start “${step}” for ${row.g.title}` : `Start one concrete step on ${row.g.title}`)
  }
  if (next && !startDoing.some((s) => s.includes(next.task.title))) startDoing.push(`Start with ${next.task.title}`)
  if (!startDoing.length) startDoing.push('Start the week with one protected deep-work block')

  const nextWeekFocus = [
    next ? next.task.title : 'Protect one deep-work block',
    overdue > 0 ? 'Clear overdue before adding more' : slips[0] ? `Unstick: ${slips[0]}` : `Keep the ${completedList.length}-win pace`,
    laggingTitle ? `Move “${laggingTitle}” forward` : `Plan the week starting ${startISO}`,
  ]

  const hours = Math.round(minutesLogged / 60)
  const summary =
    completedList.length === 0 && overdue === 0
      ? 'A quiet week. Pick one goal and give it a first step.'
      : `${completedList.length} finished, ${overdue} overdue, ${hours}h logged` +
        (goalsMoved[0] ? `. Moved: ${goalsMoved[0]}` : '.') +
        (atRisk[0] ? ` Watch ${atRisk[0].g.title}.` : '')

  return {
    completed: completedList.length,
    postponed,
    overdue,
    minutesLogged,
    wins,
    slips,
    projectHealth,
    goalProgress,
    nextWeekFocus,
    goalsMoved,
    stopDoing: stopDoing.slice(0, 3),
    startDoing: startDoing.slice(0, 3),
    summary,
  }
}

export function applyPlanTimes(plan: DayPlan): { id: string; dueDate: string; dueTime: string }[] {
  return plan.slots.map((s) => ({
    id: s.taskId,
    dueDate: plan.date,
    dueTime: minutesToHHMM(s.startMin),
  }))
}

export type CommandKind =
  | { kind: 'navigate'; view: string }
  | { kind: 'plan' }
  | { kind: 'focus' }
  | { kind: 'next' }
  | { kind: 'review' }
  | { kind: 'add'; text: string }
  | { kind: 'energy'; energy: EnergyLevel }
  | { kind: 'goal' }
  | { kind: 'search' }

export function parseCommand(raw: string): CommandKind {
  const q = raw.trim()
  if (!q.startsWith('/')) return { kind: 'search' }
  const body = q.slice(1).trim()
  const [head, ...rest] = body.split(/\s+/)
  const cmd = (head ?? '').toLowerCase()
  const arg = rest.join(' ').trim()
  if (cmd === 'add' || cmd === 'capture') return { kind: 'add', text: arg }
  if (cmd === 'plan' || cmd === 'ai' || cmd === 'ask') return { kind: 'plan' }
  if (cmd === 'focus') return { kind: 'focus' }
  if (cmd === 'next') return { kind: 'next' }
  if (cmd === 'review' || cmd === 'week') return { kind: 'review' }
  if (cmd === 'energy' && (arg === 'high' || arg === 'medium' || arg === 'low')) return { kind: 'energy', energy: arg }
  if (cmd === 'goal') return { kind: 'goal' }
  const views: Record<string, string> = {
    today: 'today',
    inbox: 'inbox',
    upcoming: 'upcoming',
    calendar: 'calendar',
    goals: 'goals',
    settings: 'settings',
    dashboard: 'dashboard',
    rewards: 'rewards',
    all: 'all',
    overdue: 'overdue',
    waiting: 'waiting',
    important: 'important',
    routines: 'routines',
    completed: 'completed',
  }
  if (views[cmd]) return { kind: 'navigate', view: views[cmd] }
  return { kind: 'search' }
}

export function postponeDate(dueDate: string | null, fromISO = todayISO()): string {
  const base = dueDate && dueDate > fromISO ? dueDate : fromISO
  return addDaysISO(base, 1)
}

export function nextFreeStart(tasks: Task[], dateISO: string, duration: number, afterMin: number): number | null {
  const occupied = openTasks(tasks)
    .filter((t) => t.dueDate === dateISO && t.dueTime)
    .map((t) => {
      const start = hhmmToMinutes(t.dueTime!)
      return { start, end: start + learnedDuration(t) }
    })
    .sort((a, b) => a.start - b.start)
  let cursor = Math.max(afterMin, DAY_START)
  for (const o of occupied) {
    if (cursor + duration <= o.start) return cursor
    if (cursor < o.end) cursor = o.end
  }
  if (cursor + duration <= DAY_END) return cursor
  return null
}

export function rescheduleMissed(
  tasks: Task[],
  now = new Date()
): { id: string; dueDate: string; dueTime: string }[] {
  const dateISO = toISODate(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const patches: { id: string; dueDate: string; dueTime: string }[] = []
  let working = tasks
  for (const t of openTasks(tasks)) {
    if (!t.dueDate || !t.dueTime) continue
    if (t.dueDate > dateISO) continue
    const start = hhmmToMinutes(t.dueTime)
    const missed = t.dueDate < dateISO || (t.dueDate === dateISO && start + 5 < nowMin)
    if (!missed) continue
    const sameDay = nextFreeStart(working, dateISO, learnedDuration(t), nowMin + 5)
    if (sameDay != null) {
      patches.push({ id: t.id, dueDate: dateISO, dueTime: minutesToHHMM(sameDay) })
      working = working.map((x) => (x.id === t.id ? { ...x, dueDate: dateISO, dueTime: minutesToHHMM(sameDay) } : x))
      continue
    }
    const tomorrow = addDaysISO(dateISO, 1)
    const next = nextFreeStart(working, tomorrow, learnedDuration(t), DAY_START) ?? DAY_START
    patches.push({ id: t.id, dueDate: tomorrow, dueTime: minutesToHHMM(next) })
    working = working.map((x) => (x.id === t.id ? { ...x, dueDate: tomorrow, dueTime: minutesToHHMM(next) } : x))
  }
  return patches
}

export interface DurationInsight {
  taskId: string
  title: string
  estimate: number | null
  actualAvg: number | null
  learned: number
  bias: 'over' | 'under' | 'on' | 'unknown'
}

export function durationInsights(tasks: Task[]): DurationInsight[] {
  return tasks
    .filter((t) => (t.actualMinutes ?? []).length > 0 || (t.estimate ?? 0) > 0)
    .map((t) => {
      const hist = t.actualMinutes ?? []
      const actualAvg = hist.length ? Math.round(hist.reduce((a, b) => a + b, 0) / hist.length) : null
      const estimate = typeof t.estimate === 'number' && t.estimate > 0 ? t.estimate : null
      const learned = learnedDuration(t)
      let bias: DurationInsight['bias'] = 'unknown'
      if (estimate && actualAvg) {
        const ratio = actualAvg / estimate
        bias = ratio > 1.2 ? 'under' : ratio < 0.8 ? 'over' : 'on'
      }
      return { taskId: t.id, title: t.title, estimate, actualAvg, learned, bias }
    })
}

export function waitingTasks(tasks: Task[]): Task[] {
  return openTasks(tasks).filter((t) => isBlocked(t, tasks) || (t.tags ?? []).some((tag) => ['waiting', 'blocked'].includes(tag.toLowerCase())))
}

export interface FitNowSuggestion {
  minutesFree: number
  tasks: Task[]
  message: string
}

export function tasksThatFitNow(tasks: Task[], minutesFree: number, now = new Date()): FitNowSuggestion {
  const dateISO = toISODate(now)
  const overdue = openTasks(tasks)
    .filter((t) => t.dueDate && t.dueDate < dateISO && !isBlocked(t, tasks))
    .sort((a, b) => scoreTask(b, 'medium', dateISO) - scoreTask(a, 'medium', dateISO))
  const fit = overdue.filter((t) => learnedDuration(t) <= minutesFree).slice(0, 3)
  const n = fit.length
  const message =
    n === 0
      ? `You have ${minutesFree} min free — nothing overdue is small enough to fit.`
      : `You have ${minutesFree} min; ${n === 1 ? 'this overdue task fits' : `these ${n} overdue tasks fit`} now.`
  return { minutesFree, tasks: fit, message }
}

export interface AdaptSuggestion {
  taskId: string
  title: string
  behindMin: number
  toDate: string
  toTime: string
  message: string
}

export function adaptBehindSchedule(tasks: Task[], now = new Date()): AdaptSuggestion | null {
  const dateISO = toISODate(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const open = openTasks(tasks).filter((t) => t.dueDate === dateISO && t.dueTime)
  let behind = 0
  for (const t of open) {
    const start = hhmmToMinutes(t.dueTime!)
    const end = start + learnedDuration(t)
    if (end < nowMin && start < nowMin) behind += Math.min(learnedDuration(t), nowMin - start)
  }
  if (behind < 10) return null
  const candidate = open
    .filter((t) => hhmmToMinutes(t.dueTime!) + 5 < nowMin)
    .sort((a, b) => hhmmToMinutes(b.dueTime!) - hhmmToMinutes(a.dueTime!))[0]
  if (!candidate) return null
  const tomorrow = addDaysISO(dateISO, 1)
  const start = nextFreeStart(tasks, tomorrow, learnedDuration(candidate), DAY_START) ?? DAY_START
  const toTime = minutesToHHMM(start)
  const weekday = parseWeekday(tomorrow)
  return {
    taskId: candidate.id,
    title: candidate.title,
    behindMin: Math.round(behind),
    toDate: tomorrow,
    toTime,
    message: `${Math.round(behind)} min behind — move “${candidate.title}” → ${weekday} ${toTime}`,
  }
}

function parseWeekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12)
  return dt.toLocaleDateString(undefined, { weekday: 'short' })
}

export function routineStreak(tasks: Task[], live: Task): number {
  if (!live.recurrence) return 0
  const title = live.title
  const logs = tasks
    .filter((t) => t.completed && t.completedAt && t.title === title && t.id !== live.id)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const intervalDays = live.recurrence.freq === 'daily' ? live.recurrence.interval : live.recurrence.freq === 'weekly' ? live.recurrence.interval * 7 : live.recurrence.interval * 30
  let streak = 0
  let cursor = live.dueDate ? Date.parse(live.dueDate + 'T12:00:00') : Date.now()
  for (const log of logs) {
    const at = log.completedAt ?? 0
    const expected = cursor - intervalDays * 86400000
    if (Math.abs(at - expected) <= 2 * 86400000 || (log.dueDate && Math.abs(Date.parse(log.dueDate + 'T12:00:00') - expected) <= 2 * 86400000)) {
      streak += 1
      cursor = expected
    } else break
  }
  if (live.completed) streak += 1
  return streak
}

export function briefingText(tasks: Task[], energy: EnergyLevel): { title: string; body: string } {
  const dateISO = todayISO()
  const next = pickNextAction(tasks, energy, dateISO)
  const plan = buildDayPlan(tasks, energy, dateISO)
  const overdue = openTasks(tasks).filter((t) => t.dueDate && t.dueDate < dateISO).length
  const parts = [
    next ? `Next: ${next.task.title}` : 'Inbox is clear',
    `${Math.round(plan.loadMinutes / 60 * 10) / 10}h planned`,
  ]
  if (plan.conflicts.length) parts.push(`${plan.conflicts.length} conflict${plan.conflicts.length === 1 ? '' : 's'}`)
  if (overdue) parts.push(`${overdue} overdue`)
  return { title: 'Morning briefing', body: parts.join(' · ') }
}
