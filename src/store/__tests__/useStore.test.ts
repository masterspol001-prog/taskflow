import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { useStore } from '../useStore'
import { buildSampleData, defaultSettings } from '@/lib/sampleData'
import { setLicensePublicKey, type LicensePayload } from '@/lib/license'
import { FREE_LIMITS } from '@/lib/pro'
import { emptyProgress, XP } from '@/lib/progress'
import { todayISO } from '@/lib/dates'
import type { BillingInterval } from '@/lib/types'

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function issueToken(privateKey: CryptoKey, plan: BillingInterval, exp: number | null): Promise<string> {
  const payload: LicensePayload = { v: 1, plan, sub: 'test@example.com', iat: Date.now(), exp, id: 'TEST2345TEST' }
  const payloadB64 = b64url(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoder.encode(payloadB64))
  return `TF1.${payloadB64}.${b64url(new Uint8Array(signature))}`
}

function resetStore() {
  localStorage.removeItem('taskflow-store')
  const { tasks, projects } = buildSampleData(new Date())
  useStore.setState({ tasks, projects, notes: [], settings: defaultSettings(), toasts: [], progress: emptyProgress(), lastReward: null, reviews: [], savedFilters: [] })
}

function bareState() {
  useStore.setState({ tasks: [], projects: [], notes: [], settings: defaultSettings(), toasts: [], progress: emptyProgress(), lastReward: null, goals: [], reviews: [], savedFilters: [] })
}

