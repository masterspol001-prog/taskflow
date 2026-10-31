import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  BillingInterval,
  EnergyLevel,
  Goal,
  GoalCategory,
  GoalHorizon,
  GoalProgressType,
  GoalStatus,
  Note,
  PersonaId,
  ProgressState,
  Project,
  Recurrence,
  SavedFilter,
  SavedWeeklyReview,
  Settings,
  Task,
} from '@/lib/types'
import { TRIAL_DAYS, canAddGoal, canAddProject, canAddTask, checkoutUrl, devUnlockPatch, expiredTrialPatch, isSafeCheckoutUrl, licenseValid, planLabel, trialSettingsPatch } from '@/lib/pro'
import { verifyLicenseToken } from '@/lib/license'
import { safeStateStorage } from '@/lib/storage'
import { trackFunnel } from '@/lib/funnel'
import { uid, todayISO, nextRecurrenceISO, addDaysISO } from '@/lib/dates'
import { postponeDate, rescheduleMissed as computeReschedule } from '@/lib/agent'
import { recoveryPatches, type RecoveryChoice } from '@/lib/recovery'
import { snoozePatch, snoozeLabel, shutdownPatch, morningPatch, parkPatch, unparkPatch, type SnoozeKind, type ShutdownChoice, type MorningChoice } from '@/lib/dayflow'
import { WORKFLOW_TEMPLATES, whatIfDelay } from '@/lib/workspace'
import { useUIStore } from '@/store/useUIStore'
import { milestonesNeedingTasks, tasksFromMilestone } from '@/lib/goals'
import { parseICS } from '@/lib/ics'
import { buildSampleData, defaultSettings, normalizeSettings } from '@/lib/sampleData'
import type { ParsedQuickAdd } from '@/lib/nlparser'
import {
  applyFocusSession,
  applyGoalComplete,
  applyTaskComplete,
  backfillFromHistory,
  emptyProgress,
  maybeUseFreeze,
  normalizeProgress,
  type RewardPulse,
} from '@/lib/progress'

export interface ToastMsg {
  id: string
  title: string
  message?: string
  kind: 'success' | 'error' | 'info'
  actionLabel?: string
  onAction?: () => void
}

export interface QuickAddDraft extends ParsedQuickAdd {
  open: boolean
}

export interface GoalInput {
  title: string
  targetDate?: string | null
  projectIds?: string[]
  taskIds?: string[]
  color?: string
  milestones?: Goal['milestones']
  horizon?: GoalHorizon
  parentId?: string | null
  status?: GoalStatus
  category?: GoalCategory
  why?: string
  metric?: string
  progressType?: GoalProgressType
  targetValue?: number | null
  currentValue?: number | null
  unit?: string
  notifications?: boolean
}

interface TaskflowState {
  tasks: Task[]
  projects: Project[]
  notes: Note[]
  goals: Goal[]
  reviews: SavedWeeklyReview[]
  savedFilters: SavedFilter[]
  settings: Settings
  progress: ProgressState
  lastReward: RewardPulse | null
  toasts: ToastMsg[]
  status: 'idle' | 'loading' | 'ready'
  hydrated: boolean

  // ---- lifecycle ----
  seed: (persona?: PersonaId | null) => void
  clearAll: () => void
  toast: (t: Omit<ToastMsg, 'id'>) => void
  dismissToast: (id: string) => void

  // ---- settings ----
  updateSettings: (patch: Partial<Settings>) => void
  completeOnboarding: () => void

  // ---- tasks ----
  addTask: (input: Partial<Task> & { title: string }) => Task | null
  addQuickTask: (draft: ParsedQuickAdd) => Task | null
  updateTask: (id: string, patch: Partial<Task>) => void
  removeTask: (id: string) => void
  toggleComplete: (id: string, completed?: boolean) => void
  toggleImportant: (id: string) => void
  toggleArchive: (id: string) => void
  duplicateTask: (id: string) => void
  moveTask: (id: string, order: number) => void
  reorderTask: (id: string, dir: number) => void
  reorderIds: (ids: string[]) => void
  setSubtasks: (id: string, subtasks: Task['subtasks']) => void

  // ---- projects ----
  addProject: (name: string, color?: string) => Project | null
  updateProject: (id: string, patch: Partial<Project>) => void
  removeProject: (id: string) => void
  toggleProjectArchive: (id: string) => void
  addSection: (projectId: string, section: string) => void
  removeSection: (projectId: string, section: string) => void
  duplicateProject: (id: string) => Project | null
  applyWorkflow: (templateId: string) => Project | null
  applyWhatIf: (projectId: string, delayDays: number) => number
  addNote: (input: Partial<Note> & { title: string }) => Note | null
  updateNote: (id: string, patch: Partial<Note>) => void
  removeNote: (id: string) => void

  // ---- goals ----
  addGoal: (input: GoalInput) => Goal | null
  updateGoal: (id: string, patch: Partial<Goal>) => void
  removeGoal: (id: string) => void
  setGoalStatus: (id: string, status: GoalStatus) => void
  setGoalValue: (id: string, currentValue: number) => void
  toggleGoalMilestone: (goalId: string, milestoneId: string) => void
  addTaskToGoal: (goalId: string, input: Partial<Task> & { title: string }) => Task | null
  linkTaskToGoal: (goalId: string, taskId: string) => void
  unlinkTaskFromGoal: (goalId: string, taskId: string) => void
  setTaskGoal: (taskId: string, goalId: string | null) => void
  generateMilestoneTasks: (goalId: string) => number
  skipOccurrence: (id: string) => void
  postponeTask: (id: string) => void
  snoozeTask: (id: string, kind: SnoozeKind) => void
  setWaitingOn: (id: string, waitingOn: string | null) => void
  commitToday: (ids?: string[]) => void
  uncommitTask: (id: string) => void
  applyShutdown: (choices: { id: string; choice: ShutdownChoice }[]) => number
  applyMorning: (choices: { id: string; choice: MorningChoice }[]) => number
  parkTask: (id: string) => void
  unparkTask: (id: string) => void
  updateTasks: (ids: string[], patch: Partial<Task>) => void
  logRoutineDay: (id: string, dateISO: string) => void
  logFocusMinutes: (id: string, minutes: number, interruptions?: number) => void
  setEnergy: (energy: EnergyLevel) => void
  rescheduleMissed: () => number
  applyRecovery: (choices: { id: string; choice: RecoveryChoice }[]) => number
  saveWeeklyReview: (input: Omit<SavedWeeklyReview, 'id' | 'savedAt'>) => SavedWeeklyReview
  saveFilter: (input: Omit<SavedFilter, 'id' | 'createdAt'>) => SavedFilter | null
  removeFilter: (id: string) => void
  importICS: (ics: string) => { ok: boolean; added: number; error?: string }
  clearReward: () => void

