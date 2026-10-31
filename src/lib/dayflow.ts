import type { EnergyLevel, Goal, Task } from '@/lib/types'
import { addDaysISO, todayISO } from '@/lib/dates'
import { planToday } from '@/lib/rank'

export type SnoozeKind = 'later' | 'tomorrow' | 'week'

export type ShutdownChoice = 'tomorrow' | 'keep' | 'drop'

export type MorningChoice = 'commit' | 'later' | 'park'

export interface SnoozePatch {
  dueDate: string | null
  dueTime: string | null
  snoozeUntil: string | null
  postponeCount: number
}

export interface ShutdownItem {
  id: string
  title: string
  minutes: number
  why: string
}

export interface ShutdownPlan {
  date: string
  leftover: ShutdownItem[]
  done: number
  planned: number
  summary: string
}

export function isSnoozed(task: Task, nowISO = todayISO()): boolean {
  return !!task.snoozeUntil && task.snoozeUntil > nowISO
}

export function isWaitingOn(task: Task): boolean {
  return !!(task.waitingOn && task.waitingOn.trim())
}

export function isParked(task: Task): boolean {
  return task.parked === true
}

export function snoozePatch(task: Task, kind: SnoozeKind, nowISO = todayISO(), now = new Date()): SnoozePatch {
  const postponeCount = (task.postponeCount ?? 0) + 1
  if (kind === 'later') {
    const hour = now.getHours()
    const nextHour = Math.min(22, hour + 2)
    const dueTime = `${String(nextHour).padStart(2, '0')}:00`
    return {
      dueDate: nowISO,
      dueTime,
      snoozeUntil: null,
      postponeCount,
    }
  }
  if (kind === 'week') {
    const dueDate = addDaysISO(nowISO, 7)
    return { dueDate, dueTime: null, snoozeUntil: dueDate, postponeCount }
  }
  const dueDate = addDaysISO(nowISO, 1)
  return { dueDate, dueTime: null, snoozeUntil: dueDate, postponeCount }
}

export function snoozeLabel(kind: SnoozeKind): string {
  if (kind === 'later') return 'Later today'
  if (kind === 'week') return 'Next week'
  return 'Tomorrow'
}

export function committedIdsForToday(settings: { committedDate?: string | null; committedTaskIds?: string[] }, nowISO = todayISO()): string[] {
  if (settings.committedDate !== nowISO) return []
  return Array.isArray(settings.committedTaskIds) ? settings.committedTaskIds : []
}

export function buildShutdown(
  tasks: Task[],
  goals: Goal[],
  energy: EnergyLevel,
  settings: { committedDate?: string | null; committedTaskIds?: string[] },
  nowISO = todayISO()
): ShutdownPlan {
  const committed = new Set(committedIdsForToday(settings, nowISO))
  const plan = planToday(tasks, goals, energy, nowISO)
  const plannedIds = new Set([...plan.must, ...plan.should].map((r) => r.task.id))
  const leftoverTasks = tasks.filter((t) => {
    if (t.archived || t.completed || isParked(t)) return false
    if (isSnoozed(t, nowISO)) return false
    if (committed.has(t.id)) return true
    if (t.dueDate === nowISO && !isWaitingOn(t)) return true
    return plannedIds.has(t.id)
  })
  const leftover: ShutdownItem[] = leftoverTasks.map((t) => ({
    id: t.id,
    title: t.title,
    minutes: t.estimate ?? 0,
    why: committed.has(t.id) ? 'committed' : t.dueDate === nowISO ? 'due today' : 'still open',
  }))
  const done = tasks.filter((t) => t.completed && t.dueDate === nowISO).length
  const planned = Math.max(committed.size, plannedIds.size, done + leftover.length)
  const summary =
    leftover.length === 0
      ? done > 0
        ? `${done} finished. Today is clear.`
        : 'Nothing left to shut down.'
      : `${leftover.length} still open. Park them for tomorrow, keep them, or drop them.`
  return { date: nowISO, leftover, done, planned, summary }
}

