import { describe, it, expect } from 'vitest'
import type { Goal, Task } from '@/lib/types'
import {
  buildMorning,
  buildShutdown,
  isParked,
  isSnoozed,
  isWaitingOn,
  morningPatch,
  parkPatch,
  shutdownPatch,
  snoozeLabel,
  snoozePatch,
} from '../dayflow'

function task(partial: Partial<Task> & { title: string }): Task {
  const { title, id, ...rest } = partial
  return {
    id: id ?? title,
    title,
    notes: '',
    projectId: null,
    section: null,
    priority: 2,
    dueDate: null,
    dueTime: null,
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
    ...rest,
  }
}

describe('dayflow', () => {
  it('snoozes later today, tomorrow, and next week', () => {
    const t = task({ title: 'Call', dueDate: '2026-01-10', postponeCount: 0 })
    const later = snoozePatch(t, 'later', '2026-01-10', new Date('2026-01-10T09:00:00'))
    expect(later.dueDate).toBe('2026-01-10')
    expect(later.dueTime).toBe('11:00')
    expect(later.snoozeUntil).toBeNull()
    expect(later.postponeCount).toBe(1)

    const tomorrow = snoozePatch(t, 'tomorrow', '2026-01-10')
    expect(tomorrow.dueDate).toBe('2026-01-11')
    expect(tomorrow.snoozeUntil).toBe('2026-01-11')

    const week = snoozePatch(t, 'week', '2026-01-10')
    expect(week.dueDate).toBe('2026-01-17')
    expect(week.snoozeUntil).toBe('2026-01-17')
    expect(snoozeLabel('later')).toBe('Later today')
  })

  it('treats future snoozeUntil as hidden', () => {
    expect(isSnoozed(task({ title: 'A', snoozeUntil: '2026-01-12' }), '2026-01-10')).toBe(true)
    expect(isSnoozed(task({ title: 'B', snoozeUntil: '2026-01-10' }), '2026-01-10')).toBe(false)
  })

  it('parks leftover work on shutdown', () => {
    const leftover = task({ id: 'open', title: 'Ship', dueDate: '2026-01-10', estimate: 30 })
    const done = task({ id: 'done', title: 'Done', dueDate: '2026-01-10', completed: true, completedAt: 1 })
    const plan = buildShutdown([leftover, done], [] as Goal[], 'medium', { committedDate: '2026-01-10', committedTaskIds: ['open'] }, '2026-01-10')
    expect(plan.leftover.map((x) => x.id)).toEqual(['open'])
    expect(plan.done).toBe(1)
    expect(shutdownPatch('tomorrow', '2026-01-10').dueDate).toBe('2026-01-11')
    expect(shutdownPatch('drop', '2026-01-10').archived).toBe(true)
    expect(shutdownPatch('keep', '2026-01-10').committedDate).toBe('2026-01-10')
  })

  it('detects waiting-on text', () => {
    expect(isWaitingOn(task({ title: 'A', waitingOn: 'Legal' }))).toBe(true)
    expect(isWaitingOn(task({ title: 'B', waitingOn: '  ' }))).toBe(false)
  })

  it('builds a morning commit list and parks leftovers', () => {
    const open = task({ id: 'ship', title: 'Ship', dueDate: '2026-01-10', estimate: 30, important: true, priority: 4 })
    const parked = task({ id: 'later', title: 'Novel', parked: true, dueDate: '2026-01-10' })
    const plan = buildMorning([open, parked], [] as Goal[], 'medium', {}, '2026-01-10')
    expect(plan.candidates.map((x) => x.id)).toContain('ship')
    expect(plan.candidates.map((x) => x.id)).not.toContain('later')
    expect(morningPatch('commit', '2026-01-10').committedDate).toBe('2026-01-10')
    expect(morningPatch('later', '2026-01-10').dueDate).toBe('2026-01-11')
    expect(isParked(task({ title: 'X', ...parkPatch() }))).toBe(true)
  })
})