  // ---- import/export ----
  exportJSON: () => void
  exportCSV: () => void
  importJSON: (json: string, mode?: 'replace' | 'merge') => { ok: boolean; error?: string; added?: number }

  startTrial: () => { ok: boolean; error?: string }
  redeemLicense: (key: string) => Promise<{ ok: boolean; error?: string; interval?: BillingInterval }>
  openCheckout: (interval: BillingInterval) => { ok: boolean; error?: string }
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt)
}

function applyCompletionReward(
  get: () => TaskflowState,
  set: (partial: Partial<TaskflowState> | ((s: TaskflowState) => Partial<TaskflowState>)) => void,
  task: Task
) {
  const st = get()
  const withFreeze = maybeUseFreeze(st.progress, st.tasks, st.settings.streakRule ?? 'any-task')
  const rewarded = applyTaskComplete(withFreeze, st.tasks, task, st.settings)
  set({ progress: rewarded.progress, lastReward: rewarded.pulse })
  const prefs = st.settings.notifyPrefs
  if (rewarded.pulse.xpAwarded > 0 || rewarded.pulse.newAchievements.length) {
    if (prefs?.achievements !== false) {
      get().toast({
        title: rewarded.pulse.toastTitle,
        message: rewarded.pulse.toastMessage,
        kind: 'success',
      })
    }
  }
}

const SAMPLE_TAGS = ['ideas', 'blocked', 'quick', 'waiting', 'follow-up', 'deep-work', 'errand']

