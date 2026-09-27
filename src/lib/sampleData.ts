import type { PersonaId, Project, Settings, Task } from '@/lib/types'
import { uid } from '@/lib/dates'
import { relativeToToday, toISODate } from '@/lib/dates'
import { PERSONA_PRESETS, type PersonaPreset, type ProjectSpec, type SeedTask } from '@/lib/personas'

/** Starter content shown when the user has not picked a life context. */
const GENERIC_PRESET: PersonaPreset = {
  projects: [
    { key: 'work', name: 'Work', color: '#3b82f6', icon: 'briefcase', description: 'Client work, meetings and deadlines', sections: ['Active', 'Planning'] },
    { key: 'personal', name: 'Personal', color: '#8e5cf7', icon: 'heart', description: 'Life admin and personal goals' },
    { key: 'study', name: 'Study', color: '#0d9488', icon: 'graduationCap', description: 'Courses, reading and practice', sections: ['Reading', 'Practice'] },
    { key: 'fitness', name: 'Fitness', color: '#2f9e6e', icon: 'dumbbell', description: 'Training and health routines' },
    { key: 'shopping', name: 'Shopping', color: '#d9a514', icon: 'shoppingCart', description: 'Groceries and purchases' },
    { key: 'travel', name: 'Travel', color: '#f97316', icon: 'plane', description: 'Trips, bookings and packing' },
  ],
  seeds: [
    // Work
    { title: 'Finish quarterly report', projectKey: 'work', priority: 4, dueOffset: 0, dueTime: '17:00', section: 'Active', tags: ['follow-up'], important: true, subtasks: [{ t: 'Collect sales data', d: true }, { t: 'Draft narrative', d: true }, { t: 'Build charts' }, { t: 'Review with manager' }] },
    { title: 'Prepare client presentation deck', projectKey: 'work', priority: 3, dueOffset: 1, dueTime: '10:00', section: 'Active', notes: 'Include updated growth numbers and case studies.' },
    { title: 'Review pull requests', projectKey: 'work', priority: 2, dueOffset: 0, section: 'Active', tags: ['deep-work'], completed: true, completedOffset: 0 },
    { title: 'Schedule 1:1 with the design team', projectKey: 'work', priority: 2, dueOffset: 2, section: 'Active' },
    { title: 'Draft Q3 OKRs', projectKey: 'work', priority: 2, dueOffset: 6, section: 'Planning', tags: ['ideas'] },
    { title: 'Reply to vendor contract emails', projectKey: 'work', priority: 3, dueOffset: -1, section: 'Active', tags: ['waiting'] },
    // Personal
    { title: 'Book dentist appointment', projectKey: 'personal', priority: 3, dueOffset: 3 },
    { title: 'Pay electricity bill', projectKey: 'personal', priority: 4, dueOffset: -2, tags: ['blocked'], important: true },
    { title: 'Renew gym membership', projectKey: 'personal', priority: 2, dueOffset: 8 },
    { title: 'Call mom', projectKey: 'personal', priority: 2, dueOffset: 0, dueTime: '19:00' },
    { title: 'Water the plants', projectKey: 'personal', priority: 1, dueOffset: 0, recurrence: { freq: 'weekly', interval: 1 } },
    // Study
    { title: 'Study React patterns', projectKey: 'study', priority: 3, dueOffset: 0, section: 'Practice', notes: 'Chapter 7 — compound components.', tags: ['deep-work'] },
    { title: 'Read 20 pages of "Deep Work"', projectKey: 'study', priority: 2, dueOffset: 0, section: 'Reading' },
    { title: 'Finish TypeScript course quiz', projectKey: 'study', priority: 2, dueOffset: 2, section: 'Practice', completed: true, completedOffset: -1 },
    // Fitness
    { title: 'Gym workout — upper body', projectKey: 'fitness', priority: 3, dueOffset: 0, dueTime: '07:00' },
    { title: 'Evening run 5km', projectKey: 'fitness', priority: 2, dueOffset: 1 },
    { title: 'Morning yoga', projectKey: 'fitness', priority: 1, dueOffset: 0, recurrence: { freq: 'daily', interval: 1 } },
    // Shopping
    { title: 'Buy groceries', projectKey: 'shopping', priority: 3, dueOffset: 0, tags: ['errand'], subtasks: [{ t: 'Fruit & vegetables' }, { t: 'Dairy' }, { t: 'Bread' }] },
    { title: 'Buy birthday gift for Alex', projectKey: 'shopping', priority: 3, dueOffset: 5, tags: ['errand'] },
    { title: 'Refill printer ink', projectKey: 'shopping', priority: 1, dueOffset: 3 },
    // Travel
    { title: 'Book flight to Lisbon', projectKey: 'travel', priority: 4, dueOffset: 4, notes: 'Compare early-morning options.', important: true },
    { title: 'Book hotel for conference', projectKey: 'travel', priority: 3, dueOffset: 4 },
    { title: 'Research things to do in Lisbon', projectKey: 'travel', priority: 2, dueOffset: 9, tags: ['ideas'] },
    // No project (Inbox)
    { title: 'Plan team offsite agenda', priority: 2, dueOffset: 2 },
    { title: 'Send thank-you note to Sara', priority: 1, dueOffset: 0, completed: true, completedOffset: 0 },
    { title: 'Organize desk drawers', priority: 1, notes: 'Declutter cables and stationery.', tags: ['quick'] },
    { title: 'Call John about weekend plans', priority: 2, dueOffset: 1 },
    { title: 'Prepare presentation', priority: 3, dueOffset: -3, completed: true, completedOffset: -3 },
  ],
  extras: [
    { title: 'Morning standup notes', projectKey: 'work', completed: true, completedOffset: 0 },
    { title: 'Stretch break', projectKey: 'fitness', completed: true, completedOffset: 0 },
    { title: 'Email review', projectKey: 'work', completed: true, completedOffset: -1 },
    { title: 'Meditation 10 min', projectKey: 'personal', completed: true, completedOffset: -1 },
    { title: 'Update portfolio site', projectKey: 'work', completed: true, completedOffset: -2, priority: 3 },
    { title: 'Meal prep', projectKey: 'personal', completed: true, completedOffset: -2 },
    { title: 'Laundry', projectKey: 'personal', completed: true, completedOffset: -3, priority: 1 },
    { title: 'Code review follow-ups', projectKey: 'work', completed: true, completedOffset: -3 },
  ],
}

