import type {
  AchievementId,
  AchievementUnlock,
  FocusSession,
  Goal,
  PersonalRecords,
  ProgressState,
  Settings,
  StreakRule,
  Task,
  XpEvent,
} from '@/lib/types'
import { addDaysISO, todayISO, toISODate, parseISODate, startOfWeekISO, uid } from '@/lib/dates'
import { computeBestStreak, computeStreak, countCompletedOnDate, isTaskOverdue } from '@/lib/stats'

export const XP = {
  task: 10,
  highPriority: 20,
  overdue: 15,
  focus: 25,
  dailyPlan: 10,
  weeklyGoal: 100,
} as const

export const LEVEL_TITLES = ['Beginner', 'Consistent', 'Focused', 'Productive', 'Elite'] as const

export interface LevelInfo {
  level: number
  title: string
  xpIntoLevel: number
  xpForLevel: number
  totalXp: number
  pct: number
}

/** Level n (1-based) requires n * 300 XP to complete. */
export function xpForLevel(level: number): number {
  return Math.max(1, level) * 300
}

export function totalXpToReach(level: number): number {
  let sum = 0
  for (let i = 1; i < level; i++) sum += xpForLevel(i)
  return sum
}

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp))
  let remaining = xp
  let level = 1
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level)
    level += 1
    if (level > 200) break
  }
  const need = xpForLevel(level)
  const titleIndex = Math.min(LEVEL_TITLES.length - 1, Math.max(0, level - 1))
  const title = level <= LEVEL_TITLES.length ? LEVEL_TITLES[titleIndex] : `Elite ${level - 4}`
  return {
    level,
    title,
    xpIntoLevel: remaining,
    xpForLevel: need,
    totalXp: xp,
    pct: need ? Math.min(100, Math.round((remaining / need) * 100)) : 100,
  }
}

export function emptyRecords(): PersonalRecords {
  return {
    mostTasksInDay: 0,
    mostTasksInDayDate: null,
    longestStreak: 0,
    mostFocusMinutesInDay: 0,
    mostFocusMinutesDate: null,
    mostPriorityInDay: 0,
    bestCompletionPct: 0,
    mostProductiveWeek: 0,
    fastestTaskMinutes: null,
  }
}

export function emptyProgress(): ProgressState {
  return {
    xp: 0,
    events: [],
    achievements: [],
    sessions: [],
    records: emptyRecords(),
    streakFreezes: 0,
    freezeUsedDates: [],
    lastFreezeEarnedAt: 0,
    lastActiveDate: null,
    lastGapDays: 0,
  }
}

export function normalizeProgress(raw: Partial<ProgressState> | null | undefined): ProgressState {
  const base = emptyProgress()
  if (!raw || typeof raw !== 'object') return base
  const rec = (raw.records && typeof raw.records === 'object' ? raw.records : {}) as Partial<PersonalRecords>
  return {
    xp: Number.isFinite(raw.xp) ? Math.max(0, Number(raw.xp)) : 0,
    events: Array.isArray(raw.events) ? raw.events.filter(isXpEvent) : [],
    achievements: Array.isArray(raw.achievements) ? raw.achievements.filter(isUnlock) : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions.filter(isSession) : [],
    records: {
      ...emptyRecords(),
      ...rec,
      mostTasksInDay: num(rec.mostTasksInDay, 0),
      longestStreak: num(rec.longestStreak, 0),
      mostFocusMinutesInDay: num(rec.mostFocusMinutesInDay, 0),
      mostPriorityInDay: num(rec.mostPriorityInDay, 0),
      bestCompletionPct: num(rec.bestCompletionPct, 0),
      mostProductiveWeek: num(rec.mostProductiveWeek, 0),
      fastestTaskMinutes: rec.fastestTaskMinutes == null ? null : num(rec.fastestTaskMinutes, 0),
      mostTasksInDayDate: rec.mostTasksInDayDate ?? null,
      mostFocusMinutesDate: rec.mostFocusMinutesDate ?? null,
    },
    streakFreezes: Math.max(0, Math.floor(num(raw.streakFreezes, 0))),
    freezeUsedDates: Array.isArray(raw.freezeUsedDates) ? raw.freezeUsedDates.filter((d) => typeof d === 'string') : [],
    lastFreezeEarnedAt: num(raw.lastFreezeEarnedAt, 0),
    lastActiveDate: typeof raw.lastActiveDate === 'string' ? raw.lastActiveDate : null,
    lastGapDays: Math.max(0, Math.floor(num(raw.lastGapDays, 0))),
  }
}

