import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeStreak,
  computeBestStreak,
  computeProductivityScore,
  computeDashboardStats,
  priorityBreakdown,
  projectProgress,
  isTaskOverdue,
} from '../stats'
import { todayISO, addDaysISO } from '../dates'
import type { Task } from '../types'

function makeTask(partial: Partial<Task> & { id: string; title?: string }): Task {
  return {
    title: 'T',
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

function completedTask(offsetDays: number, id: string): Task {
  const t = new Date()
  t.setDate(t.getDate() - offsetDays)
  return makeTask({ id, completed: true, completedAt: t.getTime() })
}

beforeEach(() => {})

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    const tasks = [completedTask(0, 'a'), completedTask(1, 'b'), completedTask(2, 'c'), completedTask(4, 'd')]
    expect(computeStreak(tasks)).toBe(3)
  })

  it('counts backwards from yesterday when today has no activity', () => {
    const tasks = [completedTask(1, 'a'), completedTask(2, 'b')]
    expect(computeStreak(tasks)).toBe(2)
  })

  it('returns best streak separately', () => {
    const tasks = [completedTask(0, 'a'), completedTask(1, 'b'), completedTask(3, 'c'), completedTask(4, 'd'), completedTask(5, 'e')]
    expect(computeBestStreak(tasks)).toBe(3)
  })
})

describe('productivity & dashboard', () => {
  it('scores by priority-weighted completions', () => {
    const done = makeTask({ id: 'x', priority: 4, completed: true, completedAt: Date.now() })
    expect(computeProductivityScore([done], 1, 1, 0)).toBe(100)
  })

  it('derives due-today and overdue counts', () => {
    const today = todayISO()
    const tasks = [
      makeTask({ id: 'a', dueDate: today }),
      makeTask({ id: 'b', dueDate: addDaysISO(today, -1) }),
      makeTask({ id: 'c', dueDate: addDaysISO(today, -1), completed: true, completedAt: Date.now() }),
    ]
    const s = computeDashboardStats(tasks)
    expect(s.dueTodayCount).toBe(1)
    expect(s.overdueCount).toBe(1)
    expect(s.total).toBe(2)
    expect(s.completionPct).toBe(33)
  })
})

describe('priorityBreakdown & projectProgress', () => {
  it('counts open non-archived tasks per priority', () => {
    const tasks = [
      makeTask({ id: 'a', priority: 4 }),
      makeTask({ id: 'b', priority: 4 }),
      makeTask({ id: 'c', priority: 1 }),
      makeTask({ id: 'd', priority: 1, completed: true, completedAt: Date.now() }),
    ]
    const b = priorityBreakdown(tasks)
    expect(b[4]).toBe(2)
    expect(b[1]).toBe(1)
    expect(b[2]).toBe(0)
  })

  it('computes project completion percentage', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b', completed: true, completedAt: Date.now() })]
    expect(projectProgress(tasks)).toBe(50)
  })
})

describe('isTaskOverdue', () => {
  it('flags tasks past their due date that are open', () => {
    const past = makeTask({ id: 'a', dueDate: addDaysISO(todayISO(), -1) })
    expect(isTaskOverdue(past)).toBe(true)
    const completed = makeTask({ id: 'b', dueDate: addDaysISO(todayISO(), -1), completed: true, completedAt: 1 })
    expect(isTaskOverdue(completed)).toBe(false)
    const archived = makeTask({ id: 'c', dueDate: addDaysISO(todayISO(), -1), archived: true })
    expect(isTaskOverdue(archived)).toBe(false)
  })
})
