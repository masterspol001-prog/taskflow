import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useStore } from '@/store/useStore'
import { InboxView } from '../InboxView'
import { todayISO } from '@/lib/dates'
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

describe('InboxView', () => {
  beforeEach(() => {
    localStorage.removeItem('taskflow-store')
    useStore.setState({
      tasks: [task({ id: 'inbox-1', title: 'Unsorted thought' })],
      projects: [{ id: 'p1', name: 'Launch', color: '#6c5ce7', icon: 'flag', description: '', archived: false, sections: [], createdAt: 1 }],
      toasts: [],
      hydrated: true,
    })
  })

  it('shows the empty capture state when inbox is clear', () => {
    useStore.setState({ tasks: [] })
    render(<InboxView />)
    expect(screen.getByText('Inbox is clear')).toBeInTheDocument()
  })

  it('schedules a captured task for today', async () => {
    const user = userEvent.setup()
    render(<InboxView />)
    await user.click(screen.getByRole('button', { name: 'Today' }))
    const updated = useStore.getState().tasks.find((t) => t.id === 'inbox-1')
    expect(updated?.dueDate).toBe(todayISO())
  })
})
