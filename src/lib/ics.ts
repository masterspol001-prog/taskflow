import type { Task } from '@/lib/types'
import { learnedDuration, hhmmToMinutes, openTasks } from '@/lib/agent'
import { parseISODate, toISODate } from '@/lib/dates'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function icsStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
}

function localToUtc(iso: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = parseISODate(iso) ?? new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

function fold(line: string): string {
  return line.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function tasksToICS(tasks: Task[], now = new Date()): string {
  const timed = openTasks(tasks).filter((t) => t.dueDate)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskFlow//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const t of timed) {
    const start = t.dueTime ? localToUtc(t.dueDate!, t.dueTime) : localToUtc(t.dueDate!, '09:00')
    const end = new Date(start.getTime() + learnedDuration(t) * 60000)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@taskflow.local`,
      `DTSTAMP:${icsStamp(now)}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${fold(t.title)}`,
      t.notes ? `DESCRIPTION:${fold(t.notes)}` : '',
      'END:VEVENT'
    )
  }
  lines.push('END:VCALENDAR')
  return lines.filter(Boolean).join('\r\n')
}

function icsDate(raw: string): { date: string; time: string | null } | null {
  const compact = raw.replace(/[^0-9TZ]/g, '')
  const m = compact.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/)
  if (!m) return null
  const date = `${m[1]}-${m[2]}-${m[3]}`
  if (!m[4]) return { date, time: null }
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)))
  if (compact.endsWith('Z') || raw.includes('Z')) {
    return { date: toISODate(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
  }
  return { date, time: `${m[4]}:${m[5]}` }
}

export function parseICS(raw: string): { title: string; notes: string; dueDate: string; dueTime: string | null; estimate: number | null }[] {
  const blocks = raw.split(/BEGIN:VEVENT/i).slice(1)
  const out: { title: string; notes: string; dueDate: string; dueTime: string | null; estimate: number | null }[] = []
  for (const block of blocks) {
    const body = block.split(/END:VEVENT/i)[0] ?? block
    const field = (name: string) => {
      const re = new RegExp(`^${name}[^:]*:(.*)$`, 'im')
      const m = body.match(re)
      return m ? m[1].replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').trim() : ''
    }
    const title = field('SUMMARY') || 'Imported event'
    const notes = field('DESCRIPTION')
    const startRaw = field('DTSTART')
    const endRaw = field('DTEND')
    const start = icsDate(startRaw)
    if (!start) continue
    let estimate: number | null = null
    const finish = icsDate(endRaw)
    if (start.time && finish?.time && start.date === finish.date) {
      estimate = Math.max(5, hhmmToMinutes(finish.time) - hhmmToMinutes(start.time))
    }
    out.push({ title, notes, dueDate: start.date, dueTime: start.time, estimate })
  }
  return out
}