function num(v: unknown, fallback: number): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function isXpEvent(e: unknown): e is XpEvent {
  if (!e || typeof e !== 'object') return false
  const x = e as XpEvent
  return typeof x.id === 'string' && typeof x.source === 'string' && typeof x.sourceId === 'string' && Number.isFinite(x.amount)
}

function isUnlock(e: unknown): e is AchievementUnlock {
  if (!e || typeof e !== 'object') return false
  const x = e as AchievementUnlock
  return typeof x.id === 'string' && Number.isFinite(x.unlockedAt)
}

function isSession(e: unknown): e is FocusSession {
  if (!e || typeof e !== 'object') return false
  const x = e as FocusSession
  return typeof x.id === 'string' && Number.isFinite(x.minutes) && Number.isFinite(x.completedAt)
}

export function eventKey(source: XpEvent['source'], sourceId: string): string {
  return `${source}:${sourceId}`
}

export function hasEvent(progress: ProgressState, source: XpEvent['source'], sourceId: string): boolean {
  const key = eventKey(source, sourceId)
  return progress.events.some((e) => eventKey(e.source, e.sourceId) === key)
}

export function taskXpAmount(task: Task, now = new Date()): number {
  if (task.priority >= 3 || task.important) return XP.highPriority
  if (task.dueDate) {
    const d = parseISODate(task.dueDate)
    if (d) {
      d.setHours(23, 59, 59, 999)
      if (d.getTime() < now.getTime()) return XP.overdue
    }
  }
  return XP.task
}

export function creditXp(
  progress: ProgressState,
  source: XpEvent['source'],
  sourceId: string,
  amount: number,
  at = Date.now()
): { progress: ProgressState; awarded: number } {
  if (amount <= 0 || hasEvent(progress, source, sourceId)) {
    return { progress, awarded: 0 }
  }
  const ev: XpEvent = { id: eventKey(source, sourceId), source, sourceId, amount, at }
  return {
    progress: {
      ...progress,
      xp: progress.xp + amount,
      events: [...progress.events, ev],
    },
    awarded: amount,
  }
}

export interface AchievementDef {
  id: AchievementId
  title: string
  description: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-task', title: 'First Task', description: 'Complete your first task.' },
  { id: 'streak-3', title: '3-Day Streak', description: 'Complete tasks three days in a row.' },
  { id: 'streak-7', title: '7-Day Streak', description: 'Maintain a seven-day streak.' },
  { id: 'speed-runner', title: 'Speed Runner', description: 'Complete 10 tasks in one day.' },
  { id: 'priority-master', title: 'Priority Master', description: 'Complete all priority tasks for a day.' },
  { id: 'deep-focus', title: 'Deep Focus', description: 'Complete five focus sessions.' },
  { id: 'consistency-king', title: 'Consistency King', description: 'Complete tasks for 30 days.' },
  { id: 'perfect-day', title: 'Perfect Day', description: 'Complete every planned task.' },
  { id: 'comeback', title: 'Comeback', description: 'Return after a gap and finish today’s plan.' },
  { id: 'century', title: 'Century', description: 'Complete 100 tasks.' },
]

export function isUnlocked(progress: ProgressState, id: AchievementId): boolean {
  return progress.achievements.some((a) => a.id === id)
}

export function unlockAchievement(progress: ProgressState, id: AchievementId, at = Date.now()): ProgressState {
  if (isUnlocked(progress, id)) return progress
  return {
    ...progress,
    achievements: [...progress.achievements, { id, unlockedAt: at }],
  }
}

export function plannedToday(tasks: Task[], dateISO: string): Task[] {
  return tasks.filter((t) => !t.archived && t.dueDate === dateISO)
}

