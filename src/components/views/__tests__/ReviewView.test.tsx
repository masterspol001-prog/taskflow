import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useStore } from '@/store/useStore'
import { ReviewView } from '../ReviewView'
import { emptyProgress } from '@/lib/progress'
import { defaultSettings } from '@/lib/sampleData'
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

describe('ReviewView', () => {
  beforeEach(() => {
    localStorage.removeItem('taskflow-store')
    useStore.setState({
      tasks: [
        task({ id: 'done', title: 'Shipped', completed: true, completedAt: Date.now(), priority: 4, dueDate: todayISO() }),
      ],
      projects: [],
      goals: [],
      reviews: [],
      settings: {
        ...defaultSettings(),
        plan: 'pro',
        trialUsed: true,
        trialEndsAt: Date.now() + 86_400_000,
      },
      progress: emptyProgress(),
      toasts: [],
      hydrated: true,
    })
  })

  it('shows weekly review without a Pro paywall', () => {
    useStore.setState({ settings: defaultSettings() })
    render(<ReviewView />)
    expect(screen.getByText('Weekly review')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save this week/i })).toBeInTheDocument()
    expect(screen.queryByText(/Weekly review is how strategy becomes today/i)).not.toBeInTheDocument()
  })

  it('saves a weekly review from the notes', async () => {
    const user = userEvent.setup()
    render(<ReviewView />)
    expect(screen.getByText('Weekly review')).toBeInTheDocument()
    expect(screen.getByText('What happened')).toBeInTheDocument()
    await user.type(screen.getByLabelText('What went well?'), 'Shipped the redesign')
    await user.click(screen.getByRole('button', { name: /Save this week/i }))
    expect(useStore.getState().reviews).toHaveLength(1)
    expect(useStore.getState().reviews[0]?.wentWell).toBe('Shipped the redesign')
    expect(screen.getByText('Past reviews')).toBeInTheDocument()
  })
})
