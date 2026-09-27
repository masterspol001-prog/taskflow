import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../useStore'
import { buildSampleData, defaultSettings } from '@/lib/sampleData'
import { generateLicense } from '@/lib/license'
import { FREE_LIMITS } from '@/lib/pro'

function resetStore() {
  localStorage.removeItem('taskflow-store')
  const { tasks, projects } = buildSampleData(new Date())
  useStore.setState({ tasks, projects, settings: defaultSettings(), toasts: [] })
}

function bareState() {
  useStore.setState({ tasks: [], projects: [], settings: defaultSettings(), toasts: [] })
}

describe('useStore tasks', () => {
  beforeEach(() => {
    resetStore()
  })

  it('adds a task with sensible defaults', () => {
    const before = useStore.getState().tasks.length
    const t = useStore.getState().addTask({ title: '  Buy bread  ' })
    expect(t).toBeTruthy()
    expect(t!.title).toBe('Buy bread')
    expect(t!.completed).toBe(false)
    expect(t!.projectId).toBeNull()
    expect(useStore.getState().tasks.length).toBe(before + 1)
  })

  it('stores estimates on new tasks', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Study React', estimate: 60 })
    expect(t?.estimate).toBe(60)
  })

  it('toggles completion and rolls forward recurring tasks', () => {
    bareState()
    const t = useStore.getState().addTask({
      title: 'Water plants',
      dueDate: '2026-01-01',
      recurrence: { freq: 'daily', interval: 1 },
    })
    expect(t).toBeTruthy()
    useStore.getState().toggleComplete(t!.id)
    const after = useStore.getState()
    const same = after.tasks.filter((x) => x.title === 'Water plants')
    expect(same).toHaveLength(1)
    expect(same[0].id).toBe(t!.id)
    expect(same[0].completed).toBe(false)
    expect(same[0].dueDate).toBe('2026-01-02')
  })

  it('skips a recurring occurrence without completing it', () => {
    bareState()
    const t = useStore.getState().addTask({
      title: 'Weekly review',
      dueDate: '2026-01-01',
      recurrence: { freq: 'weekly', interval: 1 },
    })
    expect(t).toBeTruthy()
    useStore.getState().skipOccurrence(t!.id)
    const after = useStore.getState().tasks.find((x) => x.id === t!.id)
    expect(after?.completed).toBe(false)
    expect(after?.dueDate).toBe('2026-01-08')
  })

  it('archives and restores', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Hide me' })
    expect(t).toBeTruthy()
    useStore.getState().toggleArchive(t!.id)
    expect(useStore.getState().tasks.find((x) => x.id === t!.id)?.archived).toBe(true)
    useStore.getState().toggleArchive(t!.id)
    expect(useStore.getState().tasks.find((x) => x.id === t!.id)?.archived).toBe(false)
  })

  it('duplicates a task with a fresh id', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Original' })
    expect(t).toBeTruthy()
    useStore.getState().duplicateTask(t!.id)
    const copy = useStore.getState().tasks.find((x) => x.title === 'Original (copy)')
    expect(copy).toBeTruthy()
    expect(copy?.id).not.toBe(t!.id)
  })

  it('removes a task', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Doomed' })
    expect(t).toBeTruthy()
    useStore.getState().removeTask(t!.id)
    expect(useStore.getState().tasks.some((x) => x.id === t!.id)).toBe(false)
  })
})

describe('useStore projects', () => {
  beforeEach(() => {
    bareState()
  })

  it('creates, sections, then deletes a project', () => {
    const p = useStore.getState().addProject('Launch')
    expect(p).toBeTruthy()
    useStore.getState().addSection(p!.id, 'Active')
    useStore.getState().addSection(p!.id, 'Active') // idempotent
    expect(useStore.getState().projects.find((x) => x.id === p!.id)?.sections).toEqual(['Active'])

    const t = useStore.getState().addTask({ title: 'Prep', projectId: p!.id, section: 'Active' })
    expect(t).toBeTruthy()
    useStore.getState().removeSection(p!.id, 'Active')
    expect(useStore.getState().tasks.find((x) => x.id === t!.id)?.section).toBeNull()

    useStore.getState().removeProject(p!.id)
    expect(useStore.getState().tasks.find((x) => x.id === t!.id)?.projectId).toBeNull()
  })
})

