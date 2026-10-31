import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { DashboardView } from '../DashboardView'
import { todayISO, addDaysISO } from '@/lib/dates'
import { defaultSettings } from '@/lib/sampleData'
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

function seed(extra: Task[] = []) {
  localStorage.removeItem('taskflow-store')
  useStore.setState({
    tasks: [
      task({ id: 't1', title: 'Ship the redesign', dueDate: todayISO(), priority: 4 }),
      task({ id: 't2', title: 'Reply to Sam', dueDate: todayISO(), completed: true, completedAt: Date.now() }),
      ...extra,
    ],
    projects: [],
    goals: [],
    reviews: [],
    toasts: [],
    hydrated: true,
    settings: {
      ...defaultSettings(),
      plan: 'pro',
      trialUsed: true,
      trialEndsAt: Date.now() + 86_400_000,
    },
  })
  useUIStore.setState({ route: { view: 'dashboard' } })
}

describe('DashboardView', () => {
  beforeEach(() => {
    seed()
  })

  it('renders planned vs done insights', () => {
    render(<DashboardView />)
    expect(screen.getByText('Insights')).toBeInTheDocument()
    expect(screen.getByText('Planned vs done')).toBeInTheDocument()
    expect(screen.getByText('Focus hours')).toBeInTheDocument()
    expect(screen.getByText('What to protect')).toBeInTheDocument()
    expect(screen.getByText('Do this next')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Capture anything…')).toBeInTheDocument()
    expect(screen.getByText('Current streak')).toBeInTheDocument()
    expect(screen.getByText('Focus this week')).toBeInTheDocument()
    expect(screen.getByText('This week')).toBeInTheDocument()
    expect(screen.getByText("Today's progress")).toBeInTheDocument()
    expect(screen.getByText('Open tasks by priority')).toBeInTheDocument()
    expect(screen.getAllByText('Due today').length).toBeGreaterThan(0)
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'Progress' })).toBeInTheDocument()
  })

  it('offers a focus action from suggestions', async () => {
    const user = userEvent.setup()
    render(<DashboardView />)
    const btn = screen.getByRole('button', { name: /^Start focus$/i })
    await user.click(btn)
    expect(useUIStore.getState().focusOpen).toBe(true)
  })

  it('surfaces overdue decisions', () => {
    seed([task({ id: 'old', title: 'Pay rent', dueDate: addDaysISO(todayISO(), -2), priority: 4 })])
    render(<DashboardView />)
    expect(screen.getByText('Overdue patterns')).toBeInTheDocument()
    expect(screen.getAllByText('Recover overdue').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Pay rent/).length).toBeGreaterThan(0)
  })
})
