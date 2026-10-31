import { describe, it, expect } from 'vitest'
import type { Goal, Task } from '@/lib/types'
import { addDaysISO, todayISO } from '@/lib/dates'
import {
  buildGoalReview,
  computeGoalAnalytics,
  computeGoalHealth,
  computeGoalStats,
  defaultTargetDate,
  filterAndSortGoals,
  goalChildren,
  goalProgress,
  goalStreak,
  horizonRollups,
  recommendTodayActions,
  rootGoals,
  suggestGoalPlan,
  goalHealthInfo,
  goalForTask,
  milestonesNeedingTasks,
  tasksFromMilestone,
} from '../goals'

const DAY = 86_400_000

function goal(partial: Partial<Goal> & { title: string }): Goal {
  const { title, ...rest } = partial
  return {
    id: title,
    title,
    targetDate: null,
    projectIds: [],
    taskIds: [],
    color: '#8e5cf7',
    createdAt: Date.now(),
    milestones: [],
    horizon: 'month',
    parentId: null,
    status: 'active',
    category: 'personal',
    why: '',
    metric: '',
    ...rest,
  }
}

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

describe('goalForTask', () => {
  it('returns the non-archived goal that lists the task', () => {
    const active = goal({ title: 'Active', taskIds: ['t1'] })
    const archived = goal({ title: 'Old', taskIds: ['t1'], status: 'archived' })
    expect(goalForTask([archived, active], 't1')?.title).toBe('Active')
    expect(goalForTask([active], 'missing')).toBeUndefined()
  })
})

describe('goalProgress', () => {
  it('counts tasks linked by project and by id', () => {
    const g = goal({ title: 'Ship it', projectIds: ['p1'], taskIds: ['t3'] })
    const tasks = [
      task({ id: 't1', title: 'A', projectId: 'p1', completed: true, completedAt: 1 }),
      task({ id: 't2', title: 'B', projectId: 'p1' }),
      task({ id: 't3', title: 'C' }),
      task({ id: 't4', title: 'Other', projectId: 'p2', completed: true }),
    ]
    const p = goalProgress(g, tasks)
    expect(p.total).toBe(3)
    expect(p.done).toBe(1)
    expect(p.pct).toBe(33)
    expect(p.source).toBe('task')
  })

  it('uses milestones when that is the progress method', () => {
    const g = goal({
      title: 'M',
      progressType: 'milestone',
      milestones: [
        { id: 'a', title: 'One', done: true },
        { id: 'b', title: 'Two', done: false },
      ],
    })
    const p = goalProgress(g, [])
    expect(p.pct).toBe(50)
    expect(p.label).toBe('1/2 milestones')
  })

  it('scales numeric progress to a target', () => {
    const g = goal({ title: 'Save', progressType: 'numeric', targetValue: 600000, currentValue: 150000, unit: '₹' })
    const p = goalProgress(g, [])
    expect(p.pct).toBe(25)
    expect(p.label).toBe('150000/600000 ₹')
  })

  it('reads percentage straight through', () => {
    const g = goal({ title: 'Pct', progressType: 'percentage', currentValue: 42 })
    expect(goalProgress(g, []).pct).toBe(42)
  })
})

