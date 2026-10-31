import { describe, it, expect } from 'vitest'
import type { Task } from '../types'
import { addDaysISO, todayISO } from '../dates'
import { computeInsights, hoursLabel } from '../insights'

function task(partial: Partial<Task> & { id: string; title: string }): Task {
  return {
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
    ...partial,
  }
}

describe('computeInsights', () => {
  it('reports planned vs done for today', () => {
    const today = todayISO()
    const report = computeInsights(
      [
        task({ id: 'a', title: 'Ship', dueDate: today, priority: 4 }),
        task({ id: 'b', title: 'Done', dueDate: today, completed: true, completedAt: Date.now() }),
      ],
      []
    )
    expect(report.today.planned).toBe(2)
    expect(report.today.done).toBe(1)
    expect(report.today.remaining).toBe(1)
    expect(report.today.pct).toBe(50)
    expect(report.nextTaskId).toBe('a')
  })

  it('flags overdue work and suggests a decision', () => {
    const report = computeInsights(
      [task({ id: 'old', title: 'Pay rent', dueDate: addDaysISO(todayISO(), -3), priority: 4 })],
      []
    )
    expect(report.overdue.count).toBe(1)
    expect(report.overdue.oldestTitle).toBe('Pay rent')
    expect(report.suggestions.some((s) => s.kind === 'overdue')).toBe(true)
    expect(report.suggestions.some((s) => s.kind === 'celebrate')).toBe(false)
  })

  it('warns when estimates run short', () => {
    const report = computeInsights(
      [
        task({ id: 'slow1', title: 'Write', estimate: 30, actualMinutes: [60] }),
        task({ id: 'slow2', title: 'Review', estimate: 20, actualMinutes: [50] }),
      ],
      []
    )
    expect(report.estimates.under).toBe(2)
    expect(report.suggestions.some((s) => s.kind === 'estimate')).toBe(true)
  })

  it('suggests capture on an empty day', () => {
    const report = computeInsights([], [])
    expect(report.today.planned).toBe(0)
    expect(report.suggestions.some((s) => s.kind === 'capture')).toBe(true)
  })
})

describe('hoursLabel', () => {
  it('formats minutes compactly', () => {
    expect(hoursLabel(0)).toBe('0h')
    expect(hoursLabel(25)).toBe('25m')
    expect(hoursLabel(60)).toBe('1h')
    expect(hoursLabel(90)).toBe('1.5h')
  })
})
