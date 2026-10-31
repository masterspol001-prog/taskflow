import { describe, it, expect } from 'vitest'
import { buildTimeline } from '@/lib/timeline'
import type { Goal, Project, Task } from '@/lib/types'

function task(partial: Partial<Task> & { title: string; dueDate: string }): Task {
  return {
    id: partial.id ?? `t-${partial.title}`,
    title: partial.title,
    notes: '',
    projectId: partial.projectId ?? null,
    section: null,
    priority: 2,
    dueDate: partial.dueDate,
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
  }
}

describe('buildTimeline', () => {
  it('lanes overdue, today, week from real due dates', () => {
    const now = new Date(2026, 9, 27, 12)
    const tasks = [
      task({ title: 'Late', dueDate: '2026-10-20' }),
      task({ title: 'Now', dueDate: '2026-10-27' }),
      task({ title: 'Soon', dueDate: '2026-10-30' }),
    ]
    const lanes = buildTimeline(tasks, [], [], now)
    expect(lanes.map((l) => l.key)).toEqual(['overdue', 'today', 'week'])
    expect(lanes[0].events[0].title).toBe('Late')
    expect(lanes[1].events[0].title).toBe('Now')
  })

  it('includes project deadlines and goal targets', () => {
    const now = new Date(2026, 9, 27, 12)
    const projects: Project[] = [
      {
        id: 'p1',
        name: 'Ship',
        color: '#000',
        icon: 'briefcase',
        description: '',
        archived: false,
        sections: [],
        createdAt: 1,
        deadline: '2026-11-01',
      },
    ]
    const goals: Goal[] = [
      {
        id: 'g1',
        title: 'Save',
        targetDate: '2026-12-01',
        projectIds: [],
        color: '#111',
        createdAt: 1,
      },
    ]
    const lanes = buildTimeline([], projects, goals, now)
    const titles = lanes.flatMap((l) => l.events.map((e) => e.title))
    expect(titles).toContain('Ship')
    expect(titles).toContain('Save')
  })

  it('skips completed and undated work', () => {
    const now = new Date(2026, 9, 27, 12)
    const undated = task({ title: 'Open', dueDate: '2026-10-27', id: 'open' })
    undated.dueDate = null
    const tasks = [
      { ...task({ title: 'Done', dueDate: '2026-10-27' }), completed: true },
      undated,
    ]
    expect(buildTimeline(tasks, [], [], now)).toEqual([])
  })
})