describe('goal health', () => {
  it('marks a completed goal as completed', () => {
    expect(computeGoalHealth(goal({ title: 'Done', status: 'completed' }), [])).toBe('completed')
  })

  it('marks a fresh goal with no activity as not started', () => {
    const g = goal({ title: 'Fresh', targetDate: addDaysISO(todayISO(), 100) })
    expect(computeGoalHealth(g, [])).toBe('not_started')
  })

  it('keeps an ahead-of-schedule goal on track', () => {
    const g = goal({
      title: 'Ahead',
      progressType: 'percentage',
      currentValue: 80,
      createdAt: Date.now() - 50 * DAY,
      targetDate: addDaysISO(todayISO(), 100),
    })
    expect(computeGoalHealth(g, [])).toBe('on_track')
  })

  it('flags a badly behind goal as at risk', () => {
    const g = goal({
      title: 'Behind',
      createdAt: Date.now() - 200 * DAY,
      targetDate: addDaysISO(todayISO(), 30),
    })
    expect(computeGoalHealth(g, [])).toBe('at_risk')
  })

  it('flags a missed milestone as at risk even with some progress', () => {
    const g = goal({
      title: 'Missed',
      progressType: 'milestone',
      createdAt: Date.now() - 40 * DAY,
      targetDate: addDaysISO(todayISO(), 60),
      milestones: [
        { id: 'm1', title: 'Kickoff', done: true, dueDate: addDaysISO(todayISO(), -20) },
        { id: 'm2', title: 'Draft', done: false, dueDate: addDaysISO(todayISO(), -2) },
      ],
    })
    expect(computeGoalHealth(g, [])).toBe('at_risk')
    expect(goalHealthInfo(g, []).reasons).toContain('missed_milestone')
  })

  it('flags a dated goal with no linked work as at risk once time has passed', () => {
    const g = goal({
      title: 'Empty',
      createdAt: Date.now() - 40 * DAY,
      targetDate: addDaysISO(todayISO(), 60),
    })
    const info = goalHealthInfo(g, [])
    expect(info.status).toBe('at_risk')
    expect(info.reasons).toContain('no_linked_work')
    expect(info.forecast.expectedPct).toBeGreaterThan(10)
  })

  it('builds a task draft from a milestone', () => {
    const g = goal({ title: 'Ship', horizon: 'week', targetDate: '2026-02-01' })
    const draft = tasksFromMilestone(g, { id: 'm', title: 'Write outline', done: false, dueDate: '2026-01-20' })
    expect(draft.title).toBe('Write outline')
    expect(draft.dueDate).toBe('2026-01-20')
    expect(draft.important).toBe(true)
  })

  it('lists open milestones that still need a task', () => {
    const g = goal({
      title: 'Learn',
      milestones: [
        { id: 'a', title: 'Lesson 1', done: false },
        { id: 'b', title: 'Lesson 2', done: true },
        { id: 'c', title: 'Lesson 3', done: false, taskId: 't1' },
      ],
    })
    const needing = milestonesNeedingTasks(g, [task({ id: 't1', title: 'Lesson 3' })])
    expect(needing.map((m) => m.id)).toEqual(['a'])
  })
})

describe('goal stats and streaks', () => {
  it('aggregates active, completed and overall progress', () => {
    const goals = [
      goal({ title: 'A', progressType: 'percentage', currentValue: 50 }),
      goal({ title: 'B', status: 'completed' }),
      goal({ title: 'C', status: 'archived' }),
    ]
    const stats = computeGoalStats(goals, [])
    expect(stats.total).toBe(2)
    expect(stats.active).toBe(1)
    expect(stats.completed).toBe(1)
    expect(stats.overallPct).toBe(25)
  })

  it('computes a consecutive-day streak from linked tasks', () => {
    const now = Date.now()
    const g = goal({ title: 'Streak', taskIds: ['x', 'y'] })
    const tasks = [
      task({ id: 'x', title: 'X', completed: true, completedAt: now }),
      task({ id: 'y', title: 'Y', completed: true, completedAt: now - DAY }),
    ]
    expect(goalStreak(g, tasks)).toBe(2)
  })
})

describe('hierarchy', () => {
  it('nests children and exposes roots', () => {
    const vision = goal({ title: 'Vision', horizon: '5y' })
    const year = goal({ title: 'Year', horizon: '1y', parentId: 'Vision' })
    const month = goal({ title: 'Month', horizon: 'month', parentId: 'Year' })
    const goals = [vision, year, month]
    expect(goalChildren(goals, 'Vision').map((g) => g.id)).toEqual(['Year'])
    expect(rootGoals(goals).map((g) => g.id)).toEqual(['Vision'])
  })
})

