import type { Goal, Project, Task } from '@/lib/types'
import { addDaysISO, toISODate } from '@/lib/dates'

export type TimelineKind = 'task' | 'project' | 'goal'

export interface TimelineEvent {
  id: string
  kind: TimelineKind
  title: string
  date: string
  overdue: boolean
  taskId?: string
  projectId?: string
  goalId?: string
  color?: string
  done: boolean
}

export interface TimelineLane {
  key: string
  label: string
  date: string | null
  events: TimelineEvent[]
}

function laneKey(date: string, today: string): string {
  if (date < today) return 'overdue'
  if (date === today) return 'today'
  const week = addDaysISO(today, 7)
  if (date <= week) return 'week'
  const month = addDaysISO(today, 30)
  if (date <= month) return 'month'
  return 'later'
}

function laneLabel(key: string): string {
  if (key === 'overdue') return 'Overdue'
  if (key === 'today') return 'Today'
  if (key === 'week') return 'Next 7 days'
  if (key === 'month') return 'Next 30 days'
  return 'Later'
}

const LANE_ORDER = ['overdue', 'today', 'week', 'month', 'later']

export function buildTimeline(
  tasks: Task[],
  projects: Project[],
  goals: Goal[],
  now = new Date()
): TimelineLane[] {
  const today = toISODate(now)
  const events: TimelineEvent[] = []

  for (const t of tasks) {
    if (t.archived || t.completed || !t.dueDate) continue
    events.push({
      id: `task-${t.id}`,
      kind: 'task',
      title: t.title,
      date: t.dueDate,
      overdue: t.dueDate < today,
      taskId: t.id,
      projectId: t.projectId ?? undefined,
      color: projects.find((p) => p.id === t.projectId)?.color,
      done: false,
    })
  }

  for (const p of projects) {
    if (p.archived || p.status === 'done' || !p.deadline) continue
    events.push({
      id: `project-${p.id}`,
      kind: 'project',
      title: p.name,
      date: p.deadline,
      overdue: p.deadline < today,
      projectId: p.id,
      color: p.color,
      done: false,
    })
  }

  for (const g of goals) {
    if (g.status === 'archived' || g.status === 'completed' || g.status === 'paused' || !g.targetDate) continue
    events.push({
      id: `goal-${g.id}`,
      kind: 'goal',
      title: g.title,
      date: g.targetDate,
      overdue: g.targetDate < today,
      goalId: g.id,
      color: g.color,
      done: false,
    })
  }

  const buckets = new Map<string, TimelineEvent[]>()
  for (const e of events) {
    const key = laneKey(e.date, today)
    const arr = buckets.get(key) ?? []
    arr.push(e)
    buckets.set(key, arr)
  }

  return LANE_ORDER.filter((key) => buckets.has(key)).map((key) => {
    const list = buckets.get(key)!
    list.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    return {
      key,
      label: laneLabel(key),
      date: key === 'today' ? today : null,
      events: list,
    }
  })
}
