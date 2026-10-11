import type { Task } from '@/lib/types'

export function toDayKey(ts: number): string {
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function pretty(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12)
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export function yesterdayKey(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toDayKey(d.getTime())
}

export function todayLocalKey(): string {
  return toDayKey(Date.now())
}

export function sortTaskMeta(a: Task, b: Task): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0)
}
