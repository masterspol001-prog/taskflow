import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '../useStore'
import { buildSampleData, defaultSettings } from '@/lib/sampleData'
import { generateLicense } from '@/lib/license'
import { FREE_LIMITS } from '@/lib/pro'
import { emptyProgress, XP } from '@/lib/progress'
import { todayISO } from '@/lib/dates'

function resetStore() {
  localStorage.removeItem('taskflow-store')
  const { tasks, projects } = buildSampleData(new Date())
  useStore.setState({ tasks, projects, settings: defaultSettings(), toasts: [], progress: emptyProgress(), lastReward: null })
}

function bareState() {
  useStore.setState({ tasks: [], projects: [], settings: defaultSettings(), toasts: [], progress: emptyProgress(), lastReward: null, goals: [] })
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
    const live = after.tasks.find((x) => x.id === t!.id)
    expect(live?.completed).toBe(false)
    expect(live?.dueDate).toBe('2026-01-02')
    const logs = after.tasks.filter((x) => x.title === 'Water plants' && x.completed && !x.recurrence)
    expect(logs).toHaveLength(1)
    expect(logs[0].dueDate).toBe('2026-01-01')
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

  it('postpones a task and logs focus minutes', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Call', dueDate: '2026-01-10' })
    expect(t).toBeTruthy()
    useStore.getState().postponeTask(t!.id)
    const after = useStore.getState().tasks.find((x) => x.id === t!.id)
    expect(after?.postponeCount).toBe(1)
    expect(after?.dueDate).toBeTruthy()
    useStore.getState().logFocusMinutes(t!.id, 25)
    expect(useStore.getState().tasks.find((x) => x.id === t!.id)?.actualMinutes).toEqual([25])
  })

  it('stores energy on settings', () => {
    bareState()
    useStore.getState().setEnergy('low')
    expect(useStore.getState().settings.energy).toBe('low')
  })

  it('undoes a completed task from the toast action', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Undo me' })
    useStore.getState().toggleComplete(t!.id, true)
    expect(useStore.getState().tasks.find((x) => x.id === t!.id)?.completed).toBe(true)
    const toast = useStore.getState().toasts.find((x) => x.actionLabel === 'Undo')
    expect(toast).toBeTruthy()
    toast!.onAction?.()
    expect(useStore.getState().tasks.find((x) => x.id === t!.id)?.completed).toBe(false)
  })

  it('awards XP once when a task is completed', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Ship it', priority: 2 })
    expect(t).toBeTruthy()
    useStore.getState().toggleComplete(t!.id, true)
    const once = useStore.getState()
    expect(once.progress.xp).toBe(XP.task)
    expect(once.lastReward?.xpAwarded).toBe(XP.task)
    useStore.getState().toggleComplete(t!.id, true)
    expect(useStore.getState().progress.xp).toBe(XP.task)
  })

  it('logs focus minutes and credits focus XP', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Deep work' })
    useStore.getState().logFocusMinutes(t!.id, 25)
    const st = useStore.getState()
    expect(st.tasks.find((x) => x.id === t!.id)?.actualMinutes).toEqual([25])
    expect(st.progress.xp).toBe(XP.focus)
    expect(st.progress.sessions).toHaveLength(1)
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
    expect(useStore.getState().progress.xp).toBe(0)
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

  it('finishes onboarding on Free without auto-starting a trial', () => {
    useStore.getState().completeOnboarding()
    const s = useStore.getState().settings
    expect(s.onboarded).toBe(true)
    expect(s.plan).toBe('free')
    expect(s.trialUsed).toBe(false)
    expect(s.trialEndsAt).toBeNull()
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

  it('unlocks Pro when the paid amount matches a plan', () => {
    const bad = useStore.getState().confirmPayment('100')
    expect(bad.ok).toBe(false)
    expect(useStore.getState().settings.plan).toBe('free')

    const monthly = useStore.getState().confirmPayment('$10')
    expect(monthly.ok).toBe(true)
    expect(monthly.interval).toBe('monthly')
    expect(useStore.getState().settings.plan).toBe('pro')
    expect(useStore.getState().settings.licenseInterval).toBe('monthly')
    expect(useStore.getState().settings.licenseKey).toMatch(/^TF-MO-/)
    const firstExpiry = useStore.getState().settings.licenseExpiresAt
    expect(firstExpiry).toBeGreaterThan(Date.now())

    const renew = useStore.getState().confirmPayment('10')
    expect(renew.ok).toBe(true)
    expect(useStore.getState().settings.licenseInterval).toBe('monthly')
    expect(useStore.getState().settings.licenseExpiresAt).toBeGreaterThan(firstExpiry!)

    const upgrade = useStore.getState().confirmPayment('149')
    expect(upgrade.ok).toBe(true)
    expect(useStore.getState().settings.licenseInterval).toBe('lifetime')
    expect(useStore.getState().settings.licenseExpiresAt).toBeNull()
  })

  it('re-unlocks a lapsed monthly license on matching payment', () => {
    useStore.getState().confirmPayment('10')
    useStore.setState({
      settings: { ...useStore.getState().settings, licenseExpiresAt: Date.now() - 1000 },
    })
    const again = useStore.getState().confirmPayment('$10')
    expect(again.ok).toBe(true)
    expect(useStore.getState().settings.licenseInterval).toBe('monthly')
    expect(useStore.getState().settings.licenseExpiresAt).toBeGreaterThan(Date.now())
    expect(useStore.getState().settings.plan).toBe('pro')
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
    const monthly = useStore.getState().openCheckout('monthly')
    expect(monthly.ok).toBe(true)
    const ok = useStore.getState().openCheckout('annual')
    expect(ok.ok).toBe(true)
    expect(opened).toEqual(['https://razorpay.me/@prathameshpraveenkulkarni', 'https://buy.example/annual'])
    window.open = original
  })

  it('imports ICS events as tasks', () => {
    bareState()
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Imported call',
      'DTSTART:20260110T150000',
      'DTEND:20260110T153000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const res = useStore.getState().importICS(ics)
    expect(res.ok).toBe(true)
    expect(res.added).toBe(1)
    expect(useStore.getState().tasks.some((t) => t.title === 'Imported call')).toBe(true)
  })

  it('reschedules missed timed tasks', () => {
    bareState()
    useStore.getState().addTask({ title: 'Old slot', dueDate: '2020-01-01', dueTime: '09:00', estimate: 30 })
    const n = useStore.getState().rescheduleMissed()
    expect(n).toBeGreaterThan(0)
    const t = useStore.getState().tasks.find((x) => x.title === 'Old slot')
    expect(t?.dueDate).not.toBe('2020-01-01')
  })
})

describe('useStore goals', () => {
  beforeEach(() => {
    bareState()
  })

  it('creates a goal with full planning fields', () => {
    const g = useStore.getState().addGoal({
      title: 'Run a marathon',
      horizon: '1y',
      category: 'health',
      why: 'Feel strong',
      metric: 'Finish 42km',
      progressType: 'numeric',
      targetValue: 42,
      unit: 'km',
    })
    expect(g?.horizon).toBe('1y')
    expect(g?.category).toBe('health')
    expect(g?.progressType).toBe('numeric')
    expect(g?.status).toBe('active')
    expect(g?.taskIds).toEqual([])
  })

  it('links an existing task and tracks its completion', () => {
    const t = useStore.getState().addTask({ title: 'Buy shoes' })!
    const g = useStore.getState().addGoal({ title: 'Run', taskIds: [t.id] })!
    useStore.getState().linkTaskToGoal(g.id, t.id)
    expect(useStore.getState().goals.find((x) => x.id === g.id)?.taskIds).toEqual([t.id])
    useStore.getState().unlinkTaskFromGoal(g.id, t.id)
    expect(useStore.getState().goals.find((x) => x.id === g.id)?.taskIds).toEqual([])
  })

  it('adds a goal task and attaches it to the goal', () => {
    const g = useStore.getState().addGoal({ title: 'Learn code' })!
    const created = useStore.getState().addTaskToGoal(g.id, { title: 'Lesson 1' })
    expect(created).toBeTruthy()
    const stored = useStore.getState().goals.find((x) => x.id === g.id)
    expect(stored?.taskIds).toContain(created!.id)
    expect(useStore.getState().tasks.some((x) => x.id === created!.id)).toBe(true)
  })

  it('toggles milestones and updates numeric values', () => {
    const g = useStore.getState().addGoal({
      title: 'Save',
      milestones: [{ id: 'm1', title: 'Budget', done: false }],
      progressType: 'numeric',
      targetValue: 100,
      currentValue: 0,
    })!
    useStore.getState().toggleGoalMilestone(g.id, 'm1')
    expect(useStore.getState().goals.find((x) => x.id === g.id)?.milestones?.[0].done).toBe(true)
    useStore.getState().setGoalValue(g.id, 40)
    expect(useStore.getState().goals.find((x) => x.id === g.id)?.currentValue).toBe(40)
  })

  it('marks a goal complete with a timestamp and can reactivate it', () => {
    const g = useStore.getState().addGoal({ title: 'Ship v1' })!
    useStore.getState().setGoalStatus(g.id, 'completed')
    const completed = useStore.getState().goals.find((x) => x.id === g.id)!
    expect(completed.status).toBe('completed')
    expect(completed.completedAt).toBeGreaterThan(0)
    useStore.getState().setGoalStatus(g.id, 'active')
    expect(useStore.getState().goals.find((x) => x.id === g.id)?.completedAt).toBeNull()
  })

  it('turns open milestones into linked tasks', () => {
    const g = useStore.getState().addGoal({
      title: 'Learn',
      milestones: [
        { id: 'm1', title: 'Lesson 1', done: false },
        { id: 'm2', title: 'Lesson 2', done: false },
      ],
    })!
    const n = useStore.getState().generateMilestoneTasks(g.id)
    expect(n).toBe(2)
    const stored = useStore.getState().goals.find((x) => x.id === g.id)!
    expect(stored.taskIds).toHaveLength(2)
    expect(stored.milestones?.every((m) => m.taskId)).toBe(true)
    expect(useStore.getState().generateMilestoneTasks(g.id)).toBe(0)
  })

  it('marks a milestone done when its generated task is completed', () => {
    const g = useStore.getState().addGoal({
      title: 'Ship',
      milestones: [{ id: 'm1', title: 'Write brief', done: false }],
    })!
    useStore.getState().generateMilestoneTasks(g.id)
    const taskId = useStore.getState().goals.find((x) => x.id === g.id)?.milestones?.[0].taskId
    expect(taskId).toBeTruthy()
    useStore.getState().toggleComplete(taskId!)
    expect(useStore.getState().goals.find((x) => x.id === g.id)?.milestones?.[0].done).toBe(true)
  })

  it('removes a goal and detaches its children', () => {
    const parent = useStore.getState().addGoal({ title: 'Vision', horizon: '5y' })!
    const child = useStore.getState().addGoal({ title: 'Year', horizon: '1y', parentId: parent.id })!
    useStore.getState().removeGoal(parent.id)
    expect(useStore.getState().goals.find((x) => x.id === parent.id)).toBeUndefined()
    expect(useStore.getState().goals.find((x) => x.id === child.id)?.parentId).toBeNull()
  })
})
