import type { Priority, Task } from '@/lib/types'
import { isTaskOverdue } from '@/lib/stats'
import { todayISO, parseISODate } from '@/lib/dates'

export interface TaskFilters {
  search?: string
  priority?: Priority | null
  projectId?: string | null
  completed?: boolean | null
  important?: boolean | null
  tags?: string[]
  due: 'any' | 'today' | 'upcoming' | 'overdue' | 'none' | 'week' | 'month'
  dateFrom?: string
  dateTo?: string
}

export interface GroupedTasks {
  key: string
  label: string
  tasks: Task[]
}

export function searchTasks(tasks: Task[], query: string): Task[] {
  const q = query.trim().toLowerCase()
  if (!q) return tasks
  return tasks.filter((t) => {
    const hay = [t.title, t.notes, (t.tags || []).join(' ')].join(' ').toLowerCase()
    if (hay.includes(q)) return true
    return false
  })
}

/** Main in-app filter combining quick search + structured filters. */
export function applyFilters(tasks: Task[], f: TaskFilters): Task[] {
  let out = tasks

  if (f.search) {
    const q = f.search.trim().toLowerCase()
    if (q) {
      out = out.filter((t) => {
        const hay = [t.title, t.notes, (t.tags ?? []).join(' ')].join(' ').toLowerCase()
        return hay.includes(q)
      })
    }
  }

  if (f.priority) out = out.filter((t) => t.priority === f.priority)
  if (f.projectId !== undefined && f.projectId !== null) out = out.filter((t) => t.projectId === f.projectId)
  if (f.important) out = out.filter((t) => t.important)
  if (f.completed !== null && f.completed !== undefined) out = out.filter((t) => t.completed === f.completed)

  if (f.tags && f.tags.length) {
    out = out.filter((t) => f.tags!.every((tag) => (t.tags ?? []).includes(tag)))
  }

  if (f.due && f.due !== 'any') {
    const today = todayISO()
    switch (f.due) {
      case 'today':
        out = out.filter((t) => t.dueDate === today)
        break
      case 'overdue':
        out = out.filter((t) => isTaskOverdue(t))
        break
      case 'upcoming':
        out = out.filter((t) => t.dueDate && t.dueDate > today)
        break
      case 'none':
        out = out.filter((t) => !t.dueDate)
        break
      case 'week': {
        const end = addDays(today, 7)
        out = out.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= end)
        break
      }
      case 'month': {
        const end = addDays(today, 30)
        out = out.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= end)
        break
      }
    }
  }

  if (f.dateFrom) out = out.filter((t) => t.dueDate && t.dueDate >= f.dateFrom!)
  if (f.dateTo) out = out.filter((t) => t.dueDate && t.dueDate <= f.dateTo!)

  return out
}

function addDays(iso: string, n: number): string {
  const d = parseISODate(iso) ?? new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function groupByDate(tasks: Task[]): GroupedTasks[] {
  const map = new Map<string, Task[]>()
  const sorted = [...tasks].sort((a, b) => {
    if (a.dueDate === b.dueDate) return a.sortOrder - b.sortOrder
    return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
  })
  for (const t of sorted) {
    const key = t.dueDate ?? 'no-date'
    const arr = map.get(key) ?? []
    arr.push(t)
    map.set(key, arr)
  }
  const order = { 'no-date': 0, overdue: 1, today: 2, tomorrow: 3 }
  return [...map.entries()].map(([key, tasks]) => ({
    key,
    label: key,
    tasks,
  }))
}

export function sortBySmart(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate)
    }
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return a.sortOrder - b.sortOrder
  })
}

/** Human readable relative label for a due date string. */
export function dueLabel(iso: string | null, today = todayISO()): string {
  if (!iso) return 'No date'
  if (iso === today) return 'Today'
  const d = parseISODate(iso)
  if (!d) return iso
  const diff = Math.round((d.getTime() - new Date().getTime()) / 86400000)
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `Overdue · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function isSameDay(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return a === b
}
