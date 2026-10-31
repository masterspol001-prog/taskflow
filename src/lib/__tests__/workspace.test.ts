import { describe, it, expect } from 'vitest'
import type { Goal, Project, Task } from '@/lib/types'
import { buildRiskRadar, projectHealthOf, whatIfDelay, WORKFLOW_TEMPLATES } from '../workspace'

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

function project(partial: Partial<Project> & { name: string }): Project {
  const { name, id, ...rest } = partial
  return {
    id: id ?? name,
    name,
    color: '#3b82f6',
    icon: 'briefcase',
    description: '',
    archived: false,
    sections: [],
    createdAt: 1,
    ...rest,
  }
}

describe('workspace intelligence', () => {
  it('flags overdue and waiting-on work', () => {
    const items = buildRiskRadar(
      [
        task({ id: 'late', title: 'Late', dueDate: '2020-01-01' }),
        task({ id: 'wait', title: 'Wait', waitingOn: 'Legal' }),
      ],
      [project({ id: 'p', name: 'Work' })],
      [] as Goal[],
      new Date('2026-01-10T12:00:00')
    )
    expect(items.some((i) => i.kind === 'overdue' && i.taskId === 'late')).toBe(true)
    expect(items.some((i) => i.kind === 'blocked' && i.taskId === 'wait')).toBe(true)
  })

  it('shifts dated tasks in a what-if without mutating input', () => {
    const tasks = [task({ id: 'a', title: 'Ship', projectId: 'p', dueDate: '2026-01-10' })]
    const preview = whatIfDelay(tasks, 'p', 7, '2026-01-10')
    expect(preview.moved[0]?.to).toBe('2026-01-17')
    expect(tasks[0].dueDate).toBe('2026-01-10')
  })

  it('marks a project at-risk from many overdue tasks', () => {
    const p = project({ id: 'p', name: 'Work' })
    const tasks = [1, 2, 3].map((n) => task({ id: String(n), title: `T${n}`, projectId: 'p', dueDate: '2020-01-01' }))
    expect(projectHealthOf(p, tasks, new Date('2026-01-10'))).toBe('at-risk')
  })

  it('ships five ready-to-apply workflow templates', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(5)
    expect(WORKFLOW_TEMPLATES.every((t) => t.steps.length > 0)).toBe(true)
  })
})
