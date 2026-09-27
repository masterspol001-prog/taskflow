import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { BillingInterval, Goal, PersonaId, Project, Recurrence, Settings, Task } from '@/lib/types'
import { TRIAL_DAYS, canAddProject, canAddTask, checkoutUrl, expiredTrialPatch, shouldAutoStartTrial, trialSettingsPatch } from '@/lib/pro'
import { validateLicenseKey } from '@/lib/license'
import { uid } from '@/lib/dates'
import { todayISO, nextRecurrenceISO } from '@/lib/dates'
import { buildSampleData, defaultSettings, normalizeSettings } from '@/lib/sampleData'
import type { ParsedQuickAdd } from '@/lib/nlparser'

export interface ToastMsg {
  id: string
  title: string
  message?: string
  kind: 'success' | 'error' | 'info'
}

export interface QuickAddDraft extends ParsedQuickAdd {
  open: boolean
}

interface TaskflowState {
  tasks: Task[]
  projects: Project[]
  goals: Goal[]
  settings: Settings
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
  setSubtasks: (id: string, subtasks: Task['subtasks']) => void

  // ---- projects ----
  addProject: (name: string, color?: string) => Project | null
  updateProject: (id: string, patch: Partial<Project>) => void
  removeProject: (id: string) => void
  toggleProjectArchive: (id: string) => void
  addSection: (projectId: string, section: string) => void
  removeSection: (projectId: string, section: string) => void

  // ---- goals ----
  addGoal: (input: { title: string; targetDate?: string | null; projectIds?: string[]; color?: string }) => Goal | null
  updateGoal: (id: string, patch: Partial<Goal>) => void
  removeGoal: (id: string) => void
  skipOccurrence: (id: string) => void

  // ---- import/export ----
  exportJSON: () => void
  exportCSV: () => void
  importJSON: (json: string) => { ok: boolean; error?: string }

  startTrial: () => { ok: boolean; error?: string }
  redeemLicense: (key: string) => { ok: boolean; error?: string; interval?: BillingInterval }
  openCheckout: (interval: BillingInterval) => { ok: boolean; error?: string }
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt)
}

const SAMPLE_TAGS = ['ideas', 'blocked', 'quick', 'waiting', 'follow-up', 'deep-work', 'errand']

export const useStore = create<TaskflowState>()(
  persist(
    (set, get) => ({
      tasks: [],
      projects: [],
      goals: [],
      settings: defaultSettings(),
      toasts: [],
      status: 'idle',
      hydrated: false,

      seed: (persona?: PersonaId | null) => {
        const sample = buildSampleData(
          new Date(),
          persona !== undefined ? persona : get().settings.persona
        )
        const s = get()
        set({
          tasks: [...s.tasks, ...sample.tasks],
          projects: [...s.projects, ...sample.projects],
          status: 'ready',
        })
      },

      clearAll: () => {
        set({ tasks: [], projects: [], goals: [] })
      },

      toast: (t) => {
        const msg = { ...t, id: uid('toast-') }
        set((s) => ({ toasts: [...s.toasts, msg] }))
        window.setTimeout(() => get().dismissToast(msg.id), 4200)
      },

      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      completeOnboarding: () =>
        set((s) => {
          let settings = { ...s.settings, onboarded: true }
          if (shouldAutoStartTrial(settings)) {
            settings = { ...settings, ...trialSettingsPatch() }
          }
          // Fresh workspace → seed a tailored starter set for the chosen persona.
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
            title: 'Free plan limit',
            message: 'Free includes 40 active tasks. Start a trial or buy Pro to add more.',
            kind: 'info',
          })
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
          tasks = tasks.map((t) =>
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
          )
          set({ tasks: sortTasks(tasks) })
          get().toast({ title: 'Logged', message: `Next: ${nextDue}`, kind: 'success' })
          return
        }

        tasks = tasks.map((t) =>
          t.id === id
            ? { ...t, completed: next, completedAt: next ? Date.now() : null, updatedAt: Date.now() }
            : t
        )
        set({ tasks: sortTasks(tasks) })
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
            title: 'Free plan limit',
            message: 'Free includes 3 projects. Start a trial or buy Pro to add more.',
            kind: 'info',
          })
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
          color: input.color ?? '#8e5cf7',
          createdAt: Date.now(),
        }
        set((st) => ({ goals: [...st.goals, goal] }))
        return goal
      },
      updateGoal: (id, patch) =>
        set((st) => ({ goals: st.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      removeGoal: (id) => set((st) => ({ goals: st.goals.filter((g) => g.id !== id) })),

      exportJSON: () => {
        const s = get()
        const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks: s.tasks, projects: s.projects, goals: s.goals, settings: s.settings }, null, 2)
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
          set({
            tasks,
            projects,
            goals: Array.isArray(data.goals) ? data.goals : [],
            settings: data.settings ? normalizeSettings(data.settings) : get().settings,
          })
          return { ok: true }
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'Could not parse file.' }
        }
      },

      startTrial: () => {
        const s = get().settings
        if (validateLicenseKey(s.licenseKey).ok) return { ok: true }
        if (s.trialUsed) return { ok: false, error: 'Your 7-day trial has already been used.' }
        set({ settings: { ...s, ...trialSettingsPatch() } })
        get().toast({ title: 'Pro trial started', message: `${TRIAL_DAYS} days of Goals, Routines, analytics and AI.`, kind: 'success' })
        return { ok: true }
      },

      redeemLicense: (key) => {
        const parsed = validateLicenseKey(key)
        if (!parsed.ok) return { ok: false, error: 'That license key is not valid.' }
        const s = get().settings
        set({
          settings: {
            ...s,
            plan: 'pro',
            licenseKey: key.trim().toUpperCase(),
            licenseInterval: parsed.interval,
            trialEndsAt: null,
          },
        })
        get().toast({ title: 'Pro unlocked', message: 'Thanks for supporting TaskFlow.', kind: 'success' })
        return { ok: true, interval: parsed.interval }
      },

      openCheckout: (interval) => {
        const url = checkoutUrl(get().settings, interval)
        if (!url) {
          return { ok: false, error: 'Add your Lemon Squeezy or Stripe payment link in Settings to start selling.' }
        }
        window.open(url, '_blank', 'noopener,noreferrer')
        return { ok: true }
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
        hydrated: s.hydrated,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<TaskflowState>
        return {
          ...current,
          ...p,
          settings: normalizeSettings(p.settings ?? current.settings),
          tasks: Array.isArray(p.tasks) ? p.tasks : current.tasks,
          projects: Array.isArray(p.projects) ? p.projects : current.projects,
          goals: Array.isArray(p.goals) ? p.goals : current.goals,
        }
      },
      onRehydrateStorage: () => (state, error) => {
        queueMicrotask(() => {
          if (error) {
            console.error('Failed to rehydrate store', error)
            useStore.setState({ hydrated: true, status: 'ready' })
            return
          }
          let settings = normalizeSettings(useStore.getState().settings)
          const expired = expiredTrialPatch(settings)
          if (expired) settings = { ...settings, ...expired }
          if (shouldAutoStartTrial(settings)) {
            settings = { ...settings, ...trialSettingsPatch() }
          }
          useStore.setState({ settings, hydrated: true, status: 'ready' })
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
