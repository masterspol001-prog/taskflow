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
  PersonaId,
  ProgressState,
  Project,
  Recurrence,
  Settings,
  Task,
} from '@/lib/types'
import { TRIAL_DAYS, canAddProject, canAddTask, checkoutUrl, expiredTrialPatch, licenseExpiresAt, matchPlanByAmount, parsePaidAmountInr, PLAN_RANK, planLabel, trialSettingsPatch } from '@/lib/pro'
import { generateLicense, validateLicenseKey } from '@/lib/license'
import { uid } from '@/lib/dates'
import { todayISO, nextRecurrenceISO } from '@/lib/dates'
import { postponeDate, rescheduleMissed as computeReschedule } from '@/lib/agent'
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
  goals: Goal[]
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
  generateMilestoneTasks: (goalId: string) => number
  skipOccurrence: (id: string) => void
  postponeTask: (id: string) => void
  logFocusMinutes: (id: string, minutes: number) => void
  setEnergy: (energy: EnergyLevel) => void
  rescheduleMissed: () => number
  importICS: (ics: string) => { ok: boolean; added: number; error?: string }
  clearReward: () => void

  // ---- import/export ----
  exportJSON: () => void
  exportCSV: () => void
  importJSON: (json: string) => { ok: boolean; error?: string }

  startTrial: () => { ok: boolean; error?: string }
  redeemLicense: (key: string) => { ok: boolean; error?: string; interval?: BillingInterval }
  openCheckout: (interval: BillingInterval) => { ok: boolean; error?: string }
  confirmPayment: (amountRaw: string) => { ok: boolean; error?: string; interval?: BillingInterval }
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
      goals: [],
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
        set({ tasks: [], projects: [], goals: [], progress: emptyProgress(), lastReward: null })
      },

      clearReward: () => set({ lastReward: null }),

      toast: (t) => {
        const msg = { ...t, id: uid('toast-') }
        set((s) => ({ toasts: [...s.toasts.slice(-2), msg] }))
        window.setTimeout(() => get().dismissToast(msg.id), t.onAction ? 7000 : 4200)
      },

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

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
            message: 'Start a 7-day trial or subscribe to Pro to add more.',
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

      removeTask: (id) => set((st) => ({ tasks: st.tasks.filter((t) => t.id !== id) })),

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

      logFocusMinutes: (id, minutes) => {
        if (!minutes || minutes < 1) return
        set((st) => {
          const tasks = st.tasks.map((t) =>
            t.id === id
              ? { ...t, actualMinutes: [...(t.actualMinutes ?? []), Math.round(minutes)], updatedAt: Date.now() }
              : t
          )
          const rewarded = applyFocusSession(st.progress, id, Math.round(minutes), tasks)
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
            message: 'Start a 7-day trial or subscribe to Pro to add more.',
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
        const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks: s.tasks, projects: s.projects, goals: s.goals, settings: s.settings, progress: s.progress }, null, 2)
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

      importJSON: (json) => {
        try {
          const data = JSON.parse(json)
          if (!data || !Array.isArray(data.tasks)) {
            return { ok: false, error: 'Invalid file: expected TaskFlow export with a "tasks" array.' }
          }
          const projects: Project[] = Array.isArray(data.projects) ? data.projects : []
          const tasks: Task[] = data.tasks.map((t: Partial<Task>) => ({
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
          }))
          const settings = data.settings ? normalizeSettings(data.settings) : get().settings
          const progress = data.progress
            ? normalizeProgress(data.progress)
            : backfillFromHistory(emptyProgress(), tasks, settings)
          set({
            tasks,
            projects,
            goals: Array.isArray(data.goals) ? data.goals : [],
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
        if (validateLicenseKey(s.licenseKey).ok && (!s.licenseExpiresAt || s.licenseExpiresAt > Date.now())) {
          return { ok: true }
        }
        if (s.trialUsed) return { ok: false, error: 'Your 7-day trial has already been used.' }
        set({ settings: { ...s, ...trialSettingsPatch() } })
        get().toast({
          title: 'Pro trial started',
          message: `${TRIAL_DAYS} days of Goals, Routines, and Plan my day.`,
          kind: 'success',
        })
        return { ok: true }
      },

      redeemLicense: (key) => {
        const parsed = validateLicenseKey(key)
        if (!parsed.ok) return { ok: false, error: 'That license key is not valid.' }
        const s = get().settings
        const expiresAt =
          parsed.interval === 'lifetime'
            ? null
            : s.licenseExpiresAt && s.licenseExpiresAt > Date.now() && s.licenseInterval === parsed.interval
              ? s.licenseExpiresAt
              : licenseExpiresAt(parsed.interval)
        set({
          settings: {
            ...s,
            plan: 'pro',
            licenseKey: key.trim().toUpperCase(),
            licenseInterval: parsed.interval,
            licenseExpiresAt: expiresAt,
            trialEndsAt: null,
          },
        })
        get().toast({ title: 'Pro unlocked', message: `${planLabel(parsed.interval)} is active on this device.`, kind: 'success' })
        return { ok: true, interval: parsed.interval }
      },

      openCheckout: (interval) => {
        const url = checkoutUrl(get().settings, interval)
        if (!url) {
          return { ok: false, error: 'Checkout is not configured yet.' }
        }
        window.open(url, '_blank', 'noopener,noreferrer')
        return { ok: true }
      },

      confirmPayment: (amountRaw) => {
        const amount = parsePaidAmountInr(amountRaw)
        if (amount == null) return { ok: false, error: 'Enter the amount you paid on Razorpay.' }
        const interval = matchPlanByAmount(amount)
        if (!interval) {
          return {
            ok: false,
            error: 'That amount does not match Monthly ($10), Annual ($72), or Lifetime ($149).',
          }
        }
        const s = get().settings
        const now = Date.now()
        const currentOk = validateLicenseKey(s.licenseKey).ok && (!s.licenseExpiresAt || s.licenseExpiresAt > now)
        const currentRank = PLAN_RANK[s.licenseInterval ?? 'monthly'] ?? 0
        if (currentOk && PLAN_RANK[interval] < currentRank) {
          return { ok: true, interval: s.licenseInterval ?? interval }
        }
        const renewingSame = currentOk && s.licenseInterval === interval && interval !== 'lifetime'
        const base = renewingSame && s.licenseExpiresAt && s.licenseExpiresAt > now ? s.licenseExpiresAt : now
        const key = currentOk && s.licenseKey && s.licenseInterval === interval ? s.licenseKey : generateLicense(interval)
        set({
          settings: {
            ...s,
            plan: 'pro',
            licenseKey: key,
            licenseInterval: interval,
            licenseExpiresAt: licenseExpiresAt(interval, base),
            trialEndsAt: null,
          },
        })
        get().toast({
          title: interval === 'lifetime' ? 'Lifetime unlocked' : renewingSame ? `${planLabel(interval)} renewed` : 'Pro unlocked',
          message:
            interval === 'lifetime'
              ? 'Lifetime Pro is active on this device.'
              : `${planLabel(interval)} is active until ${new Date(licenseExpiresAt(interval, base)!).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}.`,
          kind: 'success',
        })
        return { ok: true, interval }
      },
    }),
    {
      name: 'taskflow-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        tasks: s.tasks,
        projects: s.projects,
        goals: s.goals,
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
          goals: Array.isArray(p.goals) ? p.goals : current.goals,
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
          const expired = expiredTrialPatch(settings)
          if (expired) settings = { ...settings, ...expired }
          let progress = normalizeProgress(cur.progress)
          if (progress.events.length === 0 && progress.xp === 0) {
            progress = backfillFromHistory(progress, cur.tasks, settings)
          }
          useStore.setState({ settings, progress, hydrated: true, status: 'ready' })
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
