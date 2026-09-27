import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCheckbox } from '../TaskCheckbox'

describe('TaskCheckbox', () => {
  it('renders checked state and fires on toggle', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<TaskCheckbox completed={false} label="Complete task" onToggle={onToggle} />)
    const box = screen.getByRole('checkbox')
    expect(box).toHaveAttribute('aria-checked', 'false')
    await user.click(box)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('renders completed state as checked', () => {
    render(<TaskCheckbox completed label="Complete task" onToggle={() => {}} />)
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  })
})
