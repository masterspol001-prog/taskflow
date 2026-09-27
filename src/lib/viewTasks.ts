import type { Task } from '@/lib/types'
import { parseISODate, todayISO } from '@/lib/dates'
import { isTaskOverdue } from '@/lib/stats'

export interface TaskGroup {
  key: string
  label: string
  /** date for grouping headers, null for non-date groups */
  date?: string | null
  projectId?: string | null
  section?: string | null
  tasks: Task[]
}

export function groupByDay(tasks: Task[], withNoDate = true): TaskGroup[] {
  const map = new Map<string, Task[]>()
  const sorted = [...tasks].sort((a, b) => {
    if (!a.dueDate) return 1
    if (!b.dueDate) return -1
    return a.dueDate.localeCompare(b.dueDate) || a.sortOrder - b.sortOrder
  })
  for (const t of sorted) {
    const key = t.dueDate ?? 'no-date'
    const arr = map.get(key) ?? []
    arr.push(t)
    map.set(key, arr)
  }
  const today = todayISO()
  const order = [...map.keys()].sort((x, y) => {
    if (x === 'no-date') return 1
    if (y === 'no-date') return -1
    if (isOverdue(x)) {
      if (isOverdue(y)) return y.localeCompare(x)
      return -1
    }
    if (isOverdue(y)) return 1
    return x.localeCompare(y)
  })

  return order.flatMap((key) => {
    const group = map.get(key)!
    if (key === 'no-date' && !withNoDate) return []
    const date = key === 'no-date' ? null : key
    const label = keyLabel(key, today)
    return [{ key, label, date, tasks: group }]
  })
}

function isOverdue(iso: string): boolean {
  return iso < todayISO()
}

function keyLabel(key: string, today: string): string {
  if (key === 'no-date') return 'No date'
  if (key === today) return 'Today'
  if (key === addDays(today, 1)) return 'Tomorrow'
  const d = parseISODate(key)
  if (!d) return key
  if (isOverdue(key)) return `Overdue · ${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
  const days = diffDays(today, key)
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function addDays(iso: string, n: number): string {
  const d = parseISODate(iso) ?? new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function diffDays(a: string, b: string): number {
  const da = parseISODate(a)!
  const db = parseISODate(b)!
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

export function groupByProjectSection(tasks: Task[]): TaskGroup[] {
  // Group into: Inbox (no project) + per-project sections (or a single "Tasks" group)
  const groups: TaskGroup[] = []
  const inbox: Task[] = []
  const byProject = new Map<string, Map<string | null, Task[]>>()

  for (const t of tasks) {
    if (!t.projectId) {
      inbox.push(t)
      continue
    }
    if (!byProject.has(t.projectId)) byProject.set(t.projectId, new Map())
    const projMap = byProject.get(t.projectId)!
    const sec = t.section
    const arr = projMap.get(sec) ?? []
    arr.push(t)
    projMap.set(sec, arr)
  }

  if (inbox.length) {
    groups.push({ key: 'inbox', label: 'Inbox', date: null, projectId: null, section: null, tasks: inbox })
  }

  const sortedProjects = [...byProject.entries()]
  for (const [pid, secMap] of sortedProjects) {
    const noSec = secMap.get(null) ?? []
    const withSec = [...secMap.entries()].filter(([s]) => s !== null)
    if (noSec.length) {
      groups.push({ key: `${pid}:__none__`, label: '', date: null, projectId: pid, section: null, tasks: noSec })
    }
    for (const [sec, arr] of withSec) {
      groups.push({ key: `${pid}:${sec}`, label: sec ?? '', date: null, projectId: pid, section: sec, tasks: arr })
    }
  }

  for (const g of groups) g.tasks.sort(byOrder)
  return groups
}

export function viewTasksFor(routeView: string, tasks: Task[]): Task[] {
  const active = tasks.filter((t) => !t.archived)
  const today = todayISO()
  switch (routeView) {
    case 'inbox':
      return active.filter((t) => !t.projectId && !t.completed).sort(byDateThenOrder)
    case 'today':
      return active.filter((t) => !t.completed && t.dueDate && t.dueDate <= today).sort(byDateThenOrder)
    case 'upcoming':
      return active.filter((t) => !t.completed && t.dueDate && t.dueDate > today).sort(byDateThenOrder)
    case 'all':
      return active.filter((t) => !t.completed).sort(byOrder)
    case 'completed':
      return tasks.filter((t) => t.completed && !t.archived).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
    case 'important':
      return active.filter((t) => t.important && !t.completed).sort(byDateThenOrder)
    case 'overdue':
      return active.filter((t) => !t.completed && isTaskOverdue(t)).sort(byDateThenOrder)
    default:
      return active.filter((t) => !t.completed)
  }
}

export function byDateThenOrder(a: Task, b: Task): number {
  if (!a.dueDate && !b.dueDate) return a.sortOrder - b.sortOrder
  if (!a.dueDate) return 1
  if (!b.dueDate) return -1
  return a.dueDate.localeCompare(b.dueDate) || a.sortOrder - b.sortOrder
}

export function byOrder(a: Task, b: Task): number {
  return a.sortOrder - b.sortOrder
}