export const useStore = create<TaskflowState>()(
  persist(
    (set, get) => ({
      tasks: [],
      projects: [],
      notes: [],
      goals: [],
      reviews: [],
      savedFilters: [],
      settings: defaultSettings(),
      progress: emptyProgress(),
      lastReward: null,
      toasts: [],
      status: 'idle',
      hydrated: false,

      seed: (persona?: PersonaId | null) => {
        const sample = buildSampleData(
          new Date(),
          persona !== undefined ? persona : get().settings.persona
        )
        const s = get()
        const existingProjectIds = new Set(s.projects.map((p) => p.id))
        const idMap = new Map<string, string>()
        const projects = sample.projects.map((p) => {
          if (!existingProjectIds.has(p.id)) {
            existingProjectIds.add(p.id)
            return p
          }
          const nextId = uid('proj-')
          idMap.set(p.id, nextId)
          existingProjectIds.add(nextId)
          return { ...p, id: nextId }
        })
        const existingTaskIds = new Set(s.tasks.map((t) => t.id))
        const tasks = sample.tasks.map((t) => {
          const projectId = t.projectId && idMap.has(t.projectId) ? idMap.get(t.projectId)! : t.projectId
          const id = existingTaskIds.has(t.id) ? uid('task-') : t.id
          existingTaskIds.add(id)
          return { ...t, id, projectId }
        })
        set({
          tasks: [...s.tasks, ...tasks],
          projects: [...s.projects, ...projects],
          status: 'ready',
        })
      },

      clearAll: () => {
        set({
          tasks: [],
          projects: [],
          notes: [],
          goals: [],
          reviews: [],
          savedFilters: [],
          progress: emptyProgress(),
          lastReward: null,
          settings: defaultSettings(),
        })
      },

      clearReward: () => set({ lastReward: null }),

      toast: (t) => {
        const msg = { ...t, id: uid('toast-') }
        set((s) => ({ toasts: [...s.toasts.slice(-2), msg] }))
        window.setTimeout(() => get().dismissToast(msg.id), t.onAction ? 7000 : 4200)
      },

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      updateSettings: (patch) =>
        set((s) => {
          const next = { ...s.settings, ...patch }
          if (patch.weekStartMonday !== undefined && patch.startOfWeek === undefined) {
            next.startOfWeek = patch.weekStartMonday ? 1 : 0
          } else if (patch.startOfWeek !== undefined && patch.weekStartMonday === undefined) {
            next.weekStartMonday = patch.startOfWeek === 1
          }
          return { settings: next }
        }),

      completeOnboarding: () =>
        set((s) => {
          const settings = { ...s.settings, onboarded: true }
          if (s.tasks.length === 0) {
            const sample = buildSampleData(new Date(), settings.persona)
            return { settings, tasks: sample.tasks, projects: sample.projects }
          }
          return { settings }
        }),

      addTask: (input) => {
        const title = input.title.trim()
        if (!title) {
          get().toast({ title: 'Give the task a name', kind: 'info' })
          return null
        }
        const { settings, tasks } = get()
        if (!canAddTask(settings, tasks)) {
          get().toast({
            title: 'Free includes 40 active tasks',
            message: 'Start a 7-day trial or buy a prepaid Pro license to add more.',
            kind: 'info',
          })
          queueMicrotask(() => useUIStore.getState().setPaywall(true))
          return null
        }
        const t: Task = {
          id: uid('task-'),
          title,
          notes: input.notes ?? '',
          projectId: input.projectId ?? null,
          section: input.section ?? null,
          priority: input.priority ?? settings.defaultPriority,
          dueDate: input.dueDate ?? null,
          dueTime: input.dueTime ?? null,
          estimate: input.estimate ?? null,
          completed: false,
          completedAt: null,
          important: input.important ?? false,
          archived: false,
          recurrence: input.recurrence ?? null,
          subtasks: input.subtasks ?? [],
          tags: input.tags ?? [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sortOrder: get().tasks.length,
          dependsOn: input.dependsOn ?? [],
          energy: input.energy ?? null,
          actualMinutes: input.actualMinutes ?? [],
          postponeCount: input.postponeCount ?? 0,
          waitingOn: input.waitingOn ?? null,
          committedDate: input.committedDate ?? null,
          snoozeUntil: input.snoozeUntil ?? null,
          parked: input.parked ?? false,
        }
        set((s) => ({ tasks: [...s.tasks, t] }))
        return t
      },

      addQuickTask: (draft) => {
        const s = get()
        let projectId: string | null = null
        if (draft.projectKey) {
          const match = s.projects.find(
            (p) => p.name.toLowerCase() === draft.projectKey?.toLowerCase()
          )
          projectId = match ? match.id : null
        }
        const task = s.addTask({
          title: draft.title || 'Untitled task',
          projectId,
          priority: draft.priority ?? s.settings.defaultPriority,
          dueDate: draft.dueDate,
          dueTime: draft.dueTime,
          estimate: draft.estimate,
          tags: draft.tags,
          recurrence: draft.recurrence,
        })
        return task
      },

      updateTask: (id, patch) =>
        set((st) => ({
          tasks: st.tasks.map((t) =>
            t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
          ),
        })),

      removeTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return
        set((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) }))
        get().toast({
          title: 'Task deleted',
          message: task.title,
          kind: 'info',
          actionLabel: 'Undo',
          onAction: () => {
            set((st) => {
              if (st.tasks.some((t) => t.id === task.id)) return st
              return { tasks: sortTasks([...st.tasks, task]) }
            })
          },
        })
      },

      toggleComplete: (id, completed) => {
        const s = get()
        const task = s.tasks.find((t) => t.id === id)
        if (!task) return
        const next = completed ?? !task.completed
        let tasks = s.tasks

        if (next && task.recurrence) {
          const from = task.dueDate ?? todayISO()
          const nextDue = nextRecurrenceISO(from, task.recurrence.freq, task.recurrence.interval)
          const log: Task = {
            ...task,
            id: uid('task-'),
            recurrence: null,
            completed: true,
            completedAt: Date.now(),
            archived: false,
            updatedAt: Date.now(),
            sortOrder: task.sortOrder,
          }
          tasks = [
            ...tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    completed: false,
                    completedAt: null,
                    dueDate: nextDue,
                    subtasks: t.subtasks.map((sub) => ({ ...sub, completed: false })),
                    updatedAt: Date.now(),
                  }
                : t
            ),
            log,
          ]
          set({ tasks: sortTasks(tasks) })
          applyCompletionReward(get, set, { ...log, completed: true, completedAt: Date.now() })
          get().toast({ title: 'Logged', message: `Next: ${nextDue}`, kind: 'success' })
          return
        }

        tasks = tasks.map((t) =>
          t.id === id
            ? { ...t, completed: next, completedAt: next ? Date.now() : null, updatedAt: Date.now() }
            : t
        )
        const goals = s.goals.map((g) => {
          const ms = g.milestones ?? []
          if (!ms.some((m) => m.taskId === id)) return g
          return {
            ...g,
            milestones: ms.map((m) => (m.taskId === id ? { ...m, done: next } : m)),
          }
        })
        set({ tasks: sortTasks(tasks), goals })
        if (next) {
          const completed = tasks.find((t) => t.id === id) ?? { ...task, completed: true, completedAt: Date.now() }
          applyCompletionReward(get, set, completed)
          const day = todayISO()
          const remainingToday = tasks.filter(
            (t) => t.id !== id && !t.archived && !t.completed && t.dueDate === day
          ).length
          const completedToday = tasks.filter(
            (t) => t.completed && !t.archived && t.completedAt && t.dueDate === day
          ).length
          const undo = { actionLabel: 'Undo', onAction: () => get().toggleComplete(id, false) }
          if (task.dueDate === day && remainingToday === 0 && completedToday > 0) {
            get().toast({ title: 'Today is clear', message: 'Beautiful work. Rest, or get ahead.', kind: 'success', ...undo })
          } else {
            get().toast({ title: 'Done', message: task.title, kind: 'success', ...undo })
          }
        }
      },

      skipOccurrence: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task?.recurrence) return
        const from = task.dueDate ?? todayISO()
        const nextDue = nextRecurrenceISO(from, task.recurrence.freq, task.recurrence.interval)
        set((st) => ({
          tasks: st.tasks.map((t) => (t.id === id ? { ...t, dueDate: nextDue, updatedAt: Date.now() } : t)),
        }))
        get().toast({ title: 'Skipped', message: `Next: ${nextDue}`, kind: 'info' })
      },

      postponeTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task || task.completed || task.archived) return
        const next = postponeDate(task.dueDate)
        set((st) => ({
          tasks: st.tasks.map((t) =>
            t.id === id
              ? { ...t, dueDate: next, postponeCount: (t.postponeCount ?? 0) + 1, updatedAt: Date.now() }
              : t
          ),
        }))
        get().toast({ title: 'Postponed', message: `Moved to ${next}`, kind: 'info' })
      },

      snoozeTask: (id, kind) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task || task.completed || task.archived) return
        const patch = snoozePatch(task, kind)
        set((st) => ({
          tasks: st.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)),
        }))
        get().toast({ title: 'Snoozed', message: `${task.title} → ${snoozeLabel(kind).toLowerCase()}`, kind: 'info' })
      },

      setWaitingOn: (id, waitingOn) => {
        const value = waitingOn?.trim() || null
        set((st) => ({
          tasks: st.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  waitingOn: value,
                  tags: value
                    ? Array.from(new Set([...(t.tags ?? []).filter((tag) => tag.toLowerCase() !== 'waiting'), 'waiting']))
                    : (t.tags ?? []).filter((tag) => tag.toLowerCase() !== 'waiting'),
                  updatedAt: Date.now(),
                }
              : t
          ),
        }))
      },

      commitToday: (ids) => {
        const today = todayISO()
        const s = get()
        const chosen = ids && ids.length ? ids : s.tasks.filter((t) => !t.archived && !t.completed && t.dueDate === today).map((t) => t.id)
        if (!chosen.length) {
          get().toast({ title: 'Nothing to commit', message: 'Pull a few tasks onto today first.', kind: 'info' })
          return
        }
        const idSet = new Set(chosen)
        set({
          tasks: s.tasks.map((t) =>
            idSet.has(t.id) ? { ...t, dueDate: today, committedDate: today, snoozeUntil: null, updatedAt: Date.now() } : t
          ),
          settings: { ...s.settings, committedDate: today, committedTaskIds: chosen },
        })
        get().toast({ title: 'Today is committed', message: `${chosen.length} ${chosen.length === 1 ? 'task' : 'tasks'} locked for today.`, kind: 'success' })
      },

      uncommitTask: (id) => {
        const today = todayISO()
        set((st) => ({
          tasks: st.tasks.map((t) => (t.id === id ? { ...t, committedDate: t.committedDate === today ? null : t.committedDate, updatedAt: Date.now() } : t)),
          settings: {
            ...st.settings,
            committedTaskIds: (st.settings.committedTaskIds ?? []).filter((x) => x !== id),
          },
        }))
      },

      applyShutdown: (choices) => {
        const today = todayISO()
        const map = new Map(choices.map((c) => [c.id, c.choice]))
        set((st) => ({
          tasks: choices.length
            ? st.tasks.map((t) => {
                const choice = map.get(t.id)
                if (!choice) return t
                const patch = shutdownPatch(choice, today)
                const next: Task = { ...t, ...patch, updatedAt: Date.now() }
                if (choice === 'tomorrow') next.postponeCount = (t.postponeCount ?? 0) + 1
                return next
              })
            : st.tasks,
          settings: { ...st.settings, lastShutdownDate: today, committedDate: null, committedTaskIds: [] },
        }))
        get().toast({
          title: 'Day shut down',
          message: choices.length
            ? `${choices.length} leftover ${choices.length === 1 ? 'task' : 'tasks'} handled.`
            : 'Today is closed.',
          kind: 'success',
        })
        return choices.length
      },

      applyMorning: (choices) => {
        const today = todayISO()
        const map = new Map(choices.map((c) => [c.id, c.choice]))
        const commitIds = choices.filter((c) => c.choice === 'commit').map((c) => c.id)
        set((st) => ({
          tasks: choices.length
            ? st.tasks.map((t) => {
                const choice = map.get(t.id)
                if (!choice) return t
                return { ...t, ...morningPatch(choice, today), updatedAt: Date.now() }
              })
            : st.tasks,
          settings: {
            ...st.settings,
            lastMorningDate: today,
            committedDate: commitIds.length ? today : st.settings.committedDate === today ? today : null,
            committedTaskIds: commitIds.length ? commitIds : st.settings.committedDate === today ? (st.settings.committedTaskIds ?? []) : [],
          },
        }))
        get().toast({
          title: 'Morning started',
          message: commitIds.length
            ? `${commitIds.length} ${commitIds.length === 1 ? 'task' : 'tasks'} committed.`
            : 'Today is open.',
          kind: 'success',
        })
        return choices.length
      },

      parkTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task || task.archived) return
        set((st) => ({
          tasks: st.tasks.map((t) => (t.id === id ? { ...t, ...parkPatch(), updatedAt: Date.now() } : t)),
          settings: {
            ...st.settings,
            committedTaskIds: (st.settings.committedTaskIds ?? []).filter((x) => x !== id),
          },
        }))
        get().toast({ title: 'Parked', message: `${task.title} moved to Someday.`, kind: 'info' })
      },

      unparkTask: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return
        const today = todayISO()
        set((st) => ({
          tasks: st.tasks.map((t) => (t.id === id ? { ...t, ...unparkPatch(today), updatedAt: Date.now() } : t)),
        }))
        get().toast({ title: 'Pulled onto today', message: task.title, kind: 'success' })
      },

      updateTasks: (ids, patch) => {
        if (!ids.length) return
        const idSet = new Set(ids)
        set((st) => ({
          tasks: st.tasks.map((t) => (idSet.has(t.id) ? { ...t, ...patch, updatedAt: Date.now() } : t)),
        }))
      },

      logRoutineDay: (id, dateISO) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task?.recurrence) return
        const already = get().tasks.some(
          (t) => t.title === task.title && t.completed && t.dueDate === dateISO && t.id !== id && !t.recurrence
        )
        if (already) {
          get().toast({ title: 'Already logged', message: `${task.title} on ${dateISO}`, kind: 'info' })
          return
        }
        const today = todayISO()
        if (dateISO === today || dateISO === (task.dueDate ?? today)) {
          get().toggleComplete(id, true)
          return
        }
        if (dateISO > today) {
          get().toast({ title: 'That day is still ahead', kind: 'info' })
          return
        }
        const log: Task = {
          ...task,
          id: uid('task-'),
          recurrence: null,
          completed: true,
          completedAt: Date.parse(dateISO + 'T12:00:00') || Date.now(),
          dueDate: dateISO,
          archived: false,
          parked: false,
          updatedAt: Date.now(),
        }
        set((st) => ({ tasks: sortTasks([...st.tasks, log]) }))
        applyCompletionReward(get, set, log)
        get().toast({ title: 'Logged', message: `${task.title} · ${dateISO}`, kind: 'success' })
      },

      logFocusMinutes: (id, minutes, interruptions = 0) => {
        if (!minutes || minutes < 1) return
        set((st) => {
          const tasks = st.tasks.map((t) =>
            t.id === id
              ? { ...t, actualMinutes: [...(t.actualMinutes ?? []), Math.round(minutes)], updatedAt: Date.now() }
              : t
          )
          const rewarded = applyFocusSession(st.progress, id, Math.round(minutes), tasks, new Date(), uid('focus-'), interruptions)
          const prefs = st.settings.notifyPrefs
          if (rewarded.pulse.xpAwarded > 0 && prefs?.achievements !== false) {
            queueMicrotask(() => get().toast({ title: rewarded.pulse.toastTitle, message: rewarded.pulse.toastMessage, kind: 'success' }))
          }
          return { tasks, progress: rewarded.progress, lastReward: rewarded.pulse }
        })
      },

      setEnergy: (energy) => set((s) => ({ settings: { ...s.settings, energy } })),

      rescheduleMissed: () => {
        const patches = computeReschedule(get().tasks)
        if (!patches.length) return 0
        const map = new Map(patches.map((p) => [p.id, p]))
        set((st) => ({
          tasks: st.tasks.map((t) => {
            const p = map.get(t.id)
            return p ? { ...t, dueDate: p.dueDate, dueTime: p.dueTime, updatedAt: Date.now() } : t
          }),
        }))
        return patches.length
      },

      applyRecovery: (choices) => {
        const patches = recoveryPatches(get().tasks, choices)
        if (!patches.length) return 0
        const map = new Map(patches.map((p) => [p.id, p.patch]))
        set((st) => ({
          tasks: st.tasks.map((t) => {
            const patch = map.get(t.id)
            return patch ? { ...t, ...patch, updatedAt: Date.now() } : t
          }),
        }))
        return patches.length
      },

      saveWeeklyReview: (input) => {
        const record: SavedWeeklyReview = {
          ...input,
          id: uid('rev-'),
          savedAt: Date.now(),
        }
        set((st) => {
          const rest = st.reviews.filter((r) => r.weekStart !== record.weekStart)
          return { reviews: [record, ...rest].sort((a, b) => b.weekStart.localeCompare(a.weekStart)) }
        })
        get().toast({ title: 'Weekly review saved', kind: 'success' })
        return record
      },

      saveFilter: (input) => {
        const name = input.name.trim()
        if (!name) return null
        const existing = get().savedFilters.find((f) => f.name.toLowerCase() === name.toLowerCase())
        const record: SavedFilter = existing
          ? { ...existing, ...input, name, createdAt: existing.createdAt }
          : { ...input, name, id: uid('filter-'), createdAt: Date.now() }
        set((st) => ({
          savedFilters: existing
            ? st.savedFilters.map((f) => (f.id === existing.id ? record : f))
            : [record, ...st.savedFilters].slice(0, 12),
        }))
        get().toast({ title: existing ? 'Filter updated' : 'Filter saved', message: name, kind: 'success' })
        return record
      },

      removeFilter: (id) => set((st) => ({ savedFilters: st.savedFilters.filter((f) => f.id !== id) })),

      importICS: (ics) => {
        try {
          const events = parseICS(ics)
          if (!events.length) return { ok: false, added: 0, error: 'No events found in that calendar file.' }
          let added = 0
          for (const e of events) {
            const created = get().addTask({
              title: e.title,
              notes: e.notes,
              dueDate: e.dueDate,
              dueTime: e.dueTime,
              estimate: e.estimate,
            })
            if (created) added += 1
          }
          return { ok: true, added }
        } catch (err) {
          return { ok: false, added: 0, error: err instanceof Error ? err.message : 'Could not parse ICS.' }
        }
      },

      toggleImportant: (id) =>
        set((st) => ({
          tasks: st.tasks.map((t) =>
            t.id === id ? { ...t, important: !t.important, updatedAt: Date.now() } : t
          ),
        })),

      toggleArchive: (id) =>
        set((st) => ({
          tasks: st.tasks.map((t) =>
            t.id === id
              ? { ...t, archived: !t.archived, updatedAt: Date.now() }
              : t
          ),
        })),

      duplicateTask: (id) => {
        const s = get()
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return
        if (!canAddTask(s.settings, s.tasks)) {
          get().toast({
            title: 'Free includes 40 active tasks',
            message: 'Start a 7-day trial or buy a prepaid Pro license to add more.',
            kind: 'info',
          })
          queueMicrotask(() => useUIStore.getState().setPaywall(true))
          return
        }
          const copy: Task = {
          ...t,
          id: uid('task-'),
          title: `${t.title} (copy)`,
          completed: false,
          completedAt: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          sortOrder: s.tasks.length,
          subtasks: t.subtasks.map((sub) => ({ ...sub, id: uid('sub-') })),
          committedDate: null,
          snoozeUntil: null,
        }
        set((st) => ({ tasks: [...st.tasks, copy] }))
      },

      moveTask: (id, order) => {
        set((st) => {
          const task = st.tasks.find((t) => t.id === id)
          if (!task) return st
          const peers = st.tasks
            .filter((t) => t.id !== id)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
          const idx = Math.max(0, Math.min(order, peers.length))
          peers.splice(idx, 0, task)
          const orderMap = new Map(peers.map((p, i) => [p.id, i]))
          return {
            tasks: st.tasks.map((t) => (orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t)),
          }
        })
      },

      reorderIds: (ids) => {
        if (!ids.length) return
        const orderMap = new Map(ids.map((id, i) => [id, i]))
        set((st) => ({
          tasks: st.tasks.map((t) => (orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t)),
        }))
      },

      reorderTask: (id, dir) => {
        const s = get()
        const sorted = s.tasks.filter((t) => !t.archived).sort((a, b) => a.sortOrder - b.sortOrder)
        const idx = sorted.findIndex((t) => t.id === id)
        const swap = idx + dir
        if (idx < 0 || swap < 0 || swap >= sorted.length) return
        const other = sorted[swap]
        set((st) => ({
          tasks: st.tasks.map((t) => {
            if (t.id === id) return { ...t, sortOrder: other.sortOrder, updatedAt: Date.now() }
            if (t.id === other.id) return { ...t, sortOrder: sorted[idx].sortOrder, updatedAt: Date.now() }
            return t
          }),
        }))
      },

      setSubtasks: (id, subtasks) =>
        set((st) => ({
          tasks: st.tasks.map((t) =>
            t.id === id ? { ...t, subtasks, updatedAt: Date.now() } : t
          ),
        })),

      addProject: (name, color = '#8e5cf7') => {
        const trimmed = name.trim()
        if (!trimmed) {
          get().toast({ title: 'Give the project a name', kind: 'info' })
          return null
        }
        const { settings, projects } = get()
        if (!canAddProject(settings, projects)) {
          get().toast({
            title: 'Free includes 3 projects',
            message: 'Start a 7-day trial or buy a prepaid Pro license to add more.',
            kind: 'info',
          })
          queueMicrotask(() => useUIStore.getState().setPaywall(true))
          return null
        }
        const p: Project = {
          id: uid('proj-'),
          name: trimmed,
          color,
          icon: 'briefcase',
          description: '',
          sections: [],
          archived: false,
          createdAt: Date.now(),
          status: 'active',
          priority: 2,
          deadline: null,
          owner: null,
          notes: '',
        }
        set((s) => ({ projects: [...s.projects, p] }))
        return p
      },

      updateProject: (id, patch) =>
        set((st) => ({
          projects: st.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removeProject: (id) =>
        set((st) => ({
          projects: st.projects.filter((p) => p.id !== id),
          tasks: st.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null, section: null } : t)),
        })),

      toggleProjectArchive: (id) =>
        set((st) => ({
          projects: st.projects.map((p) =>
            p.id === id ? { ...p, archived: !p.archived } : p
          ),
        })),

      addSection: (projectId, section) =>
        set((st) => ({
          projects: st.projects.map((p) =>
            p.id === projectId && !p.sections.includes(section)
              ? { ...p, sections: [...p.sections, section] }
              : p
          ),
        })),

      duplicateProject: (id) => {
        const s = get()
        const src = s.projects.find((p) => p.id === id)
        if (!src) return null
        if (!canAddProject(s.settings, s.projects)) {
          get().toast({ title: 'Free includes 3 projects', kind: 'info' })
          queueMicrotask(() => useUIStore.getState().setPaywall(true))
          return null
        }
        const copy: Project = {
          ...src,
          id: uid('proj-'),
          name: `${src.name} (copy)`,
          archived: false,
          createdAt: Date.now(),
        }
        const copies: Task[] = s.tasks
          .filter((t) => t.projectId === id && !t.archived && !t.completed)
          .map((t) => ({
            ...t,
            id: uid('task-'),
            projectId: copy.id,
            completed: false,
            completedAt: null,
            committedDate: null,
            snoozeUntil: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }))
        if (!canAddTask(s.settings, [...s.tasks, ...copies])) {
          get().toast({ title: 'Not enough Free task room to duplicate', kind: 'info' })
          return null
        }
        set({ projects: [...s.projects, copy], tasks: [...s.tasks, ...copies] })
        get().toast({ title: 'Project duplicated', message: copy.name, kind: 'success' })
        return copy
      },

      applyWorkflow: (templateId) => {
        const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === templateId)
        if (!tpl) return null
        const created = get().addProject(tpl.projectName, tpl.color)
        if (!created) return null
        get().updateProject(created.id, { icon: tpl.icon, description: tpl.blurb, sections: tpl.sections })
        const ids: string[] = []
        const today = todayISO()
        for (const step of tpl.steps) {
          const dependsOn =
            typeof step.dependsOnIndex === 'number' && ids[step.dependsOnIndex] ? [ids[step.dependsOnIndex]] : []
          const t = get().addTask({
            title: step.title,
            projectId: created.id,
            priority: step.priority,
            dueDate: addDaysISO(today, step.dueOffset),
            estimate: step.estimate,
            dependsOn,
          })
          if (t) ids.push(t.id)
        }
        get().toast({ title: 'Workflow created', message: `${tpl.name} · review the draft on the project.`, kind: 'success' })
        return created
      },

      applyWhatIf: (projectId, delayDays) => {
        const preview = whatIfDelay(get().tasks, projectId, delayDays)
        if (!preview.moved.length) {
          get().toast({ title: 'Nothing to move', kind: 'info' })
          return 0
        }
        const map = new Map(preview.moved.map((m) => [m.id, m.to]))
        set((st) => ({
          tasks: st.tasks.map((t) => (map.has(t.id) ? { ...t, dueDate: map.get(t.id)!, updatedAt: Date.now() } : t)),
        }))
        get().toast({ title: 'Dates shifted', message: `${preview.moved.length} tasks moved ${delayDays} days.`, kind: 'success' })
        return preview.moved.length
      },

      addNote: (input) => {
        const n: Note = {
          id: uid('note-'),
          title: input.title.trim() || 'Untitled note',
          body: input.body ?? '',
          projectId: input.projectId ?? null,
          pinned: input.pinned ?? false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((s) => ({ notes: [n, ...s.notes] }))
        return n
      },

      updateNote: (id, patch) =>
        set((st) => ({
          notes: st.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
        })),

      removeNote: (id) => set((st) => ({ notes: st.notes.filter((n) => n.id !== id) })),

      removeSection: (projectId, section) =>
        set((st) => ({
          projects: st.projects.map((p) =>
            p.id === projectId
              ? { ...p, sections: p.sections.filter((x) => x !== section) }
              : p
          ),
          tasks: st.tasks.map((t) =>
            t.projectId === projectId && t.section === section ? { ...t, section: null } : t
          ),
        })),

      addGoal: (input) => {
        const title = input.title.trim()
        if (!title) {
          get().toast({ title: 'Give the goal a name', kind: 'info' })
          return null
        }
        if (!canAddGoal(get().settings)) {
          get().toast({
            title: 'Goals are Pro',
            message: 'Start a 7-day trial or buy a prepaid license to add goals.',
            kind: 'info',
          })
          queueMicrotask(() => useUIStore.getState().setPaywall(true))
          return null
        }
        const goal: Goal = {
          id: uid('goal-'),
          title,
          targetDate: input.targetDate ?? null,
          projectIds: input.projectIds ?? [],
          taskIds: input.taskIds ?? [],
          color: input.color ?? '#8e5cf7',
          createdAt: Date.now(),
          milestones: input.milestones ?? [],
          horizon: input.horizon ?? 'month',
          parentId: input.parentId ?? null,
          status: input.status ?? 'active',
          category: input.category ?? 'personal',
          why: input.why ?? '',
          metric: input.metric ?? '',
          progressType: input.progressType,
          targetValue: input.targetValue ?? null,
          currentValue: input.currentValue ?? null,
          unit: input.unit ?? '',
          notifications: input.notifications ?? true,
        }
        set((st) => ({ goals: [...st.goals, goal] }))
        return goal
      },
      updateGoal: (id, patch) =>
        set((st) => ({ goals: st.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      removeGoal: (id) =>
        set((st) => ({
          goals: st.goals
            .filter((g) => g.id !== id)
            .map((g) => (g.parentId === id ? { ...g, parentId: null } : g)),
        })),
      setGoalStatus: (id, status) =>
        set((st) => {
          const goals = st.goals.map((g) =>
            g.id === id
              ? {
                  ...g,
                  status,
                  completedAt: status === 'completed' ? Date.now() : null,
                  lastReviewedAt: status === 'completed' ? Date.now() : g.lastReviewedAt ?? null,
                }
              : g
          )
          const goal = goals.find((g) => g.id === id)
          const progress =
            status === 'completed' && goal ? applyGoalComplete(st.progress, goal) : st.progress
          return { goals, progress }
        }),
      setGoalValue: (id, currentValue) =>
        set((st) => ({ goals: st.goals.map((g) => (g.id === id ? { ...g, currentValue } : g)) })),
      toggleGoalMilestone: (goalId, milestoneId) =>
        set((st) => ({
          goals: st.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  milestones: (g.milestones ?? []).map((m) =>
                    m.id === milestoneId ? { ...m, done: !m.done } : m
                  ),
                }
              : g
          ),
        })),
      addTaskToGoal: (goalId, input) => {
        const task = get().addTask(input)
        if (!task) return null
        set((st) => ({
          goals: st.goals.map((g) =>
            g.id === goalId ? { ...g, taskIds: [...new Set([...(g.taskIds ?? []), task.id])] } : g
          ),
        }))
        return task
      },
      linkTaskToGoal: (goalId, taskId) =>
        set((st) => ({
          goals: st.goals.map((g) =>
            g.id === goalId ? { ...g, taskIds: [...new Set([...(g.taskIds ?? []), taskId])] } : g
          ),
        })),
      unlinkTaskFromGoal: (goalId, taskId) =>
        set((st) => ({
          goals: st.goals.map((g) =>
            g.id === goalId ? { ...g, taskIds: (g.taskIds ?? []).filter((id) => id !== taskId) } : g
          ),
        })),
      setTaskGoal: (taskId, goalId) =>
        set((st) => ({
          goals: st.goals.map((g) => {
            const has = (g.taskIds ?? []).includes(taskId)
            if (goalId && g.id === goalId) {
              return has ? g : { ...g, taskIds: [...(g.taskIds ?? []), taskId] }
            }
            if (has) return { ...g, taskIds: (g.taskIds ?? []).filter((id) => id !== taskId) }
            return g
          }),
        })),
      generateMilestoneTasks: (goalId) => {
        const goal = get().goals.find((g) => g.id === goalId)
        if (!goal) return 0
        const needing = milestonesNeedingTasks(goal, get().tasks)
        let n = 0
        for (const m of needing) {
          const draft = tasksFromMilestone(goal, m)
          const existing = get().tasks.find(
            (t) =>
              !t.archived &&
              t.title.trim().toLowerCase() === draft.title.trim().toLowerCase() &&
              (goal.taskIds ?? []).includes(t.id)
          )
          if (existing) {
            set((st) => ({
              goals: st.goals.map((g) =>
                g.id === goalId
                  ? {
                      ...g,
                      milestones: (g.milestones ?? []).map((ms) =>
                        ms.id === m.id ? { ...ms, taskId: existing.id } : ms
                      ),
                    }
                  : g
              ),
            }))
            continue
          }
          const task = get().addTask({
            title: draft.title,
            dueDate: draft.dueDate,
            important: draft.important,
          })
          if (!task) break
          set((st) => ({
            goals: st.goals.map((g) =>
              g.id === goalId
                ? {
                    ...g,
                    taskIds: [...new Set([...(g.taskIds ?? []), task.id])],
                    milestones: (g.milestones ?? []).map((ms) =>
                      ms.id === m.id ? { ...ms, taskId: task.id } : ms
                    ),
                  }
                : g
            ),
          }))
          n += 1
        }
        return n
      },

      exportJSON: () => {
        const s = get()
        const settings = {
          ...s.settings,
          ai: s.settings.ai ? { ...s.settings.ai, apiKey: '' } : null,
        }
        const payload = JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            tasks: s.tasks,
            projects: s.projects,
            notes: s.notes,
            goals: s.goals,
            reviews: s.reviews,
            savedFilters: s.savedFilters,
            settings,
            progress: s.progress,
          },
          null,
          2
        )
        downloadBlob(payload, `taskflow-export-${todayISO()}.json`, 'application/json')
      },

      exportCSV: () => {
        const s = get()
        const headers = ['id', 'title', 'notes', 'project', 'section', 'priority', 'dueDate', 'dueTime', 'completed', 'important', 'tags', 'recurrence', 'createdAt']
        const rows = s.tasks.map((t) => {
          const proj = s.projects.find((p) => p.id === t.projectId)
          const prioLabel = ['low', 'medium', 'high', 'urgent'][t.priority - 1]
          return [
            t.id,
            csvEscape(t.title),
            csvEscape(t.notes),
            csvEscape(proj?.name ?? ''),
            csvEscape(t.section ?? ''),
            prioLabel,
            t.dueDate ?? '',
            t.dueTime ?? '',
            t.completed ? 'TRUE' : 'FALSE',
            t.important ? 'TRUE' : 'FALSE',
            csvEscape(t.tags.join(', ')),
            t.recurrence ? `${t.recurrence.freq} ${t.recurrence.interval}` : '',
            new Date(t.createdAt).toISOString(),
          ].join(',')
        })
        const csv = [headers.join(','), ...rows].join('\n')
        downloadBlob(csv, `taskflow-export-${todayISO()}.csv`, 'text/csv')
      },

      importJSON: (json, mode = 'replace') => {
        try {
          const data = JSON.parse(json)
          if (!data || !Array.isArray(data.tasks)) {
            return { ok: false, error: 'Invalid file: expected TaskFlow export with a "tasks" array.' }
          }
          const incomingTasks: Task[] = data.tasks.map((t: Partial<Task>) => hydrateImportedTask(t))
          const incomingProjects: Project[] = Array.isArray(data.projects) ? data.projects : []
          const incomingNotes: Note[] = Array.isArray(data.notes) ? data.notes.map((n: Partial<Note>) => hydrateImportedNote(n)) : []
          const incomingGoals: Goal[] = Array.isArray(data.goals) ? data.goals : []
          const incomingReviews: SavedWeeklyReview[] = Array.isArray(data.reviews) ? data.reviews : []
          const incomingFilters: SavedFilter[] = Array.isArray(data.savedFilters) ? data.savedFilters : []
          const current = get()
          const incoming = data.settings ? normalizeSettings(data.settings) : current.settings
          const settings: Settings = {
            ...incoming,
            licenseKey: current.settings.licenseKey,
            licenseInterval: current.settings.licenseInterval,
            licenseExpiresAt: current.settings.licenseExpiresAt,
            licenseVerified: current.settings.licenseVerified,
            trialEndsAt: current.settings.trialEndsAt,
            trialUsed: current.settings.trialUsed,
            plan: current.settings.plan,
            checkout: current.settings.checkout,
            ai: current.settings.ai ?? incoming.ai ?? null,
          }

          if (mode === 'merge') {
            const mergedTasks = mergeById(current.tasks, incomingTasks)
            const mergedProjects = mergeById(current.projects, incomingProjects)
            const mergedNotes = mergeById(current.notes, incomingNotes)
            const mergedGoals = mergeById(current.goals, incomingGoals)
            const mergedReviews = mergeById(current.reviews, incomingReviews)
            const mergedFilters = mergeById(current.savedFilters, incomingFilters)
            const progress = data.progress
              ? mergeProgress(current.progress, normalizeProgress(data.progress))
              : current.progress
            warnFreeCap(get, settings, mergedTasks, mergedProjects)
            set({
              tasks: mergedTasks,
              projects: mergedProjects,
              notes: mergedNotes,
              goals: mergedGoals,
              reviews: mergedReviews,
              savedFilters: mergedFilters,
              settings,
              progress,
            })
            const added =
              mergedTasks.length - current.tasks.length +
              mergedProjects.length - current.projects.length +
              mergedNotes.length - current.notes.length
            return { ok: true, added: Math.max(0, added) }
          }

          const progress = data.progress
            ? normalizeProgress(data.progress)
            : backfillFromHistory(emptyProgress(), incomingTasks, settings)
          warnFreeCap(get, settings, incomingTasks, incomingProjects)
          set({
            tasks: incomingTasks,
            projects: incomingProjects,
            notes: incomingNotes,
            goals: incomingGoals,
            reviews: Array.isArray(data.reviews) ? incomingReviews : current.reviews,
            savedFilters: Array.isArray(data.savedFilters) ? incomingFilters : current.savedFilters,
            settings,
            progress,
            lastReward: null,
          })
          return { ok: true }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'Could not parse file.' }
        }
      },

      startTrial: () => {
        const s = get().settings
        if (licenseValid(s)) return { ok: true }
        if (s.trialUsed) {
          trackFunnel('trial_blocked')
          return { ok: false, error: 'Your 7-day trial has already been used.' }
        }
        set({ settings: { ...s, ...trialSettingsPatch() } })
        trackFunnel('trial_start')
        get().toast({
          title: 'Pro trial started',
          message: `${TRIAL_DAYS} days of Goals, Routines, and Plan my day.`,
          kind: 'success',
        })
        return { ok: true }
      },

      redeemLicense: async (key) => {
        const token = key.trim()
        const verified = await verifyLicenseToken(token)
        if (!verified.ok) {
          trackFunnel('license_redeem_fail')
          return { ok: false, error: verified.error }
        }
        const payload = verified.payload
        set({
          settings: {
            ...get().settings,
            plan: 'pro',
            licenseKey: token,
            licenseInterval: payload.plan,
            licenseExpiresAt: payload.exp,
            licenseVerified: true,
            trialEndsAt: null,
          },
        })
        trackFunnel('license_redeem_ok', { plan: payload.plan })
        get().toast({
          title: 'Pro unlocked',
          message: `${planLabel(payload.plan)} is active on this device.`,
          kind: 'success',
        })
        return { ok: true, interval: payload.plan }
      },

      openCheckout: (interval) => {
        const url = checkoutUrl(get().settings, interval)
        if (!url || !isSafeCheckoutUrl(url)) {
          return {
            ok: false,
            error: 'Checkout is not configured. The seller must set VITE_CHECKOUT_* to https payment links and rebuild.',
          }
        }
        window.open(url, '_blank', 'noopener,noreferrer')
        trackFunnel('checkout_open', { plan: interval })
        return { ok: true }
      },
    }),
    {
      name: 'taskflow-store',
      storage: createJSONStorage(() => safeStateStorage()),
      partialize: (s) => ({
        tasks: s.tasks,
        projects: s.projects,
        notes: s.notes,
        goals: s.goals,
        reviews: s.reviews,
        savedFilters: s.savedFilters,
        settings: s.settings,
        progress: s.progress,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TaskflowState>
        const settings = normalizeSettings(p.settings ?? current.settings)
        const tasks = Array.isArray(p.tasks) ? p.tasks : current.tasks
        const incoming = p.progress ? normalizeProgress(p.progress) : emptyProgress()
        const progress = incoming.events.length || incoming.xp > 0
          ? incoming
          : backfillFromHistory(incoming, tasks, settings)
        return {
          ...current,
          ...p,
          settings,
          tasks,
          projects: Array.isArray(p.projects) ? p.projects : current.projects,
          notes: Array.isArray(p.notes) ? p.notes : current.notes,
          goals: Array.isArray(p.goals) ? p.goals : current.goals,
          reviews: Array.isArray(p.reviews) ? p.reviews : current.reviews,
          savedFilters: Array.isArray(p.savedFilters) ? p.savedFilters : current.savedFilters,
          progress,
        }
      },
      onRehydrateStorage: () => (state, error) => {
        queueMicrotask(() => {
          if (error) {
            console.error('Failed to rehydrate store', error)
            useStore.setState({ hydrated: true, status: 'ready' })
            return
          }
          const cur = useStore.getState()
          let settings = normalizeSettings(cur.settings)
          settings = { ...settings, licenseVerified: false }
          const expired = expiredTrialPatch(settings)
          if (expired) settings = { ...settings, ...expired }
          const unlocked = devUnlockPatch(settings)
          if (unlocked) settings = { ...settings, ...unlocked }
          let progress = normalizeProgress(cur.progress)
          if (progress.events.length === 0 && progress.xp === 0) {
            progress = backfillFromHistory(progress, cur.tasks, settings)
          }
          useStore.setState({ settings, progress, hydrated: true, status: 'ready' })
          if (settings.licenseKey) {
            void verifyLicenseToken(settings.licenseKey).then((res) => {
              const now = useStore.getState().settings
              if (!res.ok) {
                useStore.setState({
                  settings: {
                    ...now,
                    plan: now.trialEndsAt && Date.now() < now.trialEndsAt ? 'pro' : 'free',
                    licenseKey: '',
                    licenseInterval: null,
                    licenseExpiresAt: null,
                    licenseVerified: false,
                  },
                })
                return
              }
              useStore.setState({
                settings: {
                  ...now,
                  plan: 'pro',
                  licenseKey: settings.licenseKey,
                  licenseInterval: res.payload.plan,
                  licenseExpiresAt: res.payload.exp,
                  licenseVerified: true,
                },
              })
            })
          }
        })
      },
    }
  )
)

