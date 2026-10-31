import { describe, it, expect } from 'vitest'
import type { ProgressState, Settings, Task } from '@/lib/types'
import { addDaysISO, todayISO, toISODate } from '@/lib/dates'
import {
  ACHIEVEMENTS,
  XP,
  applyFocusSession,
  applyGoalComplete,
  applyTaskComplete,
  creditXp,
  dayQualifies,
  detectAchievements,
  emptyProgress,
  hasEvent,
  levelFromXp,
  normalizeProgress,
  productivityBreakdown,
  taskXpAmount,
  xpForLevel,
} from '../progress'

function makeTask(partial: Partial<Task> & { id: string }): Task {
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

const settings = { streakRule: 'any-task' } as Pick<Settings, 'streakRule'>

describe('levels', () => {
  it('starts at level 1 with 0 XP', () => {
    const info = levelFromXp(0)
    expect(info.level).toBe(1)
    expect(info.title).toBe('Beginner')
    expect(info.xpIntoLevel).toBe(0)
    expect(info.xpForLevel).toBe(300)
  })

  it('advances after filling the current level', () => {
    expect(levelFromXp(300).level).toBe(2)
    expect(levelFromXp(300).title).toBe('Consistent')
    expect(levelFromXp(xpForLevel(1) + xpForLevel(2)).level).toBe(3)
  })
})

describe('xp awards are idempotent', () => {
  it('credits a task once', () => {
    const first = creditXp(emptyProgress(), 'task', 'a', 10)
    expect(first.awarded).toBe(10)
    expect(first.progress.xp).toBe(10)
    const second = creditXp(first.progress, 'task', 'a', 10)
    expect(second.awarded).toBe(0)
    expect(second.progress.xp).toBe(10)
    expect(hasEvent(second.progress, 'task', 'a')).toBe(true)
  })

  it('does not award XP twice for the same completed task', () => {
    const t = makeTask({ id: 'done-1', completed: true, completedAt: Date.now(), dueDate: todayISO() })
    const first = applyTaskComplete(emptyProgress(), [t], t, settings)
    expect(first.pulse.xpAwarded).toBeGreaterThan(0)
    const second = applyTaskComplete(first.progress, [t], t, settings)
    expect(second.pulse.xpAwarded).toBe(0)
    expect(second.progress.xp).toBe(first.progress.xp)
  })
})

describe('task XP amounts', () => {
  it('pays more for high-priority and overdue work', () => {
    expect(taskXpAmount(makeTask({ id: 'n', priority: 2 }))).toBe(XP.task)
    expect(taskXpAmount(makeTask({ id: 'h', priority: 4 }))).toBe(XP.highPriority)
    expect(taskXpAmount(makeTask({ id: 'i', important: true }))).toBe(XP.highPriority)
    expect(taskXpAmount(makeTask({ id: 'o', dueDate: addDaysISO(todayISO(), -2) }))).toBe(XP.overdue)
  })
})

describe('achievements', () => {
  it('unlocks First Task on the first completion', () => {
    const t = makeTask({ id: 'a', completed: true, completedAt: Date.now() })
    const { progress, pulse } = applyTaskComplete(emptyProgress(), [t], t, settings)
    expect(pulse.newAchievements).toContain('first-task')
    expect(progress.achievements.some((a) => a.id === 'first-task')).toBe(true)
  })

  it('does not re-unlock an existing achievement', () => {
    const t = makeTask({ id: 'a', completed: true, completedAt: Date.now() })
    const once = applyTaskComplete(emptyProgress(), [t], t, settings)
    const t2 = makeTask({ id: 'b', completed: true, completedAt: Date.now() })
    const twice = applyTaskComplete(once.progress, [t, t2], t2, settings)
    expect(twice.pulse.newAchievements).not.toContain('first-task')
  })

  it('unlocks Speed Runner at 10 completions in a day', () => {
    const today = todayISO()
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `s${i}`, completed: true, completedAt: Date.now(), dueDate: today })
    )
    const ids = detectAchievements(emptyProgress(), tasks, 'any-task', today)
    expect(ids).toContain('speed-runner')
  })

  it('unlocks Perfect Day when every planned task is done', () => {
    const today = todayISO()
    const tasks = [
      makeTask({ id: 'a', dueDate: today, completed: true, completedAt: Date.now() }),
      makeTask({ id: 'b', dueDate: today, completed: true, completedAt: Date.now() }),
    ]
    expect(detectAchievements(emptyProgress(), tasks, 'any-task', today)).toContain('perfect-day')
  })

  it('lists every achievement definition', () => {
    expect(ACHIEVEMENTS).toHaveLength(10)
  })
})

