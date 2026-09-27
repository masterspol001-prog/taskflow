export type Priority = 1 | 2 | 3 | 4
export type ThemeMode = 'light' | 'dark' | 'system'
export type TimeFormat = '12h' | '24h'
export type CalendarViewMode = 'month' | 'week' | 'day'
export type FocusMode = 'pomodoro' | 'countdown' | 'stopwatch'
export type AccentId = 'violet' | 'indigo' | 'blue' | 'emerald' | 'teal' | 'rose'
export type PersonaId = 'work' | 'student' | 'creator' | 'life'

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurrence {
  freq: RecurrenceFreq
  interval: number
}

export interface Task {
  id: string
  title: string
  notes: string
  projectId: string | null
  /** null = no section (falls under project top level) */
  section: string | null
  priority: Priority
  /** ISO date yyyy-MM-dd or null */
  dueDate: string | null
  /** "HH:mm" 24h or null */
  dueTime: string | null
  /** Estimated effort in minutes (optional). */
  estimate?: number | null
  completed: boolean
  completedAt: number | null
  important: boolean
  archived: boolean
  recurrence: Recurrence | null
  subtasks: Subtask[]
  tags: string[]
  createdAt: number
  updatedAt: number
  /** Ordering index within its group */
  sortOrder: number
}

export interface Project {
  id: string
  name: string
  color: string
  /** lucide icon name key */
  icon: string
  description: string
  archived: boolean
  /** Named sections for this project */
  sections: string[]
  createdAt: number
}

export type Plan = 'free' | 'pro'
export type BillingInterval = 'monthly' | 'annual' | 'lifetime'

export interface CheckoutLinks {
  monthly: string
  annual: string
  lifetime: string
}

export interface Goal {
  id: string
  title: string
  /** yyyy-MM-dd target (optional) */
  targetDate: string | null
  /** Linked project ids that count toward progress. */
  projectIds: string[]
  color: string
  createdAt: number
}

export type ViewId =
  | 'dashboard'
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'all'
  | 'completed'
  | 'important'
  | 'overdue'
  | 'archived'
  | 'calendar'
  | 'goals'
  | 'routines'
  | 'settings'

export interface ViewRoute {
  id: ViewId
  projectId?: string
  section?: string | null
}

export interface Settings {
  name: string
  theme: ThemeMode
  accent: AccentId
  /** Life context used to tailor starter content and insights. */
  persona: PersonaId | null
  plan: Plan
  /** Epoch ms when the 7-day Pro trial ends. Null until started. */
  trialEndsAt: number | null
  trialUsed: boolean
  /** Redeemed after Lemon Squeezy / Stripe checkout. */
  licenseKey: string
  licenseInterval: BillingInterval | null
  checkout: CheckoutLinks
  startOfWeek: 0 | 1
  timeFormat: TimeFormat
  defaultPriority: Priority
  defaultView: ViewId
  notificationsEnabled: boolean
  reminderLeadMinutes: number
  weekStartMonday: boolean
  reduceMotion: boolean
  onboarded: boolean
  onboardingStepDone: string[]
  /** Optional user-supplied OpenAI-compatible endpoint for LLM features (Pro). Stored on-device only. */
  ai?: {
    baseUrl: string
    model: string
    apiKey: string
  } | null
}

export type AppStatus = 'idle' | 'loading' | 'error'

export interface AppState {
  status: AppStatus
  error: string | null
}
