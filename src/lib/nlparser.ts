import type { Priority, Recurrence } from '@/lib/types'
import { relativeToToday, addDaysISO } from '@/lib/dates'

/**
 * Lightweight natural-language parser for the Quick Add bar.
 *
 * Supported syntax (case-insensitive, order-independent):
 *  - "#projectname"   -> attach project (matched against existing project names later)
 *  - "p1|p2|p3|p4" or "!1" or "prio:high" -> priority
 *  - "today | tomorrow | tue | tuesday | next week | in 3 days | jul 12"
 *  - "5pm | 17:00 | at 17:00"
 *  - "every day | daily | every week | weekly | every 2 weeks"
 *  - tags: "tag:tagname" or "+tag"
 */

export interface ParsedQuickAdd {
  title: string
  dueDate: string | null
  dueTime: string | null
  priority: Priority | null
  projectKey: string | null
  tags: string[]
  recurrence: Recurrence | null
  estimate: number | null
}

const PRIORITY_MAP: Record<string, Priority> = {
  'p1': 1, 'low': 1, 'prio:low': 1,
  'p2': 2, 'medium': 2, 'med': 2, 'prio:medium': 2,
  'p3': 3, 'high': 3, 'prio:high': 3,
  'p4': 4, 'urgent': 4, 'critical': 4, 'prio:urgent': 4,
}

const DAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

function parseMonthDay(token: string): { month: number; day: number } | null {
  // e.g. "jul12", "jul 12", "12 jul", "july 12"
  const m = token.match(/^([a-z]{3,})\.?(\d{1,2})$/i) || token.match(/^(\d{1,2})[a-z]*(st|nd|rd|th)?\.?\s+([a-z]{3,})$/i)
  if (m) {
    if (MONTHS[m[1].toLowerCase()] !== undefined) return { month: MONTHS[m[1].toLowerCase()], day: Number(m[2]) }
    const mon = m[3] ? MONTHS[m[3].toLowerCase()] : undefined
    if (mon !== undefined) return { month: mon, day: Number(m[1]) }
  }
  return null
}

