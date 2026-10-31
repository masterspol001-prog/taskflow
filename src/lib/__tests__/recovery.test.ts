import { describe, it, expect } from 'vitest'
import type { Task } from '@/lib/types'
import { addDaysISO, todayISO } from '@/lib/dates'
import { buildRecoveryPlan, recoveryPatches } from '../recovery'

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

describe('buildRecoveryPlan', () => {
  it('keeps urgent work today and parks chronic postpones', () => {
    const today = todayISO()
    const plan = buildRecoveryPlan([
      task({ id: 'rent', title: 'Pay rent', dueDate: addDaysISO(today, -4), priority: 4, important: true }),
      task({ id: 'slip', title: 'Organize desk', dueDate: addDaysISO(today, -2), priority: 1, postponeCount: 4 }),
      task({ id: 'mid', title: 'Email Sam', dueDate: addDaysISO(today, -1), priority: 2 }),
    ])
    expect(plan.items).toHaveLength(3)
    expect(plan.items.find((i) => i.id === 'rent')?.suggested).toBe('today')
    expect(plan.items.find((i) => i.id === 'slip')?.suggested).toBe('drop')
    expect(plan.items.find((i) => i.id === 'mid')?.suggested).toBe('tomorrow')
    expect(plan.todayCount).toBeGreaterThan(0)
    expect(plan.summary).not.toMatch(/failed/i)
  })

  it('caps today catch-up at three tasks', () => {
    const today = todayISO()
    const tasks = Array.from({ length: 5 }, (_, i) =>
      task({ id: `u${i}`, title: `Urgent ${i}`, dueDate: addDaysISO(today, -3), priority: 4, important: true })
    )
    const plan = buildRecoveryPlan(tasks)
    expect(plan.todayCount).toBe(3)
    expect(plan.items.filter((i) => i.suggested === 'tomorrow').length).toBe(2)
  })

  it('returns empty when nothing is overdue', () => {
    const plan = buildRecoveryPlan([task({ id: 'ok', title: 'Fine', dueDate: todayISO() })])
    expect(plan.items).toHaveLength(0)
    expect(plan.summary).toMatch(/nothing overdue/i)
  })
})

describe('recoveryPatches', () => {
  it('moves, postpones, or archives without rewriting history silently', () => {
    const today = todayISO()
    const tasks = [
      task({ id: 'a', title: 'A', dueDate: addDaysISO(today, -2), postponeCount: 1 }),
      task({ id: 'b', title: 'B', dueDate: addDaysISO(today, -2) }),
      task({ id: 'c', title: 'C', dueDate: addDaysISO(today, -2) }),
    ]
    const patches = recoveryPatches(tasks, [
      { id: 'a', choice: 'tomorrow' },
      { id: 'b', choice: 'today' },
      { id: 'c', choice: 'drop' },
    ])
    const byId = Object.fromEntries(patches.map((p) => [p.id, p.patch]))
    expect(byId.a?.dueDate).toBe(addDaysISO(today, 1))
    expect(byId.a?.postponeCount).toBe(2)
    expect(byId.b?.dueDate).toBe(today)
    expect(byId.c?.archived).toBe(true)
  })
})
