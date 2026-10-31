/** Client-side id generator — collision-safe enough for a local-first app. */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36).slice(-6)
  return `${prefix}${time}${rand}`
}

/** Format ISO date string (yyyy-MM-dd) to locale short date. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = parseISODate(iso)
  if (!d) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = parseISODate(iso)
  if (!d) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISODate(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d, 12, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDayHeader(iso: string): string {
  const d = parseISODate(iso)
  if (!d) return iso
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDaysISO(today, 1)) return 'Tomorrow'
  if (iso < today) return `Overdue — ${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`
  const diff = diffInDays(today, iso)
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function nextRecurrenceISO(dueDate: string, freq: string, interval: number): string {
  const d = parseISODate(dueDate) ?? new Date()
  d.setHours(12, 0, 0, 0)
  switch (freq) {
    case 'daily':
      d.setDate(d.getDate() + interval)
      break
    case 'weekly':
      d.setDate(d.getDate() + interval * 7)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + interval)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + interval)
      break
  }
  return toISODate(d)
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso) ?? new Date()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Shift an ISO date to today while preserving weekday-relative logic when needed. */
export function relativeToToday(dayOffset: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + dayOffset)
  return toISODate(d)
}

export function endOfWeekISO(startOfWeekMonday = true): string {
  const now = new Date()
  const day = now.getDay() // 0 = Sunday
  const diff = startOfWeekMonday ? (day === 0 ? -6 : 1 - day) : -day
  const monday = new Date(now)
  monday.setHours(12, 0, 0, 0)
  monday.setDate(now.getDate() + diff)
  monday.setDate(monday.getDate() + 6)
  return toISODate(monday)
}

export function startOfWeekISO(startOfWeekMonday = true): string {
  const now = new Date()
  const day = now.getDay()
  const diff = startOfWeekMonday ? (day === 0 ? -6 : 1 - day) : -day
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  d.setDate(now.getDate() + diff)
  return toISODate(d)
}

export function sameISODate(a: string, b: string): boolean {
  return a === b
}

export function diffInDays(aISO: string, bISO: string): number {
  const a = parseISODate(aISO) ?? new Date()
  const b = parseISODate(bISO) ?? new Date()
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

export function isOverdue(dueDate: string, now = new Date()): boolean {
  const d = parseISODate(dueDate)
  if (!d) return false
  d.setHours(23, 59, 59, 999)
  return d.getTime() < now.getTime()
}

/** Start of today's day boundary in ms. */
export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** The key of a completed day, used for streak + daily charts. */
export function dayKey(ts: number): string {
  return toISODate(new Date(ts))
}
