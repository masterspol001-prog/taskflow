import type { Task } from './types'
import { addDaysISO, todayISO } from './dates'
import { isTaskOverdue } from './stats'

export type RecoveryChoice = 'today' | 'tomorrow' | 'later' | 'drop'

export interface RecoveryItem {
  id: string
  title: string
  urgency: 'urgent' | 'soon' | 'park'
  reason: string
  suggested: RecoveryChoice
  consequence: string
  originalDue: string | null
  minutes: number
  priority: number
}

export interface RecoveryPlan {
  items: RecoveryItem[]
  todayCount: number
  todayMinutes: number
  summary: string
}

const TODAY_CAP = 3

function daysLate(dueDate: string, today: string): number {
  const a = Date.parse(`${dueDate}T12:00:00`)
  const b = Date.parse(`${today}T12:00:00`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function effort(task: Task): number {
  return typeof task.estimate === 'number' && task.estimate > 0 ? task.estimate : 30
}

export function classifyRecovery(task: Task, now = new Date()): RecoveryItem {
  const today = todayISO()
  const late = task.dueDate ? daysLate(task.dueDate, today) : 0
  const postponed = task.postponeCount ?? 0
  const minutes = effort(task)

  let urgency: RecoveryItem['urgency'] = 'soon'
  let suggested: RecoveryChoice = 'tomorrow'
  let reason = late ? `${late} day${late === 1 ? '' : 's'} overdue` : 'Open with no fresh date'
  let consequence = 'Moves the due date to tomorrow. Postpone count keeps the slip in history.'

  if (task.important || task.priority >= 4 || (task.priority >= 3 && late >= 2)) {
    urgency = 'urgent'
    suggested = 'today'
    reason = task.important ? 'Marked important' : late >= 2 ? `${late} days late` : 'High priority'
    consequence = 'Sets due to today. Other catch-up should wait so this can finish.'
  } else if (postponed >= 3 && task.priority <= 2) {
    urgency = 'park'
    suggested = 'drop'
    reason = `Postponed ${postponed} times`
    consequence = 'Archives it. Restore from Archived if it still matters.'
  } else if (late >= 7 && task.priority <= 2) {
    urgency = 'park'
    suggested = 'later'
    reason = `${late} days overdue`
    consequence = 'Parks it three days out so today stays realistic.'
  }

  return {
    id: task.id,
    title: task.title,
    urgency,
    reason,
    suggested,
    consequence,
    originalDue: task.dueDate,
    minutes,
    priority: task.priority,
  }
}

export function buildRecoveryPlan(tasks: Task[], now = new Date()): RecoveryPlan {
  const overdue = tasks
    .filter((t) => !t.archived && !t.completed && isTaskOverdue(t, now))
    .sort((a, b) => b.priority - a.priority || (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))

  const classified = overdue.slice(0, 12).map((t) => classifyRecovery(t, now))
  let todayKept = 0
  const items = classified.map((item) => {
    if (item.suggested !== 'today') return item
    todayKept += 1
    if (todayKept <= TODAY_CAP) return item
    return {
      ...item,
      suggested: 'tomorrow' as const,
      consequence: 'Today already has enough catch-up. This waits until tomorrow.',
    }
  })

  const todayItems = items.filter((i) => i.suggested === 'today')
  const todayMinutes = todayItems.reduce((n, i) => n + i.minutes, 0)
  const parked = items.filter((i) => i.suggested === 'drop' || i.suggested === 'later').length
  const summary =
    items.length === 0
      ? 'Nothing overdue.'
      : `Keep ${todayItems.length} today, move ${items.length - todayItems.length - parked} to tomorrow` +
        (parked ? `, park ${parked}` : '') +
        `. About ${todayMinutes} minutes of catch-up if you accept the suggestion.`

  return { items, todayCount: todayItems.length, todayMinutes, summary }
}

export function recoveryPatches(
  tasks: Task[],
  choices: { id: string; choice: RecoveryChoice }[],
  today = todayISO()
): { id: string; patch: Partial<Task> }[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const tomorrow = addDaysISO(today, 1)
  const later = addDaysISO(today, 3)
  const out: { id: string; patch: Partial<Task> }[] = []
  for (const { id, choice } of choices) {
    const task = byId.get(id)
    if (!task || task.completed || task.archived) continue
    if (choice === 'today') {
      out.push({ id, patch: { dueDate: today } })
    } else if (choice === 'tomorrow') {
      out.push({ id, patch: { dueDate: tomorrow, postponeCount: (task.postponeCount ?? 0) + 1 } })
    } else if (choice === 'later') {
      out.push({ id, patch: { dueDate: later, postponeCount: (task.postponeCount ?? 0) + 1 } })
    } else if (choice === 'drop') {
      out.push({ id, patch: { archived: true } })
    }
  }
  return out
}