describe('useStore data management', () => {
  beforeEach(() => {
    bareState()
  })

  it('imports valid JSON and rejects garbage', () => {
    const sample = buildSampleData(new Date())
    const ok = useStore.getState().importJSON(JSON.stringify(sample))
    expect(ok.ok).toBe(true)
    expect(useStore.getState().tasks.length).toBe(sample.tasks.length)

    const bad = useStore.getState().importJSON('{not json')
    expect(bad.ok).toBe(false)
    expect(bad.error).toBeTruthy()
  })

  it('updates settings', () => {
    useStore.getState().updateSettings({ theme: 'dark', timeFormat: '24h' })
    const s = useStore.getState().settings
    expect(s.theme).toBe('dark')
    expect(s.timeFormat).toBe('24h')
  })

  it('can clear everything', () => {
    bareState()
    useStore.getState().addTask({ title: 'Something' })
    useStore.getState().addProject('Something project')
    useStore.getState().addGoal({ title: 'A goal' })
    useStore.getState().clearAll()
    expect(useStore.getState().tasks).toHaveLength(0)
    expect(useStore.getState().projects).toHaveLength(0)
    expect(useStore.getState().goals).toHaveLength(0)
  })

  it('appends sample data instead of wiping existing tasks', () => {
    bareState()
    useStore.getState().addTask({ title: 'Keep me' })
    const before = useStore.getState().tasks.length
    useStore.getState().seed()
    const after = useStore.getState()
    expect(after.tasks.length).toBeGreaterThan(before)
    expect(after.tasks.some((t) => t.title === 'Keep me')).toBe(true)
  })
})

describe('useStore billing', () => {
  beforeEach(() => {
    bareState()
  })

  it('grants Pro trial when onboarding finishes', () => {
    useStore.getState().completeOnboarding()
    const s = useStore.getState().settings
    expect(s.onboarded).toBe(true)
    expect(s.plan).toBe('pro')
    expect(s.trialUsed).toBe(true)
    expect(s.trialEndsAt).toBeGreaterThan(Date.now())
  })

  it('starts a one-time trial and refuses a second start', () => {
    const first = useStore.getState().startTrial()
    expect(first.ok).toBe(true)
    expect(useStore.getState().settings.plan).toBe('pro')
    expect(useStore.getState().settings.trialUsed).toBe(true)
    expect(useStore.getState().settings.trialEndsAt).toBeGreaterThan(Date.now())

    const second = useStore.getState().startTrial()
    expect(second.ok).toBe(false)
    expect(second.error).toMatch(/already been used/i)
  })

  it('redeems a valid license and rejects a fake one', () => {
    const bad = useStore.getState().redeemLicense('TF-YR-FFFFFFFF-0000')
    expect(bad.ok).toBe(false)

    const key = generateLicense('lifetime', 'bought01')
    const ok = useStore.getState().redeemLicense(key)
    expect(ok.ok).toBe(true)
    expect(ok.interval).toBe('lifetime')
    expect(useStore.getState().settings.plan).toBe('pro')
    expect(useStore.getState().settings.licenseKey).toBe(key)
  })

  it('blocks extra free tasks and projects at the cap', () => {
    const tasks = Array.from({ length: FREE_LIMITS.activeTasks }, (_, i) => ({
      id: `t-${i}`,
      title: `T${i}`,
      notes: '',
      projectId: null,
      section: null,
      priority: 2 as const,
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
      sortOrder: i,
    }))
    const projects = Array.from({ length: FREE_LIMITS.projects }, (_, i) => ({
      id: `p-${i}`,
      name: `P${i}`,
      color: '#888',
      icon: 'briefcase',
      description: '',
      archived: false,
      sections: [],
      createdAt: 1,
    }))
    useStore.setState({ tasks, projects, settings: defaultSettings(), toasts: [] })

    expect(useStore.getState().addTask({ title: 'One more' })).toBeNull()
    expect(useStore.getState().addProject('Overflow')).toBeNull()
    expect(useStore.getState().tasks).toHaveLength(FREE_LIMITS.activeTasks)
    expect(useStore.getState().projects).toHaveLength(FREE_LIMITS.projects)
  })

  it('creates a goal linked to a project and updates progress as tasks complete', () => {
    const p = useStore.getState().addProject('Car Purchase')
    expect(p).toBeTruthy()
    useStore.getState().addTask({ title: 'Save deposit', projectId: p!.id })
    useStore.getState().addTask({ title: 'Get insurance', projectId: p!.id })
    const g = useStore.getState().addGoal({ title: 'Buy a car', projectIds: [p!.id] })
    expect(g?.projectIds).toEqual([p!.id])
    const open = useStore.getState().tasks.filter((t) => t.projectId === p!.id && !t.archived)
    expect(open).toHaveLength(2)
    useStore.getState().toggleComplete(open[0].id)
    const after = useStore.getState().tasks.filter((t) => t.projectId === p!.id && !t.archived)
    expect(after.filter((t) => t.completed)).toHaveLength(1)
  })

  it('opens checkout when a URL is set', () => {
    const opened: string[] = []
    const original = window.open
    window.open = ((url?: string | URL) => {
      opened.push(String(url ?? ''))
      return null
    }) as typeof window.open

    useStore.getState().updateSettings({
      checkout: { monthly: '', annual: 'https://buy.example/annual', lifetime: '' },
    })
    const missing = useStore.getState().openCheckout('monthly')
    expect(missing.ok).toBe(false)
    const ok = useStore.getState().openCheckout('annual')
    expect(ok.ok).toBe(true)
    expect(opened).toEqual(['https://buy.example/annual'])
    window.open = original
  })
})
