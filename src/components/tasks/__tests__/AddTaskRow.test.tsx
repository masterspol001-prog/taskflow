import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useStore } from '@/store/useStore'
import { AddTaskRow } from '../AddTaskRow'

function bareState() {
  localStorage.removeItem('taskflow-store')
  useStore.setState({ tasks: [], projects: [], settings: useStore.getState().settings, toasts: [] })
}

describe('AddTaskRow', () => {
  beforeEach(() => {
    bareState()
  })

  it('creates a task on submit and clears the input', async () => {
    const user = userEvent.setup()
    render(<AddTaskRow />)

    const input = screen.getByLabelText('Add a task…')
    await user.type(input, 'Ship the landing page{enter}')

    await waitFor(() => {
      expect(useStore.getState().tasks.some((t) => t.title === 'Ship the landing page')).toBe(true)
    })
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('does not create empty tasks', async () => {
    const user = userEvent.setup()
    render(<AddTaskRow />)
    const input = screen.getByLabelText('Add a task…')
    await user.type(input, '   {enter}')
    expect(useStore.getState().tasks).toHaveLength(0)
  })

  it('respects a project context', async () => {
    const user = userEvent.setup()
    render(<AddTaskRow projectId="proj-x" />)
    await user.type(screen.getByLabelText('Add a task…'), 'Contextual task{enter}')
    await waitFor(() => {
      const t = useStore.getState().tasks.find((x) => x.title === 'Contextual task')
      expect(t?.projectId).toBe('proj-x')
    })
  })
})
