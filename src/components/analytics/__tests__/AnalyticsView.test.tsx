import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { AnalyticsView } from '../AnalyticsView'
import { todayISO } from '@/lib/dates'
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
      task({ id: 't2', title: 'Reply to Sam', dueDate: todayISO(), completed: true, completedAt: Date.now(), tags: ['follow-up'] }),
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
  useUIStore.setState({ route: { view: 'analytics' } })
}

describe('AnalyticsView', () => {
  beforeEach(() => {
    seed()
  })

  it('renders KPI cards and chart headings from real data', () => {
    render(<AnalyticsView />)
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Total tasks')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Streak')).toBeInTheDocument()
    expect(screen.getByText('Focus this week')).toBeInTheDocument()
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    expect(screen.getByText('Completion trend')).toBeInTheDocument()
    expect(screen.getByText('Open tasks by priority')).toBeInTheDocument()
    expect(screen.getByText('Activity heatmap')).toBeInTheDocument()
    expect(screen.getAllByText('Planned vs done').length).toBeGreaterThan(0)
    expect(screen.getByText('Focus hours')).toBeInTheDocument()
  })

  it('opens Insights from the header', async () => {
    const user = userEvent.setup()
    render(<AnalyticsView />)
    await user.click(screen.getByRole('button', { name: /Insights/i }))
    expect(useUIStore.getState().route.view).toBe('dashboard')
  })

  it('shows empty state when there is no work', () => {
    useStore.setState({ tasks: [], hydrated: true })
    render(<AnalyticsView />)
    expect(screen.getByText('Analytics appear after you capture work')).toBeInTheDocument()
  })
})
