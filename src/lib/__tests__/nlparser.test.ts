import { describe, it, expect } from 'vitest'
import { parseQuickAdd } from '../nlparser'

describe('parseQuickAdd', () => {
  it('extracts a plain title', () => {
    const r = parseQuickAdd('Buy milk')
    expect(r.title).toBe('Buy milk')
    expect(r.dueDate).toBeNull()
    expect(r.projectKey).toBeNull()
    expect(r.priority).toBeNull()
  })

  it('parses project shorthand with #', () => {
    const r = parseQuickAdd('Finish deck #work')
    expect(r.title).toBe('Finish deck')
    expect(r.projectKey).toBe('work')
  })

  it('parses project shorthand with @', () => {
    const r = parseQuickAdd('@personal water plants')
    expect(r.projectKey).toBe('personal')
    expect(r.title).toBe('water plants')
  })

  it('parses priority p1..p4', () => {
    expect(parseQuickAdd('Call boss p4').priority).toBe(4)
    expect(parseQuickAdd('p1 tidy desk').priority).toBe(1)
  })

  it('parses named priority prio:high', () => {
    expect(parseQuickAdd('Review PR prio:high').priority).toBe(3)
  })

  it('parses due date tomorrow', () => {
    const r = parseQuickAdd('Submit timesheet tomorrow')
    expect(r.dueDate).toBeTruthy()
  })

  it('parses an explicit time', () => {
    const r = parseQuickAdd('Sync with Amy at 5pm')
    expect(r.dueTime).toBe('17:00')
  })

  it('parses daily recurrence', () => {
    const r = parseQuickAdd('Morning standup daily')
    expect(r.recurrence).toEqual({ freq: 'daily', interval: 1 })
  })

  it('parses tags with +', () => {
    const r = parseQuickAdd('Draft blog +ideas')
    expect(r.tags).toContain('ideas')
  })

  it('keeps remaining words in the title', () => {
    const r = parseQuickAdd('Book flights to Lisbon tomorrow p3 #travel')
    expect(r.title).toContain('Book flights to Lisbon')
  })

  it('parses spaced times and durations', () => {
    const groceries = parseQuickAdd('Buy groceries tomorrow at 6 PM')
    expect(groceries.dueTime).toBe('18:00')
    expect(groceries.dueDate).toBeTruthy()
    expect(groceries.title).toBe('Buy groceries')

    const study = parseQuickAdd('Study React for 1 hour tomorrow')
    expect(study.estimate).toBe(60)
    expect(study.dueDate).toBeTruthy()
    expect(study.title).toContain('Study React')

    const exercise = parseQuickAdd('Exercise every morning')
    expect(exercise.recurrence).toEqual({ freq: 'daily', interval: 1 })
  })
})