export function completedOn(tasks: Task[], dateISO: string): Task[] {
  return tasks.filter((t) => t.completed && t.completedAt && !t.archived && toISODate(new Date(t.completedAt)) === dateISO)
}

export function dayQualifies(tasks: Task[], dateISO: string, rule: StreakRule, now = new Date()): boolean {
  const done = completedOn(tasks, dateISO)
  if (rule === 'any-task') return done.length >= 1
  const planned = plannedToday(tasks, dateISO)
  if (rule === 'daily-goal') {
    const open = planned.filter((t) => !t.completed)
    return planned.length > 0 && open.length === 0
  }
  const priority = tasks.filter((t) => {
    if (t.archived) return false
    const isPri = t.priority >= 3 || t.important
    if (!isPri) return false
    if (t.dueDate === dateISO) return true
    if (t.completed && t.completedAt && toISODate(new Date(t.completedAt)) === dateISO) return true
    if (!t.completed && t.dueDate && isTaskOverdue(t, now) && dateISO === todayISO()) return true
    return false
  })
  if (priority.length === 0) return done.length >= 1
  return priority.every((t) => t.completed)
}

export function streakDays(tasks: Task[], rule: StreakRule, freezeUsed: string[], now = new Date()): string[] {
  const today = toISODate(now)
  const freeze = new Set(freezeUsed)
  const cursor = parseISODate(today)
  if (!cursor) return []
  if (!dayQualifies(tasks, today, rule, now) && !freeze.has(today)) cursor.setDate(cursor.getDate() - 1)
  const out: string[] = []
  for (let i = 0; i < 400; i++) {
    const iso = toISODate(cursor)
    if (dayQualifies(tasks, iso, rule, now) || freeze.has(iso)) {
      out.push(iso)
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return out
}

export function computeRuleStreak(tasks: Task[], rule: StreakRule, freezeUsed: string[], now = new Date()): number {
  if (rule === 'any-task' && freezeUsed.length === 0) return computeStreak(tasks)
  return streakDays(tasks, rule, freezeUsed, now).length
}

export function activityCalendar(
  tasks: Task[],
  sessions: FocusSession[],
  days = 84,
  now = new Date()
): { date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 }[] {
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (!t.completed || !t.completedAt || t.archived) continue
    const key = toISODate(new Date(t.completedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const s of sessions) {
    const key = toISODate(new Date(s.completedAt))
    counts.set(key, (counts.get(key) ?? 0) + Math.max(1, Math.round(s.minutes / 25)))
  }
  const out: { date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 }[] = []
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = toISODate(d)
    const count = counts.get(iso) ?? 0
    const intensity: 0 | 1 | 2 | 3 | 4 = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4
    out.push({ date: iso, count, intensity })
  }
  return out
}

export function focusMinutesOn(sessions: FocusSession[], dateISO: string): number {
  return sessions
    .filter((s) => toISODate(new Date(s.completedAt)) === dateISO)
    .reduce((n, s) => n + s.minutes, 0)
}

export function focusMinutesOnTasks(tasks: Task[], dateISO: string): number {
  let n = 0
  for (const t of tasks) {
    const hist = t.actualMinutes ?? []
    if (!hist.length) continue
    if (t.completed && t.completedAt && toISODate(new Date(t.completedAt)) === dateISO) {
      n += hist[hist.length - 1]
    } else if (!t.completed) {
      n += hist.reduce((a, b) => a + b, 0)
    }
  }
  return n
}

export function weekCompletedCount(tasks: Task[], weekStartISO: string): number {
  let n = 0
  const end = addDaysISO(weekStartISO, 6)
  for (const t of tasks) {
    if (!t.completed || !t.completedAt || t.archived) continue
    const d = toISODate(new Date(t.completedAt))
    if (d >= weekStartISO && d <= end) n += 1
  }
  return n
}

export function todayCompletionPct(tasks: Task[], dateISO: string): number {
  const planned = plannedToday(tasks, dateISO)
  if (!planned.length) {
    const done = completedOn(tasks, dateISO).length
    return done > 0 ? 100 : 0
  }
  const done = planned.filter((t) => t.completed).length
  return Math.round((done / planned.length) * 100)
}

export function estimatedRemainingMinutes(tasks: Task[], dateISO: string): number {
  return plannedToday(tasks, dateISO)
    .filter((t) => !t.completed)
    .reduce((n, t) => n + (typeof t.estimate === 'number' && t.estimate > 0 ? t.estimate : 30), 0)
}

export function todayPriorityBreakdown(tasks: Task[], dateISO: string): Record<number, { open: number; done: number }> {
  const out: Record<number, { open: number; done: number }> = {
    1: { open: 0, done: 0 },
    2: { open: 0, done: 0 },
    3: { open: 0, done: 0 },
    4: { open: 0, done: 0 },
  }
  for (const t of plannedToday(tasks, dateISO)) {
    const bucket = out[t.priority] ?? out[2]
    if (t.completed) bucket.done += 1
    else bucket.open += 1
  }
  return out
}

function maybeEarnFreeze(progress: ProgressState, streak: number, at: number): ProgressState {
  if (streak < 7) return progress
  if (at - (progress.lastFreezeEarnedAt || 0) < 7 * 86400000) return progress
  if (progress.streakFreezes >= 2) return progress
  return { ...progress, streakFreezes: progress.streakFreezes + 1, lastFreezeEarnedAt: at }
}

export function maybeUseFreeze(progress: ProgressState, tasks: Task[], rule: StreakRule, now = new Date()): ProgressState {
  const today = toISODate(now)
  if (dayQualifies(tasks, today, rule, now)) return progress
  const yesterday = addDaysISO(today, -1)
  if (!dayQualifies(tasks, yesterday, rule, now) && !progress.freezeUsedDates.includes(yesterday)) {
    if (progress.streakFreezes > 0 && !progress.freezeUsedDates.includes(yesterday)) {
      return {
        ...progress,
        streakFreezes: progress.streakFreezes - 1,
        freezeUsedDates: [...progress.freezeUsedDates, yesterday],
      }
    }
  }
  return progress
}

export function updateRecords(progress: ProgressState, tasks: Task[], dateISO: string, now = new Date()): PersonalRecords {
  const rec = { ...progress.records }
  const doneToday = completedOn(tasks, dateISO).length
  if (doneToday > rec.mostTasksInDay) {
    rec.mostTasksInDay = doneToday
    rec.mostTasksInDayDate = dateISO
  }
  const priToday = completedOn(tasks, dateISO).filter((t) => t.priority >= 3 || t.important).length
  rec.mostPriorityInDay = Math.max(rec.mostPriorityInDay, priToday)
  const pct = todayCompletionPct(tasks, dateISO)
  rec.bestCompletionPct = Math.max(rec.bestCompletionPct, pct)
  const streak = computeBestStreak(tasks)
  rec.longestStreak = Math.max(rec.longestStreak, streak, computeStreak(tasks))
  const focus = focusMinutesOn(progress.sessions, dateISO) + focusMinutesOnTasks(tasks, dateISO)
  if (focus > rec.mostFocusMinutesInDay) {
    rec.mostFocusMinutesInDay = focus
    rec.mostFocusMinutesDate = dateISO
  }
  const weekStart = startOfWeekISO(true)
  rec.mostProductiveWeek = Math.max(rec.mostProductiveWeek, weekCompletedCount(tasks, weekStart))
  for (const t of completedOn(tasks, dateISO)) {
    const mins = (t.actualMinutes ?? []).reduce((a, b) => a + b, 0)
    if (mins > 0 && (rec.fastestTaskMinutes == null || mins < rec.fastestTaskMinutes)) {
      rec.fastestTaskMinutes = mins
    }
  }
  void now
  return rec
}

export interface RewardPulse {
  xpAwarded: number
  newAchievements: AchievementId[]
  leveledUp: boolean
  prevLevel: number
  nextLevel: number
  streak: number
  recordBroken: string | null
  confetti: boolean
  toastTitle: string
  toastMessage?: string
}

export function applyTaskComplete(
  progress: ProgressState,
  tasks: Task[],
  task: Task,
  settings: Pick<Settings, 'streakRule'>,
  now = new Date()
): { progress: ProgressState; pulse: RewardPulse } {
  const dateISO = toISODate(now)
  const prevLevel = levelFromXp(progress.xp).level
  const sourceId = task.id
  const amount = taskXpAmount(task, now)
  let next = creditXp(progress, 'task', sourceId, amount, now.getTime()).progress
  next = { ...next, lastActiveDate: dateISO }

  const prevDate = progress.lastActiveDate
  if (prevDate) {
    const gap = Math.max(0, Math.round((parseISODate(dateISO)!.getTime() - parseISODate(prevDate)!.getTime()) / 86400000))
    next = { ...next, lastGapDays: gap }
  }

  const planned = plannedToday(tasks, dateISO)
  const remainingPlan = planned.filter((t) => t.id !== task.id && !t.completed)
  if (planned.length > 0 && remainingPlan.length === 0) {
    next = creditXp(next, 'plan', dateISO, XP.dailyPlan, now.getTime()).progress
  }

  next = { ...next, records: updateRecords(next, tasks, dateISO, now) }
  const streak = computeRuleStreak(tasks, settings.streakRule ?? 'any-task', next.freezeUsedDates, now)
  next = maybeEarnFreeze(next, streak, now.getTime())

  const unlocked = detectAchievements(next, tasks, settings.streakRule ?? 'any-task', dateISO, now)
  const fresh = unlocked.filter((id) => !isUnlocked(progress, id))
  for (const id of fresh) next = unlockAchievement(next, id, now.getTime())

  const afterLevel = levelFromXp(next.xp).level
  const leveledUp = afterLevel > prevLevel
  const awarded = next.xp - progress.xp
  const recordBroken =
    next.records.mostTasksInDay > progress.records.mostTasksInDay
      ? 'Most tasks in a day'
      : next.records.longestStreak > progress.records.longestStreak
      ? 'Longest streak'
      : null

  const confetti = leveledUp || fresh.includes('perfect-day') || fresh.includes('streak-7') || fresh.includes('century') || fresh.includes('consistency-king')
  const toastTitle = leveledUp ? `Level ${afterLevel}` : awarded > 0 ? `+${awarded} XP` : 'Done'
  const bits = [
    awarded > 0 ? `+${awarded} XP` : null,
    streak > 1 ? `Streak: ${streak} days` : null,
    fresh[0] ? ACHIEVEMENTS.find((a) => a.id === fresh[0])?.title : null,
  ].filter(Boolean)

  return {
    progress: next,
    pulse: {
      xpAwarded: awarded,
      newAchievements: fresh,
      leveledUp,
      prevLevel,
      nextLevel: afterLevel,
      streak,
      recordBroken,
      confetti,
      toastTitle,
      toastMessage: bits.join(' · ') || undefined,
    },
  }
}

export function applyFocusSession(
  progress: ProgressState,
  taskId: string | null,
  minutes: number,
  tasks: Task[],
  now = new Date(),
  sessionId = uid('focus-')
): { progress: ProgressState; pulse: RewardPulse } {
  if (minutes < 1) {
    return {
      progress,
      pulse: emptyPulse(progress),
    }
  }
  const at = now.getTime()
  if (progress.sessions.some((s) => s.id === sessionId)) {
    return { progress, pulse: emptyPulse(progress) }
  }
  const prevLevel = levelFromXp(progress.xp).level
  const session: FocusSession = { id: sessionId, taskId, minutes, completedAt: at }
  let next: ProgressState = { ...progress, sessions: [...progress.sessions, session] }
  next = creditXp(next, 'focus', sessionId, XP.focus, at).progress
  const dateISO = toISODate(now)
  next = { ...next, records: updateRecords(next, tasks, dateISO, now), lastActiveDate: dateISO }
  const unlocked = detectAchievements(next, tasks, 'any-task', dateISO, now)
  const fresh = unlocked.filter((id) => !isUnlocked(progress, id))
  for (const id of fresh) next = unlockAchievement(next, id, at)
  const afterLevel = levelFromXp(next.xp).level
  return {
    progress: next,
    pulse: {
      xpAwarded: next.xp - progress.xp,
      newAchievements: fresh,
      leveledUp: afterLevel > prevLevel,
      prevLevel,
      nextLevel: afterLevel,
      streak: computeStreak(tasks),
      recordBroken: next.records.mostFocusMinutesInDay > progress.records.mostFocusMinutesInDay ? 'Most focus minutes' : null,
      confetti: afterLevel > prevLevel || fresh.includes('deep-focus'),
      toastTitle: 'Focus session complete',
      toastMessage: `+${XP.focus} XP · ${minutes} min focused`,
    },
  }
}

export function applyGoalComplete(
  progress: ProgressState,
  goal: Pick<Goal, 'id' | 'horizon'>,
  now = new Date()
): ProgressState {
  if (goal.horizon !== 'week') return progress
  return creditXp(progress, 'goal', goal.id, XP.weeklyGoal, now.getTime()).progress
}

export function backfillFromHistory(
  progress: ProgressState,
  tasks: Task[],
  settings: Pick<Settings, 'streakRule'>,
  now = new Date()
): ProgressState {
  if (progress.events.length > 0 || progress.xp > 0) return progress
  const completed = tasks.filter((t) => t.completed && !t.archived)
  if (completed.length === 0 && progress.sessions.length === 0) return progress
  let next = progress
  for (const t of completed) {
    const when = t.completedAt ? new Date(t.completedAt) : now
    next = creditXp(next, 'task', t.id, taskXpAmount(t, when), when.getTime()).progress
  }
  const dateISO = toISODate(now)
  next = {
    ...next,
    records: updateRecords(next, tasks, dateISO, now),
    lastActiveDate: completed.length
      ? toISODate(new Date(Math.max(...completed.map((t) => t.completedAt ?? 0))))
      : next.lastActiveDate,
  }
  const unlocked = detectAchievements(next, tasks, settings.streakRule ?? 'any-task', dateISO, now)
  for (const id of unlocked) next = unlockAchievement(next, id, 0)
  return next
}

function emptyPulse(progress: ProgressState): RewardPulse {
  const lvl = levelFromXp(progress.xp)
  return {
    xpAwarded: 0,
    newAchievements: [],
    leveledUp: false,
    prevLevel: lvl.level,
    nextLevel: lvl.level,
    streak: 0,
    recordBroken: null,
    confetti: false,
    toastTitle: 'Done',
  }
}

export function detectAchievements(
  progress: ProgressState,
  tasks: Task[],
  rule: StreakRule,
  dateISO: string,
  now = new Date()
): AchievementId[] {
  const found: AchievementId[] = []
  const completedAll = tasks.filter((t) => t.completed && !t.archived)
  if (completedAll.length >= 1) found.push('first-task')
  if (completedAll.length >= 100) found.push('century')
  const streak = computeRuleStreak(tasks, rule, progress.freezeUsedDates, now)
  if (streak >= 3) found.push('streak-3')
  if (streak >= 7) found.push('streak-7')
  if (streak >= 30) found.push('consistency-king')
  if (completedOn(tasks, dateISO).length >= 10) found.push('speed-runner')
  const planned = plannedToday(tasks, dateISO)
  if (planned.length > 0 && planned.every((t) => t.completed)) found.push('perfect-day')
  const pri = planned.filter((t) => t.priority >= 3 || t.important)
  if (pri.length > 0 && pri.every((t) => t.completed)) found.push('priority-master')
  if (progress.sessions.length >= 5) found.push('deep-focus')
  if ((progress.lastGapDays ?? 0) >= 3 && planned.length > 0 && planned.every((t) => t.completed)) found.push('comeback')
  return found
}

export function productivityBreakdown(tasks: Task[]): {
  completion: number
  priority: number
  consistency: number
  focus: number
  deadlines: number
  planning: number
  score: number
  summary: string
} {
  const visible = tasks.filter((t) => !t.archived)
  const today = todayISO()
  const planned = plannedToday(visible, today)
  const dueDone = planned.filter((t) => t.completed).length
  const completion = planned.length ? Math.round((dueDone / planned.length) * 100) : completedOn(visible, today).length > 0 ? 100 : 0
  const pri = planned.filter((t) => t.priority >= 3 || t.important)
  const priority = pri.length ? Math.round((pri.filter((t) => t.completed).length / pri.length) * 100) : completion
  const streak = computeStreak(visible)
  const consistency = Math.min(100, streak * 14)
  const logged = focusMinutesOnTasks(visible, today)
  const plannedMin = planned.reduce((n, t) => n + (typeof t.estimate === 'number' && t.estimate > 0 ? t.estimate : 30), 0)
  const focus = plannedMin ? Math.min(100, Math.round((logged / plannedMin) * 100)) : logged > 0 ? 100 : 0
  const overdue = visible.filter((t) => isTaskOverdue(t)).length
  const deadlines = overdue === 0 ? 100 : Math.max(0, 100 - overdue * 12)
  const planning = planned.length >= 1 ? 100 : 35
  const score = Math.round(completion * 0.3 + priority * 0.2 + consistency * 0.15 + focus * 0.15 + deadlines * 0.1 + planning * 0.1)
  const summary =
    pri.length > 0
      ? `You completed ${priority}% of today’s priority tasks.`
      : planned.length > 0
      ? `You completed ${completion}% of today’s planned tasks.`
      : completedOn(visible, today).length > 0
      ? 'You finished work that wasn’t on the plan. Nice.'
      : 'Plan one meaningful task to start the score.'
  return { completion, priority, consistency, focus, deadlines, planning, score, summary }
}

export function categoryPerformance(tasks: Task[]): { tag: string; done: number; open: number }[] {
  const map = new Map<string, { done: number; open: number }>()
  for (const t of tasks) {
    if (t.archived) continue
    const tags = t.tags.length ? t.tags : ['untagged']
    for (const tag of tags) {
      const row = map.get(tag) ?? { done: 0, open: 0 }
      if (t.completed) row.done += 1
      else row.open += 1
      map.set(tag, row)
    }
  }
  return [...map.entries()]
    .map(([tag, v]) => ({ tag, ...v }))
    .sort((a, b) => b.done - a.done)
}

export function peakProductivity(tasks: Task[]): { weekday: string; hour: string | null } {
  const byDay = new Array(7).fill(0)
  const byHour = new Array(24).fill(0)
  let hourHits = 0
  for (const t of tasks) {
    if (!t.completed || !t.completedAt || t.archived) continue
    const d = new Date(t.completedAt)
    byDay[d.getDay()] += 1
    byHour[d.getHours()] += 1
    hourHits += 1
  }
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  let bestDay = 1
  for (let i = 0; i < 7; i++) if (byDay[i] > byDay[bestDay]) bestDay = i
  let bestHour = 9
  for (let i = 0; i < 24; i++) if (byHour[i] > byHour[bestHour]) bestHour = i
  return {
    weekday: byDay.some((n) => n > 0) ? dayNames[bestDay] : '—',
    hour: hourHits > 0 ? `${String(bestHour).padStart(2, '0')}:00` : null,
  }
}

export function dailySeries(tasks: Task[], days = 14, now = new Date()): { date: string; count: number; label: string }[] {
  const out: { date: string; count: number; label: string }[] = []
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = toISODate(d)
    out.push({
      date: iso,
      count: countCompletedOnDate(tasks, iso),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
    })
  }
  return out
}

export function weeklySeries(tasks: Task[], weeks = 8, now = new Date()): { start: string; count: number; label: string }[] {
  const out: { start: string; count: number; label: string }[] = []
  const cursor = parseISODate(startOfWeekISO(true)) ?? now
  cursor.setDate(cursor.getDate() - (weeks - 1) * 7)
  for (let i = 0; i < weeks; i++) {
    const d = new Date(cursor)
    d.setDate(cursor.getDate() + i * 7)
    const iso = toISODate(d)
    out.push({
      start: iso,
      count: weekCompletedCount(tasks, iso),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    })
  }
  return out
}

export function focusTrend(sessions: FocusSession[], tasks: Task[], days = 7, now = new Date()): { date: string; minutes: number; label: string }[] {
  const out: { date: string; minutes: number; label: string }[] = []
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = toISODate(d)
    out.push({
      date: iso,
      minutes: focusMinutesOn(sessions, iso) + focusMinutesOnTasks(tasks, iso),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
    })
  }
  return out
}
