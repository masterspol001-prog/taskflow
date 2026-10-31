import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '@/store/useStore'
import { BoardView } from '../BoardView'
import { todayISO, addDaysISO } from '@/lib/dates'
import type { Task } from '@/lib/types'

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

describe('BoardView', () => {
  beforeEach(() => {
    localStorage.removeItem('taskflow-store')
    const today = todayISO()
    useStore.setState({
      tasks: [
        task({ id: 'over', title: 'Late report', dueDate: addDaysISO(today, -2) }),
        task({ id: 'now', title: 'Ship today', dueDate: today }),
        task({ id: 'soon', title: 'Review deck', dueDate: addDaysISO(today, 3) }),
        task({ id: 'later', title: 'Someday polish', dueDate: addDaysISO(today, 21) }),
        task({ id: 'parked', title: 'Parked idea', dueDate: today, parked: true }),
      ],
      hydrated: true,
    })
  })

  it('shows the four board columns and open tasks', () => {
    render(<BoardView />)
    expect(screen.getByRole('heading', { name: 'Board' })).toBeInTheDocument()
    expect(screen.getByLabelText('Overdue')).toBeInTheDocument()
    expect(screen.getByLabelText('Today')).toBeInTheDocument()
    expect(screen.getByLabelText('This week')).toBeInTheDocument()
    expect(screen.getByLabelText('Later')).toBeInTheDocument()
    expect(screen.getByText('Late report')).toBeInTheDocument()
    expect(screen.getByText('Ship today')).toBeInTheDocument()
    expect(screen.getByText('Review deck')).toBeInTheDocument()
    expect(screen.getByText('Someday polish')).toBeInTheDocument()
    expect(screen.queryByText('Parked idea')).not.toBeInTheDocument()
  })
})
