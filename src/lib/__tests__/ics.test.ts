import { describe, it, expect } from 'vitest'
import type { Task } from '@/lib/types'
import { parseICS, tasksToICS } from '../ics'

function task(partial: Partial<Task> & { title: string }): Task {
  return {
    id: partial.id ?? 't1',
    title: partial.title,
    notes: partial.notes ?? '',
    projectId: null,
    section: null,
    priority: 2,
    dueDate: partial.dueDate ?? '2026-01-10',
    dueTime: partial.dueTime ?? '10:00',
    completed: false,
    completedAt: null,
    important: false,
    archived: false,
    recurrence: null,
    subtasks: [],
    tags: [],
    createdAt: 1,
    updatedAt: 1,
    sortOrder: 0,
    estimate: partial.estimate ?? 30,
  }
}

describe('ics', () => {
  it('exports timed open tasks as VEVENT blocks', () => {
    const ics = tasksToICS([task({ title: 'Standup', notes: 'daily' })], new Date(Date.UTC(2026, 0, 10, 8, 0, 0)))
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Standup')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('parses VEVENT start times and estimates', () => {
    const raw = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Deep work',
      'DTSTART:20260110T140000',
      'DTEND:20260110T153000',
      'DESCRIPTION:Focus',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const events = parseICS(raw)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Deep work')
    expect(events[0].dueDate).toBe('2026-01-10')
    expect(events[0].dueTime).toBe('14:00')
    expect(events[0].estimate).toBe(90)
  })
})
