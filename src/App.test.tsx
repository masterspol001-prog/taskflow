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
    progress: useStore.getState().progress,
    hydrated: true,
    status: 'ready',
  })
}

describe('App shell', () => {
  beforeEach(() => {
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

  it('opens Quick Add via ⌘K', async () => {
    render(<App />)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Try "Finish report tomorrow/)).toBeInTheDocument()
    })
  })
})

describe('hash routing', () => {
  it('parses and writes view hashes', () => {
    expect(parseHash('#/plan')).toEqual({ view: 'plan', projectId: undefined, section: undefined })
    expect(parseHash('#/calendar')).toEqual({ view: 'calendar', projectId: undefined, section: undefined })
    expect(parseHash('#/all?project=abc')).toEqual({ view: 'all', projectId: 'abc', section: undefined })
    expect(parseHash('#/nope')).toEqual({ view: 'today' })
    writeHash({ view: 'goals' })
    expect(window.location.hash).toBe('#/goals')
  })
})
