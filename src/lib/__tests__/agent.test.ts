import { describe, it, expect } from 'vitest'
import type { Task } from '@/lib/types'
import {
  adaptBehindSchedule,
  briefingText,
  buildDayPlan,
  buildWeeklyReview,
  captureFromText,
  detectConflicts,
  durationInsights,
  learnedDuration,
  parseCommand,
  pickNextAction,
  postponeDate,
  rescheduleMissed,
  scoreTask,
  suggestSubtasks,
  tasksThatFitNow,
  waitingTasks,
} from '../agent'

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

describe('agent', () => {
  it('picks overdue important work as next action', () => {
    const tasks = [
      task({ id: 'a', title: 'Low', priority: 1, dueDate: '2099-01-01' }),
      task({ id: 'b', title: 'Pay bill', priority: 4, important: true, dueDate: '2020-01-01' }),
    ]
    const next = pickNextAction(tasks, 'medium', '2026-01-10')
    expect(next?.task.id).toBe('b')
  })

  it('skips blocked tasks when a ready one exists', () => {
    const tasks = [
      task({ id: 'blocked', title: 'Ship', dependsOn: ['dep'], priority: 4, dueDate: '2026-01-10' }),
      task({ id: 'dep', title: 'Write copy', priority: 2, dueDate: '2026-01-10' }),
    ]
    const next = pickNextAction(tasks, 'medium', '2026-01-10')
    expect(next?.task.id).toBe('dep')
  })

  it('detects overlapping timed tasks', () => {
    const tasks = [
      task({ id: '1', title: 'Call', dueDate: '2026-01-10', dueTime: '10:00', estimate: 60 }),
      task({ id: '2', title: 'Write', dueDate: '2026-01-10', dueTime: '10:30', estimate: 60 }),
    ]
    const conflicts = detectConflicts(tasks, '2026-01-10')
    expect(conflicts.some((c) => c.kind === 'overlap')).toBe(true)
  })

  it('builds a day plan without overlapping floaters onto fixed slots', () => {
    const tasks = [
      task({ id: 'fixed', title: 'Standup', dueDate: '2026-01-10', dueTime: '09:00', estimate: 30 }),
      task({ id: 'float', title: 'Deep work', dueDate: '2026-01-10', important: true, estimate: 90, tags: ['deep-work'] }),
    ]
    const plan = buildDayPlan(tasks, 'high', '2026-01-10')
    expect(plan.slots.length).toBe(2)
    const [a, b] = plan.slots
    expect(a.endMin <= b.startMin || b.endMin <= a.startMin).toBe(true)
  })

  it('learns duration from actual minutes', () => {
    expect(learnedDuration(task({ title: 'X', estimate: 30, actualMinutes: [60, 60, 60] }))).toBeGreaterThan(40)
  })

  it('decomposes comma and then lists', () => {
    expect(suggestSubtasks('Research, draft, review')).toEqual(['Research', 'draft', 'review'])
  })

  it('parses slash commands', () => {
    expect(parseCommand('/plan')).toEqual({ kind: 'plan' })
    expect(parseCommand('/ask')).toEqual({ kind: 'plan' })
    expect(parseCommand('/review')).toEqual({ kind: 'review' })
    expect(parseCommand('/add Buy milk tomorrow')).toEqual({ kind: 'add', text: 'Buy milk tomorrow' })
    expect(parseCommand('/energy low')).toEqual({ kind: 'energy', energy: 'low' })
    expect(parseCommand('/today')).toEqual({ kind: 'navigate', view: 'today' })
    expect(parseCommand('/goal')).toEqual({ kind: 'goal' })
    expect(parseCommand('report')).toEqual({ kind: 'search' })
  })

  it('postpones from today when undated', () => {
    expect(postponeDate(null, '2026-01-10')).toBe('2026-01-11')
    expect(postponeDate('2026-01-20', '2026-01-10')).toBe('2026-01-21')
  })

  it('captures natural language', () => {
    const r = captureFromText('Study React tomorrow p3 for 1 hour')
    expect(r.title).toContain('Study React')
    expect(r.priority).toBe(3)
    expect(r.estimate).toBe(60)
  })

  it('scores overdue higher than later work', () => {
    const a = task({ title: 'Later', dueDate: '2099-01-01', priority: 4 })
    const b = task({ title: 'Now', dueDate: '2020-01-01', priority: 2 })
    expect(scoreTask(b, 'medium', '2026-01-10')).toBeGreaterThan(scoreTask(a, 'medium', '2026-01-10'))
  })

  it('summarizes a weekly review', () => {
    const tasks = [
      task({ id: 'c', title: 'Won', completed: true, completedAt: Date.now(), priority: 4 }),
      task({ id: 'o', title: 'Late', dueDate: '2020-01-01', postponeCount: 2 }),
    ]
    const review = buildWeeklyReview(tasks, [], [])
    expect(review.completed).toBe(1)
    expect(review.overdue).toBe(1)
    expect(review.wins).toContain('Won')
    expect(review.nextWeekFocus).toHaveLength(3)
    expect(review.summary).toMatch(/finished|quiet/i)
    expect(review.stopDoing.length).toBeGreaterThan(0)
    expect(review.startDoing.length).toBeGreaterThan(0)
  })

  it('rolls missed timed slots to the next free block', () => {
    const now = new Date(2026, 0, 10, 14, 0, 0)
    const patches = rescheduleMissed(
      [
        task({ id: 'missed', title: 'Standup', dueDate: '2026-01-10', dueTime: '09:00', estimate: 30 }),
        task({ id: 'busy', title: 'Call', dueDate: '2026-01-10', dueTime: '14:30', estimate: 30 }),
      ],
      now
    )
    expect(patches[0]?.id).toBe('missed')
    expect(patches[0]?.dueDate).toBe('2026-01-10')
    expect(patches[0]?.dueTime).toBe('15:00')
  })

  it('lists waiting tasks by blocker or tag', () => {
    const tasks = [
      task({ id: 'dep', title: 'Write copy' }),
      task({ id: 'blocked', title: 'Ship', dependsOn: ['dep'] }),
      task({ id: 'tagged', title: 'Vendor', tags: ['waiting'] }),
    ]
    const waiting = waitingTasks(tasks)
    expect(waiting.map((t) => t.id).sort()).toEqual(['blocked', 'tagged'])
  })

  it('computes duration bias from estimate vs actual', () => {
    const rows = durationInsights([
      task({ id: 'slow', title: 'Slow', estimate: 30, actualMinutes: [60, 60] }),
      task({ id: 'fast', title: 'Fast', estimate: 60, actualMinutes: [20, 20] }),
    ])
    expect(rows.find((r) => r.taskId === 'slow')?.bias).toBe('under')
    expect(rows.find((r) => r.taskId === 'fast')?.bias).toBe('over')
  })

  it('builds a morning briefing line', () => {
    const brief = briefingText(
      [task({ id: 'n', title: 'Write brief', dueDate: '2099-01-01', important: true })],
      'medium'
    )
    expect(brief.title).toBe('Morning briefing')
    expect(brief.body).toContain('Write brief')
  })

  it('packs overdue work that fits a free slot', () => {
    const fit = tasksThatFitNow(
      [
        task({ id: 'big', title: 'Rewrite app', dueDate: '2020-01-01', estimate: 120 }),
        task({ id: 'small', title: 'Email vendor', dueDate: '2020-01-01', estimate: 15 }),
      ],
      45,
      new Date(2026, 0, 10, 14, 0, 0)
    )
    expect(fit.tasks.map((t) => t.id)).toEqual(['small'])
    expect(fit.message).toContain('45 min')
  })

  it('suggests moving a missed block when behind', () => {
    const now = new Date(2026, 0, 10, 16, 0, 0)
    const suggestion = adaptBehindSchedule(
      [task({ id: 'late', title: 'Standup', dueDate: '2026-01-10', dueTime: '09:00', estimate: 30 })],
      now
    )
    expect(suggestion?.taskId).toBe('late')
    expect(suggestion?.toDate).toBe('2026-01-11')
    expect(suggestion?.message).toContain('behind')
  })
})
