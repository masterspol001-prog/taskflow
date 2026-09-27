import type { Task } from '@/lib/types'
import { toISODate, todayISO, parseISODate } from '@/lib/dates'

export interface PulseDay {
  date: string
  label: string
  count: number
}

/** Completed-task counts for the last `days` calendar days ending today (inclusive). */
export function dayPulse(tasks: Task[], days = 7): PulseDay[] {
  const out: PulseDay[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12)
    out.push({
      date: toISODate(d),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      count: 0,
    })
  }
  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (t.archived || !t.completed || !t.completedAt) continue
    const key = toISODate(new Date(t.completedAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return out.map((day) => ({ ...day, count: counts.get(day.date) ?? 0 }))
}

/** Consecutive days (up to today) on which at least one task was completed. */
export function completionStreak(tasks: Task[]): number {
  const days = new Set<string>()
  for (const t of tasks) {
    if (t.archived || !t.completed || !t.completedAt) continue
    days.add(toISODate(new Date(t.completedAt)))
  }
  let streak = 0
  const cursor = parseISODate(todayISO())
  if (!cursor) return 0
  while (days.has(toISODate(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Earliest-to-latest completion hour buckets, used for "productive hours" insight. */
export function productiveHours(tasks: Task[]): { hour: number; count: number }[] {
  const buckets = new Map<number, number>()
  for (const t of tasks) {
    if (t.archived || !t.completed || !t.completedAt) continue
    const h = new Date(t.completedAt).getHours()
    buckets.set(h, (buckets.get(h) ?? 0) + 1)
  }
  return [...buckets.entries()].map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour - b.hour)
}
