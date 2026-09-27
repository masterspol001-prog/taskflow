import type { Task } from '@/lib/types'

const NOTIFY_PREFIX = 'tf-notify:'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function permissionGranted(): boolean {
  return notificationsSupported() && Notification.permission === 'granted'
}

export function notify(title: string, body?: string, tag = 'taskflow') {
  if (!permissionGranted()) return
  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag, icon: '/favicon.svg' })
  } catch {
    // Some engines require a service worker; fall back silently.
  }
}

/** Remember that we already notified about this occurrence. */
export function alreadyNotified(key: string): boolean {
  try {
    return localStorage.getItem(NOTIFY_PREFIX + key) !== null
  } catch {
    return false
  }
}

export function markNotified(key: string) {
  try {
    localStorage.setItem(NOTIFY_PREFIX + key, '1')
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function dueOccurrenceKey(task: Task): string {
  return `${task.id}:${task.dueDate ?? ''}:${task.dueTime ?? ''}`
}

/** Tasks that are due "now" given today's open, timed tasks. */
export function tasksDueNow(tasks: Task[]): Task[] {
  const now = new Date()
  const today = localISODate(now)
  return tasks.filter((t) => {
    if (t.archived || t.completed || !t.dueTime || t.dueDate !== today) return false
    const [h, m] = t.dueTime.split(':').map(Number)
    const due = new Date()
    due.setHours(h, m, 0, 0)
    const diffMs = due.getTime() - now.getTime()
    // Fire when the due moment passes (within the last minute) OR is imminent (< lead handled separately).
    return diffMs >= -60000 && diffMs <= 60000
  })
}

export function localISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
