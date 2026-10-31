import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '@/App'
import { useStore } from '@/store/useStore'
import { useUIStore, parseHash, writeHash } from '@/store/useUIStore'

function readyState() {
  localStorage.removeItem('taskflow-store')
  useStore.setState({
    tasks: [],
    projects: [],
    settings: {
      ...useStore.getState().settings,
      name: 'Tester',
      onboarded: true,
    },
    toasts: [],
    lastReward: null,
    reviews: [],
    progress: useStore.getState().progress,
    hydrated: true,
    status: 'ready',
  })
}

describe('App shell', () => {
  beforeEach(() => {
    sessionStorage.clear()
    readyState()
    useUIStore.setState({
      route: { view: 'today' },
      onboardingOpen: false,
      quickAddOpen: false,
      searchOpen: false,
      focusOpen: false,
      shortcutsOpen: false,
    })
  })

  it('boots into the shell without crashing', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('TaskFlow')).toBeInTheDocument()
    })
  })

  it('shows the empty Today state', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/Capture your first task/i)).toBeInTheDocument()
    })
  })

  it('opens the command palette via ⌘K', async () => {
    render(<App />)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search or jump/)).toBeInTheDocument()
    })
  })
})

describe('hash routing', () => {
  it('parses and writes view hashes', () => {
    expect(parseHash('#/plan')).toEqual({ view: 'plan', projectId: undefined, section: undefined })
    expect(parseHash('#/calendar')).toEqual({ view: 'calendar', projectId: undefined, section: undefined })
    expect(parseHash('#/all?project=abc')).toEqual({ view: 'all', projectId: 'abc', section: undefined })
    expect(parseHash('#/nope')).toEqual({ view: 'today' })
    expect(parseHash('#/insights')).toEqual({ view: 'dashboard', projectId: undefined, section: undefined })
    expect(parseHash('#/dashboard')).toEqual({ view: 'dashboard', projectId: undefined, section: undefined })
    expect(parseHash('#/analytics')).toEqual({ view: 'analytics', projectId: undefined, section: undefined })
    expect(parseHash('#/inbox')).toEqual({ view: 'inbox', projectId: undefined, section: undefined })
    expect(parseHash('#/review')).toEqual({ view: 'review', projectId: undefined, section: undefined })
    expect(parseHash('#/today')).toEqual({ view: 'today', projectId: undefined, section: undefined })
    expect(parseHash('#/someday')).toEqual({ view: 'someday', projectId: undefined, section: undefined })
    expect(parseHash('#/board')).toEqual({ view: 'board', projectId: undefined, section: undefined })
    expect(parseHash('#/upcoming')).toEqual({ view: 'upcoming', projectId: undefined, section: undefined })
    expect(parseHash('#/routines')).toEqual({ view: 'routines', projectId: undefined, section: undefined })
    expect(parseHash('#/rewards')).toEqual({ view: 'rewards', projectId: undefined, section: undefined })
    writeHash({ view: 'goals' })
    expect(window.location.hash).toBe('#/goals')
    writeHash({ view: 'dashboard' })
    expect(window.location.hash).toBe('#/dashboard')
    writeHash({ view: 'analytics' })
    expect(window.location.hash).toBe('#/analytics')
  })
})