export function shutdownPatch(choice: ShutdownChoice, nowISO = todayISO()): Partial<Task> {
  if (choice === 'drop') return { archived: true, committedDate: null, snoozeUntil: null, parked: false }
  if (choice === 'keep') return { committedDate: nowISO, snoozeUntil: null, parked: false }
  const tomorrow = addDaysISO(nowISO, 1)
  return {
    dueDate: tomorrow,
    dueTime: null,
    committedDate: tomorrow,
    snoozeUntil: null,
    postponeCount: undefined,
    parked: false,
  }
}

export interface MorningItem {
  id: string
  title: string
  minutes: number
  why: string
}

export interface MorningPlan {
  date: string
  candidates: MorningItem[]
  leftoverFromYesterday: number
  summary: string
}

export function buildMorning(
  tasks: Task[],
  goals: Goal[],
  energy: EnergyLevel,
  settings: { committedDate?: string | null; committedTaskIds?: string[]; lastShutdownDate?: string | null; lastMorningDate?: string | null },
  nowISO = todayISO()
): MorningPlan {
  const already = settings.lastMorningDate === nowISO
  const plan = planToday(tasks, goals, energy, nowISO)
  const ranked = [...plan.must, ...plan.should]
  const seen = new Set<string>()
  const candidates: MorningItem[] = []
  for (const row of ranked) {
    const t = row.task
    if (seen.has(t.id)) continue
    if (isParked(t) || isSnoozed(t, nowISO) || isWaitingOn(t)) continue
    seen.add(t.id)
    candidates.push({
      id: t.id,
      title: t.title,
      minutes: row.minutes,
      why: row.why[0] ?? (t.dueDate === nowISO ? 'due today' : 'ranked'),
    })
    if (candidates.length >= 5) break
  }
  if (candidates.length < 3) {
    for (const t of tasks) {
      if (candidates.length >= 5) break
      if (t.archived || t.completed || isParked(t) || isSnoozed(t, nowISO) || isWaitingOn(t)) continue
      if (seen.has(t.id)) continue
      if (t.dueDate === nowISO || (t.dueDate && t.dueDate < nowISO)) {
        seen.add(t.id)
        candidates.push({
          id: t.id,
          title: t.title,
          minutes: t.estimate ?? 0,
          why: t.dueDate && t.dueDate < nowISO ? 'overdue' : 'due today',
        })
      }
    }
  }
  const leftoverFromYesterday = tasks.filter((t) => {
    if (t.archived || t.completed || isParked(t)) return false
    return t.committedDate && t.committedDate < nowISO && !t.completed
  }).length
  const summary = already
    ? 'Morning already started today.'
    : candidates.length === 0
      ? 'Nothing obvious to commit. Capture, or pull from Someday.'
      : leftoverFromYesterday
        ? `${candidates.length} to commit. ${leftoverFromYesterday} carried from yesterday.`
        : `${candidates.length} to commit. Lock a small set, snooze the rest, or park it.`
  return { date: nowISO, candidates, leftoverFromYesterday, summary }
}

export function morningPatch(choice: MorningChoice, nowISO = todayISO()): Partial<Task> {
  if (choice === 'park') {
    return { parked: true, committedDate: null, snoozeUntil: null, dueDate: null, dueTime: null }
  }
  if (choice === 'later') {
    const later = addDaysISO(nowISO, 1)
    return { dueDate: later, dueTime: null, snoozeUntil: later, committedDate: null, parked: false }
  }
  return { dueDate: nowISO, snoozeUntil: null, committedDate: nowISO, parked: false }
}

export function parkPatch(): Partial<Task> {
  return { parked: true, committedDate: null, snoozeUntil: null, dueDate: null, dueTime: null }
}

export function unparkPatch(nowISO = todayISO()): Partial<Task> {
  return { parked: false, dueDate: nowISO, snoozeUntil: null }
}