describe('recommendTodayActions', () => {
  it('surfaces the next open linked task first', () => {
    const g = goal({ title: 'Health', horizon: '6m', taskIds: ['run'] })
    const actions = recommendTodayActions([g], [task({ id: 'run', title: 'Run 5 km', dueDate: todayISO() })])
    expect(actions[0].action).toBe('Run 5 km')
    expect(actions[0].taskId).toBe('run')
  })

  it('falls back to the next milestone when no linked task exists', () => {
    const g = goal({
      title: 'Learn',
      horizon: '6m',
      milestones: [{ id: 'm1', title: 'Finish lesson 4', done: false }],
    })
    const actions = recommendTodayActions([g], [])
    expect(actions[0].action).toBe('Finish lesson 4')
    expect(actions[0].milestoneId).toBe('m1')
  })

  it('ignores completed and paused goals', () => {
    const goals = [
      goal({ title: 'Done', status: 'completed' }),
      goal({ title: 'Paused', status: 'paused' }),
    ]
    expect(recommendTodayActions(goals, [])).toHaveLength(0)
  })
})

describe('suggestGoalPlan', () => {
  it('builds a 5-year to today ladder and infers a category', () => {
    const plan = suggestGoalPlan('I want to run a marathon')
    expect(plan.steps).toHaveLength(7)
    expect(plan.steps[0].horizon).toBe('5y')
    expect(plan.steps[6].horizon).toBe('today')
    expect(plan.category).toBe('health')
    expect(plan.steps[6].todayAction).toMatch(/marathon/i)
  })

  it('detects finance and learning themes', () => {
    expect(suggestGoalPlan('save 6 lakh').category).toBe('finance')
    expect(suggestGoalPlan('learn to code').category).toBe('learning')
  })
})

describe('reviews and analytics', () => {
  it('reports contributing tasks and goals needing attention', () => {
    const g = goal({
      title: 'Behind',
      createdAt: Date.now() - 200 * DAY,
      targetDate: addDaysISO(todayISO(), 30),
      taskIds: ['t1'],
      progressType: 'percentage',
      currentValue: 0,
    })
    const tasks = [task({ id: 't1', title: 'Did it', completed: true, completedAt: Date.now() })]
    const review = buildGoalReview([g], tasks, [], Date.now() - DAY)
    expect(review.needsAttention.map((n) => n.id)).toEqual(['Behind'])
    expect(review.contributing[0]).toEqual({ title: 'Did it', goalTitle: 'Behind' })
  })

  it('summarises categories and long-term horizons', () => {
    const goals = [
      goal({ title: 'A', category: 'health', horizon: '1y', progressType: 'percentage', currentValue: 40 }),
      goal({ title: 'B', category: 'health', status: 'completed', completedAt: Date.now() }),
    ]
    const a = computeGoalAnalytics(goals, [])
    expect(a.total).toBe(2)
    expect(a.byCategory.find((c) => c.category === 'health')?.count).toBe(2)
    expect(a.longTerm.find((h) => h.horizon === '1y')?.pct).toBe(40)
  })
})

describe('filtering and horizon rollups', () => {
  it('filters by horizon and free-text query', () => {
    const goals = [
      goal({ title: 'Run a marathon', horizon: '1y' }),
      goal({ title: 'Save money', horizon: 'month' }),
    ]
    expect(filterAndSortGoals(goals, [], { horizon: '1y' }).map((g) => g.title)).toEqual(['Run a marathon'])
    expect(filterAndSortGoals(goals, [], { query: 'save' }).map((g) => g.title)).toEqual(['Save money'])
  })

  it('rolls up progress per horizon', () => {
    const goals = [goal({ title: 'A', horizon: '1y', progressType: 'percentage', currentValue: 30 })]
    const rollups = horizonRollups(goals, [])
    expect(rollups.find((r) => r.horizon === '1y')?.pct).toBe(30)
    expect(rollups.find((r) => r.horizon === '1y')?.count).toBe(1)
  })
})

describe('defaultTargetDate', () => {
  it('offsets from today by the horizon length', () => {
    expect(defaultTargetDate('week', '2026-01-01')).toBe('2026-01-08')
  })
})