function buildProjects(specs: ProjectSpec[]): Project[] {
  return specs.map((s) => ({
    id: `proj-${s.key}`,
    name: s.name,
    color: s.color,
    icon: s.icon,
    description: s.description,
    sections: s.sections ?? [],
    archived: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 30,
  }))
}

function buildTasks(preset: PersonaPreset, now: Date): Task[] {
  let order = 0
  const base = now.getTime()

  const tasks: Task[] = preset.seeds.map((s) => {
    const due = s.dueOffset !== undefined ? relativeToToday(s.dueOffset) : null
    const created = new Date(base - (s.dueOffset ?? 5) * 86400000 - Math.random() * 86400000)
    const task: Task = {
      id: uid('task-'),
      title: s.title,
      notes: s.notes ?? '',
      projectId: s.projectKey ? `proj-${s.projectKey}` : null,
      section: s.section ?? null,
      priority: s.priority ?? 2,
      dueDate: due,
      dueTime: s.dueTime ?? null,
      completed: s.completed ?? false,
      completedAt: s.completed ? base - (s.completedOffset ?? 0) * 86400000 : null,
      important: s.important ?? false,
      archived: false,
      recurrence: s.recurrence ?? null,
      subtasks: (s.subtasks ?? []).map((sub) => ({ id: uid('sub-'), title: sub.t, completed: sub.d ?? false })),
      tags: s.tags ?? [],
      createdAt: created.getTime(),
      updatedAt: base,
      sortOrder: order++,
    }
    return task
  })

  // Recently completed items — bring dashboard & streaks alive
  const extra = preset.extras.map((s) => {
    const completedAt = new Date(base)
    completedAt.setDate(completedAt.getDate() - (s.completedOffset ?? 0))
    completedAt.setHours(12 + (order % 8), (order * 7) % 60)
    const created = completedAt.getTime() - 86400000 * 2
    return {
      id: uid('task-'),
      title: s.title,
      notes: '',
      projectId: s.projectKey ? `proj-${s.projectKey}` : null,
      section: null,
      priority: s.priority ?? 2,
      dueDate: toISODate(completedAt),
      dueTime: null,
      completed: true,
      completedAt: completedAt.getTime(),
      important: false,
      archived: false,
      recurrence: null,
      subtasks: [],
      tags: [],
      createdAt: created,
      updatedAt: completedAt.getTime(),
      sortOrder: order++,
    } as Task
  })

  return [...tasks, ...extra]
}

/**
 * Build realistic starter content. Pass a persona to tailor the workspace to
 * how the person actually works; `null` produces a balanced generic sample.
 */
export function buildSampleData(now: Date, persona: PersonaId | null = null): { tasks: Task[]; projects: Project[] } {
  const preset = persona ? PERSONA_PRESETS[persona] : GENERIC_PRESET
  return {
    projects: buildProjects(preset.projects),
    tasks: buildTasks(preset, now),
  }
}

export function sampleProjects(): Project[] {
  return buildSampleData(new Date()).projects
}

export function defaultSettings(): Settings {
  return {
    name: '',
    theme: 'system',
    accent: 'violet',
    persona: null,
    plan: 'free',
    trialEndsAt: null,
    trialUsed: false,
    licenseKey: '',
    licenseInterval: null,
    checkout: { monthly: '', annual: '', lifetime: '' },
    startOfWeek: 1,
    timeFormat: '24h',
    defaultPriority: 2,
    defaultView: 'today',
    notificationsEnabled: false,
    reminderLeadMinutes: 10,
    weekStartMonday: true,
    reduceMotion: false,
    onboarded: false,
    onboardingStepDone: [],
  }
}

export function normalizeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const base = defaultSettings()
  if (!raw || typeof raw !== 'object') return base
  const checkout = (raw.checkout && typeof raw.checkout === 'object' ? raw.checkout : {}) as Partial<Settings['checkout']>
  return {
    ...base,
    ...raw,
    checkout: {
      monthly: typeof checkout.monthly === 'string' ? checkout.monthly : '',
      annual: typeof checkout.annual === 'string' ? checkout.annual : '',
      lifetime: typeof checkout.lifetime === 'string' ? checkout.lifetime : '',
    },
    licenseKey: typeof raw.licenseKey === 'string' ? raw.licenseKey : '',
    trialEndsAt: typeof raw.trialEndsAt === 'number' ? raw.trialEndsAt : null,
    trialUsed: !!raw.trialUsed,
    licenseInterval: raw.licenseInterval ?? null,
    onboardingStepDone: Array.isArray(raw.onboardingStepDone) ? raw.onboardingStepDone : [],
  }
}
