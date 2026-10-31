import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore } from '@/store/useStore'
import { UpcomingView } from '../UpcomingView'
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

describe('UpcomingView', () => {
  beforeEach(() => {
    localStorage.removeItem('taskflow-store')
    useStore.setState({ tasks: [], hydrated: true, toasts: [] })
  })

  it('shows empty capture when nothing is due later', () => {
    render(<UpcomingView />)
    expect(screen.getByText('Nothing upcoming')).toBeInTheDocument()
  })

  it('lists future tasks and hides parked or due today', () => {
    const today = todayISO()
    useStore.setState({
      tasks: [
        task({ id: 'today', title: 'Due today', dueDate: today }),
        task({ id: 'tomorrow', title: 'Call Alex', dueDate: addDaysISO(today, 1) }),
        task({ id: 'parked', title: 'Parked later', dueDate: addDaysISO(today, 2), parked: true }),
      ],
    })
    render(<UpcomingView />)
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument()
    expect(screen.getByText('Call Alex')).toBeInTheDocument()
    expect(screen.queryByText('Due today')).not.toBeInTheDocument()
    expect(screen.queryByText('Parked later')).not.toBeInTheDocument()
  })
})