describe('streaks', () => {
  it('qualifies any-task days from real completions', () => {
    const today = todayISO()
    const tasks = [makeTask({ id: 'a', completed: true, completedAt: Date.now() })]
    expect(dayQualifies(tasks, today, 'any-task')).toBe(true)
    expect(dayQualifies([], today, 'any-task')).toBe(false)
  })

  it('daily-goal requires finishing the plan, not a random task', () => {
    const today = todayISO()
    const tasks = [
      makeTask({ id: 'a', dueDate: today, completed: true, completedAt: Date.now() }),
      makeTask({ id: 'b', dueDate: today, completed: false }),
    ]
    expect(dayQualifies(tasks, today, 'daily-goal')).toBe(false)
    const done = tasks.map((t) => ({ ...t, completed: true, completedAt: Date.now() }))
    expect(dayQualifies(done, today, 'daily-goal')).toBe(true)
  })
})

describe('focus sessions', () => {
  it('awards focus XP once per session id', () => {
    const first = applyFocusSession(emptyProgress(), 't1', 25, [], new Date(), 'sess-1')
    expect(first.pulse.xpAwarded).toBe(XP.focus)
    expect(first.progress.sessions).toHaveLength(1)
    const dup = applyFocusSession(first.progress, 't1', 25, [], new Date(), 'sess-1')
    expect(dup.pulse.xpAwarded).toBe(0)
    expect(dup.progress.sessions).toHaveLength(1)
    const second = applyFocusSession(first.progress, 't1', 25, [], new Date(), 'sess-2')
    expect(second.progress.sessions).toHaveLength(2)
    expect(second.progress.xp).toBe(XP.focus * 2)
  })

  it('ignores empty sessions', () => {
    const r = applyFocusSession(emptyProgress(), 't1', 0, [])
    expect(r.pulse.xpAwarded).toBe(0)
    expect(r.progress.sessions).toHaveLength(0)
  })

  it('records interruptions on the session', () => {
    const r = applyFocusSession(emptyProgress(), 't1', 25, [], new Date(), 'sess-int', 3)
    expect(r.progress.sessions[0]?.interruptions).toBe(3)
  })
})

describe('goals & migration', () => {
  it('awards weekly-goal XP once', () => {
    const goal = { id: 'g1', horizon: 'week' as const, title: 'Ship', targetDate: null, projectIds: [], color: '#000', createdAt: 1 }
    const once = applyGoalComplete(emptyProgress(), goal)
    expect(once.xp).toBe(XP.weeklyGoal)
    const twice = applyGoalComplete(once, goal)
    expect(twice.xp).toBe(XP.weeklyGoal)
  })

  it('normalizes missing progress payloads', () => {
    const p = normalizeProgress({ xp: 40 } as Partial<ProgressState>)
    expect(p.xp).toBe(40)
    expect(p.events).toEqual([])
    expect(p.records.mostTasksInDay).toBe(0)
  })
})

describe('productivity score', () => {
  it('explains a 100 from a finished priority plan', () => {
    const today = todayISO()
    const tasks = [
      makeTask({
        id: 'a',
        dueDate: today,
        priority: 4,
        important: true,
        completed: true,
        completedAt: Date.now(),
        estimate: 30,
        actualMinutes: [30],
      }),
    ]
    const b = productivityBreakdown(tasks)
    expect(b.completion).toBe(100)
    expect(b.priority).toBe(100)
    expect(b.summary).toMatch(/priority/i)
  })
})