export function parseQuickAdd(input: string): ParsedQuickAdd {
  let text = input.trim()
  let priority: Priority | null = null
  let dueDate: string | null = null
  let dueTime: string | null = null
  let projectKey: string | null = null
  const tags: string[] = []
  let recurrence: Recurrence | null = null
  let estimate: number | null = null

  const tokens = text.split(/\s+/)
  const keep: string[] = []

  const hasPriorityWord = Object.keys(PRIORITY_MAP)
  const timeRgx = /^((1[0-2]|0?[0-9]):[0-5]\d)(am|pm)?$|^([01]?[0-9]|2[0-3]):[0-5]\d$/
  const ampmRgx = /^((1[0-2]|0?[0-9])(?::([0-5]\d))?)(am|pm)$/i

  for (let i = 0; i < tokens.length; i++) {
    let tok = tokens[i]
    const lower = tok.toLowerCase()
    let consumed = false

    // Project reference #work / @work
    const proj = tok.match(/^[#@]([a-zA-Z0-9_\-]+)$/)
    if (proj) {
      projectKey = proj[1].toLowerCase()
      consumed = true
    }

    // Tag token: #tag-style conflicts with project. Use explicit tag: or +tag
    if (!consumed) {
      const tagTok = tok.match(/^\+([a-zA-Z0-9_\-]+)$/) || tok.match(/^tag:([a-zA-Z0-9_\-]+)$/)
      if (tagTok) {
        tags.push(tagTok[1].toLowerCase())
        consumed = true
      }
    }

    // Priority p1..p4 (not followed by digits)
    if (!consumed && /^p[1-4]$/i.test(tok)) {
      priority = Number(tok[1]) as Priority
      consumed = true
    }

    // Named priority / prio:x
    if (!consumed && hasPriorityWord.includes(lower)) {
      priority = PRIORITY_MAP[lower]
      consumed = true
    }

    if (!consumed) {
      if (timeRgx.test(tok)) {
        dueTime = normalizeTime(tok)
        consumed = true
      } else if (ampmRgx.test(tok)) {
        dueTime = normalizeTime(tok)
        consumed = true
      } else if (/^\d{1,2}$/.test(tok) && tokens[i + 1] && /^(am|pm)$/i.test(tokens[i + 1])) {
        dueTime = normalizeTime(tok + tokens[i + 1])
        i += 1
        consumed = true
      }
    }

    // Relative date words
    if (!consumed) {
      const rel = tok.match(/^(in|in\s+|next)\s*(\d+)\s*days?$/i) || tok.match(/^\+(\d+)(d|days?)$/i)
      if (rel) {
        const n = Number(rel[rel.length - 2] ?? rel[2])
        dueDate = relativeToToday(Number(n))
        consumed = true
      } else if (lower === 'today') {
        dueDate = relativeToToday(0)
        consumed = true
      } else if (lower === 'tomorrow' || lower === 'tmr' || lower === 'tmrw') {
        dueDate = relativeToToday(1)
        consumed = true
      } else if (lower === 'tonight') {
        dueDate = relativeToToday(0)
        dueTime = '21:00'
        consumed = true
      } else if (lower === 'nextweek' || lower === 'next week') {
        dueDate = addDaysISO(relativeToToday(0), 7)
        consumed = true
      }
    }

    // Weekday
    if (!consumed && DAYS[lower] !== undefined) {
      const today = new Date()
      const dow = today.getDay()
      let diff = DAYS[lower] - dow
      if (diff <= 0) diff += 7
      dueDate = relativeToToday(diff)
      consumed = true
    }

    // "every X days", "every day/week/month"
    if (!consumed && (lower === 'daily' || lower === 'everyday')) {
      recurrence = { freq: 'daily', interval: 1 }
      consumed = true
    }
    if (!consumed && lower === 'weekly') {
      recurrence = { freq: 'weekly', interval: 1 }
      consumed = true
    }
    if (!consumed && lower === 'monthly') {
      recurrence = { freq: 'monthly', interval: 1 }
      consumed = true
    }
    if (!consumed && /^every$/i.test(tok) && tokens[i + 1]) {
      const nxt = tokens[i + 1].toLowerCase()
      if (['day', 'days', 'morning', 'evening'].includes(nxt)) {
        recurrence = { freq: 'daily', interval: 1 }
        i += 1
        consumed = true
      } else if (['week', 'weeks'].includes(nxt)) {
        recurrence = { freq: 'weekly', interval: 1 }
        i += 1
        consumed = true
      } else if (['month', 'months'].includes(nxt)) {
        recurrence = { freq: 'monthly', interval: 1 }
        i += 1
        consumed = true
      } else if (/^\d+$/.test(nxt)) {
        const interval = Number(nxt)
        const unit = tokens[i + 2]?.toLowerCase()
        if (unit && ['day', 'days', 'week', 'weeks', 'month', 'months'].includes(unit)) {
          const freq = unit.startsWith('week') ? 'weekly' : unit.startsWith('month') ? 'monthly' : 'daily'
          recurrence = { freq, interval }
          i += 2
          consumed = true
        }
      }
    }

    if (!consumed && (lower === 'for' || /^\d/.test(lower))) {
      const from = lower === 'for' ? i + 1 : i
      const dur = parseDurationTokens(tokens, from)
      if (dur) {
        estimate = dur.minutes
        i = dur.endIndex
        consumed = true
      }
    }

    if (!consumed) {
      // "5pm", "7 am", "noon", "midnight", "afternoon"
      if (lower === 'noon') {
        dueTime = '12:00'
        consumed = true
      } else if (lower === 'midnight') {
        dueTime = '00:00'
        consumed = true
      } else if (!consumed && /^(morning|afternoon|evening)$/.test(lower)) {
        // handled as a time hint attached to a date
        consumed = false
      }
    }

    // standalone date token like "jul12", "12jul", "5 nov"
    if (!consumed) {
      const md = parseMonthDay(tok)
      if (md) {
        const now = new Date()
        let year = now.getFullYear()
        const d = new Date(year, md.month, md.day, 12)
        if (d.getTime() < now.getTime()) year += 1
        const dd = new Date(year, md.month, md.day, 12)
        dueDate = dd.toISOString().slice(0, 10)
        consumed = true
      }
    }

    if (!consumed && lower === 'at') {
      const nxt = tokens[i + 1]
      const nxt2 = tokens[i + 2]
      if (nxt && (timeRgx.test(nxt) || ampmRgx.test(nxt))) {
        dueTime = normalizeTime(nxt)
        i += 1
        consumed = true
      } else if (nxt && nxt2 && /^\d{1,2}$/.test(nxt) && /^(am|pm)$/i.test(nxt2)) {
        dueTime = normalizeTime(nxt + nxt2)
        i += 2
        consumed = true
      }
    }

    if (!consumed) keep.push(tok)
  }

  return {
    title: keep.join(' ').replace(/\s+/g, ' ').trim(),
    dueDate,
    dueTime,
    priority,
    projectKey,
    tags,
    recurrence,
    estimate,
  }
}

function parseDurationTokens(tokens: string[], start: number): { minutes: number; endIndex: number } | null {
  const a = tokens[start]?.toLowerCase()
  if (!a) return null
  const compact = a.match(/^(\d+(?:\.\d+)?)(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)$/)
  if (compact) {
    return { minutes: toMinutes(Number(compact[1]), compact[2]), endIndex: start }
  }
  if (!/^\d+(?:\.\d+)?$/.test(a)) return null
  const unit = tokens[start + 1]?.toLowerCase()
  if (!unit || !/^(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)$/.test(unit)) return null
  return { minutes: toMinutes(Number(a), unit), endIndex: start + 1 }
}

function toMinutes(n: number, unit: string): number {
  if (unit.startsWith('h')) return Math.round(n * 60)
  return Math.round(n)
}

function normalizeTime(tok: string): string {
  const clean = tok.trim().toLowerCase()
  const m = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!m) return clean
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (m[3]) {
    if (m[3] === 'pm' && h < 12) h += 12
    if (m[3] === 'am' && h === 12) h = 0
  }
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