function normalizePriority(p: unknown): Task['priority'] {
  const n = Number(p)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n as Task['priority']
  return 2
}

function hydrateImportedTask(t: Partial<Task>): Task {
  return {
    ...t,
    id: t.id || uid('task-'),
    title: String(t.title ?? 'Untitled'),
    notes: t.notes ?? '',
    projectId: t.projectId ?? null,
    section: t.section ?? null,
    priority: normalizePriority(t.priority),
    dueDate: t.dueDate ?? null,
    dueTime: t.dueTime ?? null,
    estimate: t.estimate ?? null,
    dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
    energy: t.energy ?? null,
    actualMinutes: Array.isArray(t.actualMinutes) ? t.actualMinutes : [],
    postponeCount: Number.isFinite(t.postponeCount) ? Number(t.postponeCount) : 0,
    waitingOn: typeof t.waitingOn === 'string' && t.waitingOn.trim() ? t.waitingOn.trim() : null,
    committedDate: typeof t.committedDate === 'string' ? t.committedDate : null,
    snoozeUntil: typeof t.snoozeUntil === 'string' ? t.snoozeUntil : null,
    parked: Boolean(t.parked),
    completed: Boolean(t.completed),
    completedAt: t.completedAt ?? null,
    important: Boolean(t.important),
    archived: Boolean(t.archived),
    recurrence: t.recurrence ?? null,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
    tags: Array.isArray(t.tags) ? t.tags : [],
    createdAt: t.createdAt ?? Date.now(),
    updatedAt: t.updatedAt ?? Date.now(),
    sortOrder: Number.isFinite(t.sortOrder) ? (t.sortOrder as number) : 0,
  }
}

