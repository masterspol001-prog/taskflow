export type Priority = 1 | 2 | 3 | 4
export type ThemeMode = 'light' | 'dark' | 'system'
export type TimeFormat = '12h' | '24h'
export type CalendarViewMode = 'month' | 'week' | 'day'
export type FocusMode = 'pomodoro' | 'countdown' | 'stopwatch'
export type AccentId = 'violet' | 'indigo' | 'blue' | 'emerald' | 'teal' | 'rose'
export type PersonaId = 'work' | 'student' | 'creator' | 'life'
export type EnergyLevel = 'high' | 'medium' | 'low'

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
  /** Task ids that must finish first. */
  dependsOn?: string[]
  energy?: EnergyLevel | null
  /** Minutes actually spent, most recent last. */
  actualMinutes?: number[]
  postponeCount?: number
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

export type GoalHorizon = 'today' | 'week' | 'month' | '6m' | '1y' | '3y' | '5y'
export type GoalStatus = 'active' | 'completed' | 'paused' | 'archived'
export type GoalProgressType = 'task' | 'milestone' | 'percentage' | 'numeric' | 'habit'
export type GoalCategory = 'health' | 'finance' | 'career' | 'learning' | 'relationships' | 'personal'

export interface GoalMilestone {
  id: string
  title: string
  done: boolean
  /** yyyy-MM-dd due date (optional) */
  dueDate?: string | null
  /** Linked task generated from this milestone. */
  taskId?: string | null
}

export interface Goal {
  id: string
  title: string
  /** yyyy-MM-dd target (optional) */
  targetDate: string | null
  /** Linked project ids that count toward progress. */
  projectIds: string[]
  /** Linked task ids that count toward progress. */
  taskIds?: string[]
  color: string
  createdAt: number
  milestones?: GoalMilestone[]
  /** Planning horizon (5 years → today). */
  horizon?: GoalHorizon
  /** Parent goal for the hierarchy (5y → 3y → 1y → 6m → month → week → today). */
  parentId?: string | null
  status?: GoalStatus
  category?: GoalCategory
  /** "Why it matters" — motivation, shown in detail and reviews. */
  why?: string
  /** Success metric in words (e.g. "Save ₹6L"). */
  metric?: string
  progressType?: GoalProgressType
  /** Numeric target/current for numeric or percentage progress. */
  targetValue?: number | null
  currentValue?: number | null
  unit?: string
  completedAt?: number | null
  lastReviewedAt?: number | null
  /** Per-goal reminder control. Defaults to on. */
  notifications?: boolean
}

export type ViewId =
  | 'dashboard'
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'plan'
  | 'all'
  | 'completed'
  | 'important'
  | 'overdue'
  | 'waiting'
  | 'archived'
  | 'calendar'
  | 'goals'
  | 'routines'
  | 'rewards'
  | 'settings'

export type StreakRule = 'any-task' | 'daily-goal' | 'priority'

export type AchievementId =
  | 'first-task'
  | 'streak-3'
  | 'streak-7'
  | 'speed-runner'
  | 'priority-master'
  | 'deep-focus'
  | 'consistency-king'
  | 'perfect-day'
  | 'comeback'
  | 'century'

export interface AchievementUnlock {
  id: AchievementId
  unlockedAt: number
}

export interface FocusSession {
  id: string
  taskId: string | null
  minutes: number
  completedAt: number
}

export type XpSource = 'task' | 'focus' | 'plan' | 'goal'

export interface XpEvent {
  id: string
  source: XpSource
  sourceId: string
  amount: number
  at: number
}

export interface PersonalRecords {
  mostTasksInDay: number
  mostTasksInDayDate: string | null
  longestStreak: number
  mostFocusMinutesInDay: number
  mostFocusMinutesDate: string | null
  mostPriorityInDay: number
  bestCompletionPct: number
  mostProductiveWeek: number
  fastestTaskMinutes: number | null
}

export interface ProgressState {
  xp: number
  events: XpEvent[]
  achievements: AchievementUnlock[]
  sessions: FocusSession[]
  records: PersonalRecords
  streakFreezes: number
  freezeUsedDates: string[]
  lastFreezeEarnedAt: number
  lastActiveDate: string | null
  lastGapDays: number
}

export interface NotifyPrefs {
  achievements: boolean
  streak: boolean
  dailyReminder: boolean
  weeklyReview: boolean
}

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
  /** Redeemed after Razorpay checkout. */
  licenseKey: string
  licenseInterval: BillingInterval | null
  /** Epoch ms when a monthly/annual license lapses. Null for lifetime or legacy keys. */
  licenseExpiresAt: number | null
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
  energy: EnergyLevel
  streakRule: StreakRule
  notifyPrefs: NotifyPrefs
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
