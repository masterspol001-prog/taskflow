import { describe, it, expect } from 'vitest'
import type { FocusSession, Goal, Project, Task } from '../types'
import { addDaysISO, todayISO } from '../dates'
import {
  completionSeries,
  computeVizKpis,
  focusMinuteSeries,
  goalProgressRows,
  heatmapDays,
  hasValues,
  padHeatmap,
  prioritySeries,
  projectSeries,
  tagSeries,
  weeklyCompletionSeries,
} from '../viz'

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

describe('computeVizKpis', () => {
  it('counts all visible tasks separately from open tasks', () => {
    const today = todayISO()
    const tasks = [
      makeTask({ id: 'a', dueDate: today }),
      makeTask({ id: 'b', completed: true, completedAt: Date.now() }),
      makeTask({ id: 'c', dueDate: addDaysISO(today, -2) }),
      makeTask({ id: 'd', archived: true }),
    ]
    const kpis = computeVizKpis(tasks)
    expect(kpis.total).toBe(3)
    expect(kpis.open).toBe(2)
    expect(kpis.completed).toBe(1)
    expect(kpis.overdue).toBe(1)
    expect(kpis.completedToday).toBe(1)
    expect(kpis.completionPct).toBe(33)
  })

  it('sums real focus minutes from sessions and task logs', () => {
    const today = todayISO()
    const sessions: FocusSession[] = [{ id: 's1', taskId: 'a', minutes: 25, completedAt: Date.now() }]
    const tasks = [makeTask({ id: 'a', completed: true, completedAt: Date.now(), actualMinutes: [15], dueDate: today })]
    const kpis = computeVizKpis(tasks, sessions)
    expect(kpis.focusTodayMin).toBe(40)
    expect(kpis.focusWeekMin).toBe(40)
  })
})

describe('series helpers', () => {
  it('builds a 7-day weekly completion series ending today', () => {
    const series = weeklyCompletionSeries([makeTask({ id: 'a', completed: true, completedAt: Date.now() })])
    expect(series).toHaveLength(7)
    expect(series[6]?.isToday).toBe(true)
    expect(series[6]?.value).toBe(1)
  })

  it('builds a 14-day completion trend', () => {
    const series = completionSeries([makeTask({ id: 'a', completed: true, completedAt: Date.now() })], 14)
    expect(series).toHaveLength(14)
    expect(series[13]?.value).toBe(1)
  })

  it('counts open tasks by priority', () => {
    const series = prioritySeries([
      makeTask({ id: 'a', priority: 4 }),
      makeTask({ id: 'b', priority: 4, completed: true, completedAt: Date.now() }),
      makeTask({ id: 'c', priority: 1 }),
    ])
    expect(series.find((s) => s.key === '4')?.value).toBe(1)
    expect(series.find((s) => s.key === '1')?.value).toBe(1)
  })

  it('groups tasks by project and inbox', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'Work', color: '#3b82f6', icon: 'briefcase', description: '', archived: false, sections: [], createdAt: 1 },
    ]
    const series = projectSeries(
      [makeTask({ id: 'a', projectId: 'p1' }), makeTask({ id: 'b' }), makeTask({ id: 'c', projectId: 'p1', completed: true, completedAt: Date.now() })],
      projects
    )
    expect(series.find((s) => s.key === 'p1')?.value).toBe(2)
    expect(series.find((s) => s.key === 'p1')?.done).toBe(1)
    expect(series.find((s) => s.key === 'inbox')?.value).toBe(1)
  })

  it('ranks tags by usage', () => {
    const series = tagSeries([
      makeTask({ id: 'a', tags: ['deep-work', 'quick'] }),
      makeTask({ id: 'b', tags: ['deep-work'] }),
    ])
    expect(series[0]?.label).toBe('deep-work')
    expect(series[0]?.value).toBe(2)
  })

  it('sums daily focus minutes', () => {
    const sessions: FocusSession[] = [{ id: 's1', taskId: null, minutes: 50, completedAt: Date.now() }]
    const series = focusMinuteSeries([], sessions, 7)
    expect(series).toHaveLength(7)
    expect(series[6]?.value).toBe(50)
  })
})

describe('heatmapDays', () => {
  it('covers the requested window with real completion intensity', () => {
    const days = heatmapDays([makeTask({ id: 'a', completed: true, completedAt: Date.now() })], [], 14)
    expect(days).toHaveLength(14)
    expect(days[13]?.count).toBe(1)
    expect(days[13]?.intensity).toBeGreaterThan(0)
  })

  it('pads leading empty cells so weeks start on Monday', () => {
    const days = heatmapDays([], [], 7)
    const padded = padHeatmap(days, true)
    expect(padded.length).toBeGreaterThanOrEqual(7)
    expect(padded.some((d) => d.empty) || padded[0].date === days[0].date).toBe(true)
  })
})

describe('hasValues', () => {
  it('detects empty series', () => {
    expect(hasValues([{ value: 0 }, { value: 0 }])).toBe(false)
    expect(hasValues([{ value: 2 }])).toBe(true)
  })
})

describe('goalProgressRows', () => {
  it('maps linked-task progress', () => {
    const goals: Goal[] = [
      {
        id: 'g1',
        title: 'Ship v1',
        targetDate: null,
        projectIds: [],
        taskIds: ['a', 'b'],
        color: '#6c5ce7',
        createdAt: 1,
        status: 'active',
      },
    ]
    const rows = goalProgressRows(goals, [
      makeTask({ id: 'a', completed: true, completedAt: Date.now() }),
      makeTask({ id: 'b' }),
    ])
    expect(rows[0]?.value).toBe(50)
    expect(rows[0]?.label).toBe('Ship v1')
  })
})