function hydrateImportedNote(n: Partial<Note>): Note {
  return {
    id: n.id || uid('note-'),
    title: String(n.title ?? 'Untitled note'),
    body: String(n.body ?? ''),
    projectId: n.projectId ?? null,
    pinned: Boolean(n.pinned),
    createdAt: n.createdAt ?? Date.now(),
    updatedAt: n.updatedAt ?? Date.now(),
  }
}

function mergeById<T extends { id: string; updatedAt?: number }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of current) map.set(row.id, row)
  for (const row of incoming) {
    const existing = map.get(row.id)
    if (!existing) {
      map.set(row.id, row)
      continue
    }
    const incomingUpdated = typeof row.updatedAt === 'number' ? row.updatedAt : 0
    const existingUpdated = typeof existing.updatedAt === 'number' ? existing.updatedAt : 0
    map.set(row.id, incomingUpdated >= existingUpdated ? row : existing)
  }
  return [...map.values()]
}

function mergeProgress(current: ProgressState, incoming: ProgressState): ProgressState {
  const eventIds = new Set(current.events.map((e) => e.id))
  const events = [...current.events]
  for (const e of incoming.events) {
    if (!eventIds.has(e.id)) events.push(e)
  }
  const sessionIds = new Set(current.sessions.map((s) => s.id))
  const sessions = [...current.sessions]
  for (const s of incoming.sessions) {
    if (!sessionIds.has(s.id)) sessions.push(s)
  }
  const achIds = new Set(current.achievements.map((a) => a.id))
  const achievements = [...current.achievements]
  for (const a of incoming.achievements) {
    if (!achIds.has(a.id)) achievements.push(a)
  }
  return {
    ...current,
    xp: Math.max(current.xp, incoming.xp),
    events,
    sessions,
    achievements,
  }
}

function warnFreeCap(
  get: () => TaskflowState,
  settings: Settings,
  tasks: Task[],
  projects: Project[]
) {
  if (licenseValid(settings) || settings.trialEndsAt) return
  const overTasks = tasks.filter((t) => !t.archived && !t.completed).length > 40
  const overProjects = projects.filter((p) => !p.archived).length > 3
  if (overTasks || overProjects) {
    get().toast({
      title: 'Imported over Free limits',
      message: 'Existing items were kept. Start a trial or buy Pro to add more.',
      kind: 'info',
    })
  }
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export const SAMPLE_TAGS_FOR_INPUT = SAMPLE_TAGS
