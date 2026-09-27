import type { AccentId, PersonaId, Priority } from './types'

export const APP_NAME = 'TaskFlow'

export const PRIORITIES: Record<Priority, { label: string; short: string; color: string; bg: string }> = {
  1: { label: 'Low', short: 'p1', color: '#8a8ea3', bg: 'rgba(138,142,163,0.14)' },
  2: { label: 'Medium', short: 'p2', color: '#3b82f6', bg: 'rgba(59,130,246,0.14)' },
  3: { label: 'High', short: 'p3', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  4: { label: 'Urgent', short: 'p4', color: '#e5484d', bg: 'rgba(229,72,77,0.14)' },
}

export const PRIORITY_ORDER: Priority[] = [1, 2, 3, 4]

export const DEFAULT_PRIORITY: Priority = 2

/** Accent theming options shown in Settings/onboarding. Hex is the swatch. */
export const ACCENT_OPTIONS: { id: AccentId; label: string; hex: string }[] = [
  { id: 'violet', label: 'Violet', hex: '#6c5ce7' },
  { id: 'indigo', label: 'Indigo', hex: '#4f46e5' },
  { id: 'blue', label: 'Blue', hex: '#2563eb' },
  { id: 'emerald', label: 'Emerald', hex: '#059669' },
  { id: 'teal', label: 'Teal', hex: '#0f766e' },
  { id: 'rose', label: 'Rose', hex: '#e11d48' },
]

export const DEFAULT_ACCENT: AccentId = 'violet'

/** Life contexts that tailor starter content, wording and insights. */
export const PERSONAS: {
  id: PersonaId
  label: string
  short: string
  icon: string
  blurb: string
}[] = [
  {
    id: 'work',
    label: 'Work & career',
    short: 'Work',
    icon: 'briefcase',
    blurb: 'Deadlines, meetings, clients and the projects that move you forward.',
  },
  {
    id: 'student',
    label: 'Student',
    short: 'Student',
    icon: 'graduationCap',
    blurb: 'Lectures, assignments, exams and squeezing in a life around them.',
  },
  {
    id: 'creator',
    label: 'Creator',
    short: 'Creator',
    icon: 'camera',
    blurb: 'Content pipelines, client gigs, audience growth and getting paid.',
  },
  {
    id: 'life',
    label: 'Life & home',
    short: 'Life',
    icon: 'heart',
    blurb: 'People, health, finances, errands and the running of a full life.',
  },
]

export function personaMeta(id: PersonaId | null) {
  return PERSONAS.find((p) => p.id === id) ?? null
}

/** Project palette (name-keyed for human friendly config) */
export const PROJECT_COLORS: Record<string, string> = {
  grape: '#8e5cf7',
  blue: '#3b82f6',
  green: '#2f9e6e',
  teal: '#0d9488',
  yellow: '#d9a514',
  orange: '#f97316',
  red: '#e5484d',
  pink: '#e7549e',
  gray: '#6b7280',
}

export const PROJECT_ICONS: Record<string, string> = {
  briefcase: 'briefcase',
  user: 'user',
  book: 'book',
  dumbbell: 'dumbbell',
  shoppingCart: 'shoppingCart',
  plane: 'plane',
  heart: 'heart',
  home: 'home',
  creditCard: 'creditCard',
  graduationCap: 'graduationCap',
  music: 'music',
  camera: 'camera',
  dollarSign: 'dollarSign',
  inbox: 'inbox',
  sparkles: 'sparkles',
}

export const TAGS = [
  'ideas',
  'blocked',
  'quick',
  'waiting',
  'follow-up',
  'deep-work',
  'errand',
  'personal',
]

export const VIEW_META = {
  dashboard: { label: 'Dashboard', icon: 'layoutDashboard' },
  inbox: { label: 'Inbox', icon: 'inbox' },
  today: { label: 'Today', icon: 'sun' },
  upcoming: { label: 'Upcoming', icon: 'calendarClock' },
  all: { label: 'All tasks', icon: 'listChecks' },
  completed: { label: 'Completed', icon: 'checkCheck' },
  important: { label: 'Important', icon: 'star' },
  overdue: { label: 'Overdue', icon: 'alertTriangle' },
  archived: { label: 'Archived', icon: 'archive' },
  calendar: { label: 'Calendar', icon: 'calendarDays' },
  goals: { label: 'Goals', icon: 'flag' },
  routines: { label: 'Routines', icon: 'repeat' },
  settings: { label: 'Settings', icon: 'settings' },
} as const