function withTrial() {
  useStore.setState({
    settings: {
      ...defaultSettings(),
      plan: 'pro',
      trialUsed: true,
      trialEndsAt: Date.now() + 86_400_000,
    },
  })
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

  it('undoes a deleted task from the toast action', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Doomed' })
    expect(t).toBeTruthy()
    useStore.getState().removeTask(t!.id)
    const undo = useStore.getState().toasts.find((x) => x.actionLabel === 'Undo')
    expect(undo).toBeTruthy()
    undo?.onAction?.()
    expect(useStore.getState().tasks.some((x) => x.id === t!.id)).toBe(true)
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

  it('commits, snoozes, waits, and shuts down a day', () => {
    bareState()
    const today = todayISO()
    const t = useStore.getState().addTask({ title: 'Ship', dueDate: today })
    expect(t).toBeTruthy()
    useStore.getState().commitToday([t!.id])
    const committed = useStore.getState().tasks.find((x) => x.id === t!.id)
    expect(committed?.committedDate).toBe(today)
    expect(useStore.getState().settings.committedTaskIds).toEqual([t!.id])

    useStore.getState().setWaitingOn(t!.id, 'Legal')
    const waiting = useStore.getState().tasks.find((x) => x.id === t!.id)
    expect(waiting?.waitingOn).toBe('Legal')
    expect(waiting?.tags).toContain('waiting')

    useStore.getState().snoozeTask(t!.id, 'tomorrow')
    const snoozed = useStore.getState().tasks.find((x) => x.id === t!.id)
    expect(snoozed?.snoozeUntil).toBeTruthy()
    expect(snoozed?.postponeCount).toBe(1)

    useStore.getState().applyShutdown([{ id: t!.id, choice: 'tomorrow' }])
    const parked = useStore.getState().tasks.find((x) => x.id === t!.id)
    expect(parked?.committedDate).toBeTruthy()
    expect(useStore.getState().settings.lastShutdownDate).toBe(today)
    expect(useStore.getState().settings.committedTaskIds).toEqual([])
  })

  it('starts the morning, parks to Someday, and bulk-updates', () => {
    bareState()
    const today = todayISO()
    const a = useStore.getState().addTask({ title: 'Ship', dueDate: today })
    const b = useStore.getState().addTask({ title: 'Draft', dueDate: today })
    expect(a && b).toBeTruthy()
    useStore.getState().applyMorning([
      { id: a!.id, choice: 'commit' },
      { id: b!.id, choice: 'park' },
    ])
    const after = useStore.getState()
    expect(after.settings.lastMorningDate).toBe(today)
    expect(after.tasks.find((x) => x.id === a!.id)?.committedDate).toBe(today)
    expect(after.tasks.find((x) => x.id === b!.id)?.parked).toBe(true)
    useStore.getState().unparkTask(b!.id)
    expect(useStore.getState().tasks.find((x) => x.id === b!.id)?.parked).toBe(false)
    useStore.getState().updateTasks([a!.id, b!.id], { priority: 4 })
    expect(useStore.getState().tasks.find((x) => x.id === a!.id)?.priority).toBe(4)
    expect(useStore.getState().tasks.find((x) => x.id === b!.id)?.priority).toBe(4)
    useStore.getState().parkTask(a!.id)
    expect(useStore.getState().tasks.find((x) => x.id === a!.id)?.parked).toBe(true)
  })

  it('logs a past routine day without rolling the live task', () => {
    bareState()
    const live = useStore.getState().addTask({
      title: 'Yoga',
      dueDate: todayISO(),
      recurrence: { freq: 'daily', interval: 1 },
    })
    expect(live).toBeTruthy()
    useStore.getState().logRoutineDay(live!.id, '2026-01-10')
    const st = useStore.getState()
    expect(st.tasks.find((x) => x.id === live!.id)?.dueDate).toBe(todayISO())
    expect(st.tasks.some((x) => x.title === 'Yoga' && x.completed && x.dueDate === '2026-01-10')).toBe(true)
  })

  it('logs focus interruptions', () => {
    bareState()
    const t = useStore.getState().addTask({ title: 'Deep work' })
    useStore.getState().logFocusMinutes(t!.id, 25, 2)
    expect(useStore.getState().progress.sessions[0]?.interruptions).toBe(2)
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

  it('duplicates a project and its open tasks', () => {
    withTrial()
    const p = useStore.getState().addProject('Launch')!
    useStore.getState().addTask({ title: 'Prep', projectId: p.id, dueDate: '2026-01-10' })
    const done = useStore.getState().addTask({ title: 'Done already', projectId: p.id })
    useStore.getState().toggleComplete(done!.id)
    const copy = useStore.getState().duplicateProject(p.id)
    expect(copy?.name).toBe('Launch (copy)')
    const copies = useStore.getState().tasks.filter((t) => t.projectId === copy!.id)
    expect(copies.map((t) => t.title)).toEqual(['Prep'])
    expect(copies[0].dueDate).toBe('2026-01-10')
    expect(copies[0].id).not.toBe(useStore.getState().tasks.find((t) => t.title === 'Prep' && t.projectId === p.id)!.id)
  })

  it('applies a workflow template as a project with dated steps', () => {
    withTrial()
    const created = useStore.getState().applyWorkflow('launch')
    expect(created?.name).toBe('Launch')
    const steps = useStore.getState().tasks.filter((t) => t.projectId === created!.id)
    expect(steps.length).toBeGreaterThan(0)
    expect(steps.every((t) => t.dueDate)).toBe(true)
  })

  it('applies a what-if delay to dated project tasks', () => {
    withTrial()
    const p = useStore.getState().addProject('Ship')!
    const t = useStore.getState().addTask({ title: 'Cut', projectId: p.id, dueDate: '2026-01-10' })!
    const n = useStore.getState().applyWhatIf(p.id, 7)
    expect(n).toBe(1)
    expect(useStore.getState().tasks.find((x) => x.id === t.id)?.dueDate).toBe('2026-01-17')
  })
})

describe('useStore notes', () => {
  beforeEach(() => {
    bareState()
  })

  it('creates, updates, pins, and removes notes', () => {
    const n = useStore.getState().addNote({ title: 'Standup', body: 'Ship the deck' })
    expect(n?.title).toBe('Standup')
    useStore.getState().updateNote(n!.id, { pinned: true, body: 'Ship v2' })
    expect(useStore.getState().notes.find((x) => x.id === n!.id)?.pinned).toBe(true)
    expect(useStore.getState().notes.find((x) => x.id === n!.id)?.body).toBe('Ship v2')
    useStore.getState().removeNote(n!.id)
    expect(useStore.getState().notes).toHaveLength(0)
  })

  it('clears notes with clearAll', () => {
    useStore.getState().addNote({ title: 'Keep?' })
    useStore.getState().clearAll()
    expect(useStore.getState().notes).toHaveLength(0)
  })
})

describe('useStore saved filters', () => {
  beforeEach(() => {
    bareState()
  })

  it('saves, updates by name, and removes a filter', () => {
    const first = useStore.getState().saveFilter({
      name: 'Urgent today',
      search: '',
      projectId: null,
      priority: 4,
      important: true,
      due: 'today',
    })
    expect(first?.name).toBe('Urgent today')
    expect(useStore.getState().savedFilters).toHaveLength(1)
    const updated = useStore.getState().saveFilter({
      name: 'Urgent today',
      search: 'ship',
      projectId: null,
      priority: 4,
      important: true,
      due: 'overdue',
    })
    expect(updated?.id).toBe(first?.id)
    expect(useStore.getState().savedFilters).toHaveLength(1)
    expect(useStore.getState().savedFilters[0]?.due).toBe('overdue')
    useStore.getState().removeFilter(first!.id)
    expect(useStore.getState().savedFilters).toHaveLength(0)
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

  it('keeps startOfWeek in sync with weekStartMonday', () => {
    useStore.getState().updateSettings({ weekStartMonday: false })
    expect(useStore.getState().settings.startOfWeek).toBe(0)
    expect(useStore.getState().settings.weekStartMonday).toBe(false)
    useStore.getState().updateSettings({ startOfWeek: 1 })
    expect(useStore.getState().settings.weekStartMonday).toBe(true)
    expect(useStore.getState().settings.startOfWeek).toBe(1)
  })

  it('can clear everything', () => {
    bareState()
    withTrial()
    useStore.getState().addTask({ title: 'Something' })
    useStore.getState().addProject('Something project')
    useStore.getState().addGoal({ title: 'A goal' })
    useStore.getState().updateSettings({
      theme: 'dark',
      ai: { baseUrl: 'https://api.example', model: 'x', apiKey: 'sk-secret' },
    })
    useStore.getState().clearAll()
    expect(useStore.getState().tasks).toHaveLength(0)
    expect(useStore.getState().projects).toHaveLength(0)
    expect(useStore.getState().goals).toHaveLength(0)
    expect(useStore.getState().reviews).toHaveLength(0)
    expect(useStore.getState().savedFilters).toHaveLength(0)
    expect(useStore.getState().progress.xp).toBe(0)
    expect(useStore.getState().settings).toEqual(defaultSettings())
  })

  it('exports reviews and strips the AI key', () => {
    withTrial()
    useStore.getState().saveWeeklyReview({
      weekStart: '2026-10-19',
      summary: '3 finished',
      completed: 3,
      carriedOver: 0,
      overdue: 0,
      minutesLogged: 30,
      plannedMinutes: 60,
      wins: [],
      slips: [],
      adjustments: [],
      nextWeekFocus: [],
      wentWell: 'Shipped',
      improve: '',
      nextPriorities: '',
    })
    useStore.getState().updateSettings({ ai: { baseUrl: 'https://api.example', model: 'gpt', apiKey: 'sk-secret' } })
    const captured: string[] = []
    const RealBlob = globalThis.Blob
    globalThis.Blob = class extends RealBlob {
      constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
        super(blobParts, options)
        if (blobParts?.[0] != null) captured.push(String(blobParts[0]))
      }
    } as typeof Blob
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = () => 'blob:test'
    URL.revokeObjectURL = () => {}
    try {
      useStore.getState().exportJSON()
    } finally {
      globalThis.Blob = RealBlob
      URL.createObjectURL = origCreate
      URL.revokeObjectURL = origRevoke
    }
    const parsed = JSON.parse(captured[0] ?? '{}') as { reviews?: unknown[]; settings?: { ai?: { apiKey?: string } } }
    expect(parsed.reviews).toHaveLength(1)
    expect(parsed.settings?.ai?.apiKey).toBe('')
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
  let pair: CryptoKeyPair

  beforeAll(async () => {
    pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    setLicensePublicKey(await crypto.subtle.exportKey('jwk', pair.publicKey))
  })

  afterAll(() => setLicensePublicKey(null))

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

  it('redeems a signed license and rejects forged ones', async () => {
    const bad = await useStore.getState().redeemLicense('TF-YR-FFFFFFFF-0000')
    expect(bad.ok).toBe(false)

    // A token signed by a different key must not unlock Pro.
    const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const forged = await issueToken(other.privateKey, 'lifetime', null)
    const forgedRes = await useStore.getState().redeemLicense(forged)
    expect(forgedRes.ok).toBe(false)
    expect(useStore.getState().settings.plan).toBe('free')

    const key = await issueToken(pair.privateKey, 'lifetime', null)
    const ok = await useStore.getState().redeemLicense(key)
    expect(ok.ok).toBe(true)
    expect(ok.interval).toBe('lifetime')
    expect(useStore.getState().settings.plan).toBe('pro')
    expect(useStore.getState().settings.licenseKey).toBe(key)
    expect(useStore.getState().settings.licenseVerified).toBe(true)
  })

  it('does not mark an unsigned decoded key as a verified license', () => {
    const encoder = new TextEncoder()
    const payload = { v: 1, plan: 'lifetime', sub: 'x@y.z', iat: Date.now(), exp: null, id: 'FAKE2345FAKE' }
    let binary = ''
    const bytes = encoder.encode(JSON.stringify(payload))
    for (const b of bytes) binary += String.fromCharCode(b)
    const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    useStore.setState({
      settings: {
        ...defaultSettings(),
        licenseKey: `TF1.${b64}.${b64}`,
        licenseInterval: 'lifetime',
        licenseVerified: false,
        plan: 'free',
      },
    })
    expect(useStore.getState().settings.licenseVerified).toBe(false)
    expect(useStore.getState().addGoal({ title: 'Should succeed' })).toBeTruthy()
  })

  it('allows extra tasks and projects past the old Free cap', () => {
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

    expect(useStore.getState().addTask({ title: 'One more' })).toBeTruthy()
    expect(useStore.getState().addProject('Overflow')).toBeTruthy()
    expect(useStore.getState().tasks).toHaveLength(FREE_LIMITS.activeTasks + 1)
    expect(useStore.getState().projects).toHaveLength(FREE_LIMITS.projects + 1)
  })

  it('creates a goal linked to a project and updates progress as tasks complete', () => {
    withTrial()
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

  it('activates a signed monthly license and carries its expiry', async () => {
    const exp = Date.now() + 32 * 86_400_000
    const monthly = await useStore.getState().redeemLicense(await issueToken(pair.privateKey, 'monthly', exp))
    expect(monthly.ok).toBe(true)
    expect(monthly.interval).toBe('monthly')
    const s = useStore.getState().settings
    expect(s.plan).toBe('pro')
    expect(s.licenseInterval).toBe('monthly')
    expect(s.licenseExpiresAt).toBe(exp)
  })

  it('re-unlocks a lapsed monthly license with a fresh key', async () => {
    await useStore.getState().redeemLicense(await issueToken(pair.privateKey, 'monthly', Date.now() - 1000))
    expect(useStore.getState().settings.plan).toBe('free')
    const again = await useStore.getState().redeemLicense(await issueToken(pair.privateKey, 'monthly', Date.now() + 32 * 86_400_000))
    expect(again.ok).toBe(true)
    expect(useStore.getState().settings.plan).toBe('pro')
    expect(useStore.getState().settings.licenseExpiresAt).toBeGreaterThan(Date.now())
  })

  it('upgrades monthly to lifetime', async () => {
    await useStore.getState().redeemLicense(await issueToken(pair.privateKey, 'monthly', Date.now() + 32 * 86_400_000))
    const upgrade = await useStore.getState().redeemLicense(await issueToken(pair.privateKey, 'lifetime', null))
    expect(upgrade.ok).toBe(true)
    expect(useStore.getState().settings.licenseInterval).toBe('lifetime')
    expect(useStore.getState().settings.licenseExpiresAt).toBeNull()
  })

  it('fails closed when checkout URLs are missing or not https', () => {
    const opened: string[] = []
    const original = window.open
    window.open = ((url?: string | URL) => {
      opened.push(String(url ?? ''))
      return null
    }) as typeof window.open

    const empty = useStore.getState().openCheckout('monthly')
    expect(empty.ok).toBe(false)
    expect(empty.error).toMatch(/not configured/i)

    useStore.getState().updateSettings({
      checkout: { monthly: 'http://insecure.example', annual: 'javascript:alert(1)', lifetime: '' },
    })
    expect(useStore.getState().openCheckout('monthly').ok).toBe(false)
    expect(useStore.getState().openCheckout('annual').ok).toBe(false)

    useStore.getState().updateSettings({
      checkout: { monthly: '', annual: 'https://buy.example/annual', lifetime: '' },
    })
    const ok = useStore.getState().openCheckout('annual')
    expect(ok.ok).toBe(true)
    expect(opened).toEqual(['https://buy.example/annual'])
    window.open = original
  })

  it('keeps the current license when importing a backup', async () => {
    const key = await issueToken(pair.privateKey, 'lifetime', null)
    const redeemed = await useStore.getState().redeemLicense(key)
    expect(redeemed.ok).toBe(true)
    const res = useStore.getState().importJSON(JSON.stringify({
      tasks: [{ id: 'imported', title: 'From file', notes: '', projectId: null, section: null, priority: 2, dueDate: null, dueTime: null, completed: false, completedAt: null, important: false, archived: false, recurrence: null, subtasks: [], tags: [], createdAt: 1, updatedAt: 1, sortOrder: 0 }],
      projects: [],
      reviews: [{ id: 'r1', weekStart: '2026-10-19', savedAt: 1, summary: '', completed: 0, carriedOver: 0, overdue: 0, minutesLogged: 0, plannedMinutes: 0, wins: [], slips: [], adjustments: [], nextWeekFocus: [], wentWell: 'ok', improve: '', nextPriorities: '' }],
      settings: { ...defaultSettings(), licenseKey: 'TF1.forged.forged', plan: 'free', trialUsed: false },
    }))
    expect(res.ok).toBe(true)
    const s = useStore.getState().settings
    expect(s.licenseKey).toBe(key)
    expect(s.licenseVerified).toBe(true)
    expect(s.plan).toBe('pro')
    expect(useStore.getState().reviews).toHaveLength(1)
    expect(useStore.getState().tasks.some((t) => t.title === 'From file')).toBe(true)
  })

  it('merges a backup by id without dropping local tasks', () => {
    bareState()
    const keep = useStore.getState().addTask({ title: 'Keep me' })
    const shared = useStore.getState().addTask({ title: 'Old title' })
    expect(keep && shared).toBeTruthy()
    const res = useStore.getState().importJSON(
      JSON.stringify({
        tasks: [
          {
            id: shared!.id,
            title: 'New title',
            notes: '',
            projectId: null,
            section: null,
            priority: 3,
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
            updatedAt: Date.now() + 1000,
            sortOrder: 0,
          },
          {
            id: 'incoming-only',
            title: 'From merge',
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
          },
        ],
        projects: [],
      }),
      'merge'
    )
    expect(res.ok).toBe(true)
    const titles = useStore.getState().tasks.map((t) => t.title)
    expect(titles).toContain('Keep me')
    expect(titles).toContain('New title')
    expect(titles).toContain('From merge')
    expect(titles).not.toContain('Old title')
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

  it('saves a weekly review for the week', () => {
    bareState()
    const rec = useStore.getState().saveWeeklyReview({
      weekStart: '2026-10-19',
      summary: '3 finished',
      completed: 3,
      carriedOver: 1,
      overdue: 1,
      minutesLogged: 90,
      plannedMinutes: 120,
      wins: ['Ship'],
      slips: ['Rent'],
      adjustments: ['Protect a shorter day'],
      nextWeekFocus: ['Clear overdue'],
      wentWell: 'Shipped the redesign',
      improve: 'Fewer open loops',
      nextPriorities: 'Pay rent',
    })
    expect(rec.id).toBeTruthy()
    expect(useStore.getState().reviews).toHaveLength(1)
    expect(useStore.getState().reviews[0]?.wentWell).toBe('Shipped the redesign')
    useStore.getState().saveWeeklyReview({
      ...rec,
      weekStart: '2026-10-19',
      wentWell: 'Updated',
      improve: rec.improve,
      nextPriorities: rec.nextPriorities,
    })
    expect(useStore.getState().reviews).toHaveLength(1)
    expect(useStore.getState().reviews[0]?.wentWell).toBe('Updated')
  })

  it('applies a recovery plan without dumping everything on today', () => {
    bareState()
    const a = useStore.getState().addTask({ title: 'Pay rent', dueDate: '2020-01-01', priority: 4, important: true })
    const b = useStore.getState().addTask({ title: 'Organize desk', dueDate: '2020-01-01', priority: 1, postponeCount: 4 })
    const n = useStore.getState().applyRecovery([
      { id: a!.id, choice: 'today' },
      { id: b!.id, choice: 'drop' },
    ])
    expect(n).toBe(2)
    expect(useStore.getState().tasks.find((x) => x.id === a!.id)?.dueDate).toBe(todayISO())
    expect(useStore.getState().tasks.find((x) => x.id === b!.id)?.archived).toBe(true)
  })
})

describe('useStore goals', () => {
  beforeEach(() => {
    bareState()
    withTrial()
  })

  it('allows goals without a license while features are unlocked', () => {
    useStore.setState({ settings: defaultSettings() })
    expect(useStore.getState().addGoal({ title: 'Open' })).toBeTruthy()
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

  it('moves a task to a single goal via setTaskGoal', () => {
    const t = useStore.getState().addTask({ title: 'Draft' })!
    const a = useStore.getState().addGoal({ title: 'Goal A' })!
    const b = useStore.getState().addGoal({ title: 'Goal B' })!
    useStore.getState().setTaskGoal(t.id, a.id)
    expect(useStore.getState().goals.find((x) => x.id === a.id)?.taskIds).toContain(t.id)
    useStore.getState().setTaskGoal(t.id, b.id)
    expect(useStore.getState().goals.find((x) => x.id === a.id)?.taskIds).not.toContain(t.id)
    expect(useStore.getState().goals.find((x) => x.id === b.id)?.taskIds).toContain(t.id)
    useStore.getState().setTaskGoal(t.id, null)
    expect(useStore.getState().goals.find((x) => x.id === b.id)?.taskIds).not.toContain(t.id)
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
