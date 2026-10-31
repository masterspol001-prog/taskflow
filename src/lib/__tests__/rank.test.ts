import { describe, it, expect } from 'vitest'
import { planToday, rankTask, isWaiting, explainNext } from '../rank'
import type { Goal, Task } from '../types'

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

function goal(partial: Partial<Goal> & { title: string }): Goal {
  const { title, id, ...rest } = partial
  return {
    id: id ?? title,
    title,
    targetDate: null,
    projectIds: [],
    taskIds: [],
    color: '#888',
    createdAt: 1,
    status: 'active',
    ...rest,
  }
}

describe('rank', () => {
  it('flags waiting by tag, dependsOn, or waitingOn', () => {
    expect(isWaiting(task({ title: 'A', tags: ['waiting'] }))).toBe(true)
    expect(isWaiting(task({ title: 'B', dependsOn: ['x'] }))).toBe(true)
    expect(isWaiting(task({ title: 'W', waitingOn: 'Legal' }))).toBe(true)
    expect(isWaiting(task({ title: 'C' }))).toBe(false)
  })

  it('ranks overdue important work as must', () => {
    const r = rankTask(task({ title: 'Fix', dueDate: '2020-01-01', important: true, priority: 4 }), [], 'medium', '2026-01-10')
    expect(r.bucket).toBe('must')
    expect(r.why).toContain('overdue')
  })

  it('plans must / should / habits / waiting buckets', () => {
    const tasks = [
      task({ id: '1', title: 'Ship', dueDate: '2020-01-01', important: true, priority: 4, estimate: 30 }),
      task({ id: '2', title: 'Draft', dueDate: '2026-01-10', priority: 3, estimate: 20 }),
      task({ id: '3', title: 'Later', dueDate: '2026-02-01', priority: 1, estimate: 15 }),
      task({ id: '4', title: 'Meditate', recurrence: { freq: 'daily', interval: 1 }, estimate: 10 }),
      task({ id: '5', title: 'Wait on legal', tags: ['blocked'] }),
    ]
    const g = goal({ id: 'g1', title: 'Launch', taskIds: ['1'] })
    const plan = planToday(tasks, [g], 'medium', '2026-01-10')
    expect(plan.must.length).toBeGreaterThan(0)
    expect(plan.must[0]?.task.title).toBe('Ship')
    expect(plan.habits.some((r) => r.task.title === 'Meditate')).toBe(true)
    expect(plan.waiting.some((r) => r.task.title === 'Wait on legal')).toBe(true)
    expect(plan.must.length).toBeLessThanOrEqual(3)
    expect(plan.should.length).toBeLessThanOrEqual(5)
    expect(plan.goalsImpacted).toContain('Launch')
    expect(plan.totalMinutes).toBeGreaterThan(0)
    expect(plan.capacityMinutes).toBe(270)
  })

  it('boosts work that moves an at-risk goal', () => {
    const now = '2026-01-10'
    const g = goal({
      id: 'g1',
      title: 'Launch',
      taskIds: ['risk'],
      createdAt: Date.parse('2025-06-01'),
      targetDate: '2026-02-01',
    })
    const linked = rankTask(task({ id: 'risk', title: 'Unstick launch', priority: 2 }), [g], 'medium', now)
    const plain = rankTask(task({ id: 'other', title: 'Inbox chore', priority: 2 }), [], 'medium', now)
    expect(linked.score).toBeGreaterThan(plain.score)
    expect(linked.why.some((w) => /goal/.test(w))).toBe(true)
  })

  it('explains the next action in plain language', () => {
    const r = rankTask(task({ title: 'Ship', dueDate: '2020-01-01', important: true, priority: 4, estimate: 20 }), [], 'medium', '2026-01-10')
    expect(explainNext(r)).toMatch(/overdue/i)
    expect(explainNext(r)).not.toMatch(/AI/i)
  })

  it('boosts committed work and hides snoozed tasks', () => {
    const now = '2026-01-10'
    const committed = rankTask(task({ id: 'c', title: 'Lock', dueDate: now, committedDate: now, priority: 2 }), [], 'medium', now)
    const plain = rankTask(task({ id: 'p', title: 'Open', dueDate: now, priority: 2 }), [], 'medium', now)
    expect(committed.score).toBeGreaterThan(plain.score)
    expect(committed.why).toContain('committed')
    const plan = planToday(
      [
        task({ id: 'hide', title: 'Later', dueDate: now, snoozeUntil: '2026-01-12', priority: 4, important: true }),
        task({ id: 'show', title: 'Now', dueDate: now, priority: 3 }),
      ],
      [],
      'medium',
      now
    )
    expect(plan.must.concat(plan.should).some((r) => r.task.id === 'hide')).toBe(false)
    expect(plan.must.concat(plan.should).some((r) => r.task.id === 'show')).toBe(true)
  })

  it('hides parked Someday tasks from the day plan', () => {
    const now = '2026-01-10'
    const plan = planToday(
      [
        task({ id: 'park', title: 'Novel', dueDate: now, parked: true, priority: 4, important: true }),
        task({ id: 'show', title: 'Now', dueDate: now, priority: 3 }),
      ],
      [],
      'medium',
      now
    )
    expect(plan.must.concat(plan.should).some((r) => r.task.id === 'park')).toBe(false)
    expect(plan.must.concat(plan.should).some((r) => r.task.id === 'show')).toBe(true)
  })

  it('caps a realistic day instead of packing everything', () => {
    const tasks = Array.from({ length: 12 }, (_, i) =>
      task({ id: String(i), title: `Block ${i}`, priority: 4, important: true, estimate: 90, dueDate: '2026-01-10' })
    )
    const plan = planToday(tasks, [], 'low', '2026-01-10')
    expect(plan.must.length + plan.should.length).toBeLessThanOrEqual(3)
    expect(plan.totalMinutes).toBeLessThanOrEqual(plan.capacityMinutes + 90)
    expect(plan.capacityMinutes).toBe(180)
  })
})
