import { create } from 'zustand'
import type { ViewId } from '@/lib/types'

export interface RouteState {
  view: ViewId
  projectId?: string | null
  section?: string | null
}

export interface TaskModalState {
  open: boolean
  mode: 'create' | 'edit'
  taskId?: string
  projectId?: string | null
  section?: string | null
  title?: string
  dueDate?: string | null
  dueTime?: string | null
}

export interface ProjectModalState {
  open: boolean
  projectId?: string
}

interface UIState {
  route: RouteState
  taskModal: TaskModalState
  projectModal: ProjectModalState
  quickAddOpen: boolean
  shortcutsOpen: boolean
  onboardingOpen: boolean
  focusOpen: boolean
  /** Task preselected when Focus mode opens (started from a task row). */
  focusSeedTaskId: string | null
  searchOpen: boolean
  filtersOpen: boolean
  aiOpen: boolean
  paywallOpen: boolean

  navigate: (view: ViewId, opts?: { projectId?: string | null; section?: string | null }) => void
  openTask: (taskId: string) => void
  openNewTask: (opts?: { projectId?: string | null; section?: string | null; title?: string; dueDate?: string | null; dueTime?: string | null }) => void
  closeTaskModal: () => void
  openNewProject: () => void
  openProjectSettings: (projectId: string) => void
  closeProjectModal: () => void
  setQuickAdd: (open: boolean) => void
  setShortcuts: (open: boolean) => void
  setOnboarding: (open: boolean) => void
  setFocus: (open: boolean, seedTaskId?: string | null) => void
  setSearch: (open: boolean) => void
  setFilters: (open: boolean) => void
  setAi: (open: boolean) => void
  setPaywall: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  route: { view: 'today' },
  taskModal: { open: false, mode: 'create' },
  projectModal: { open: false },
  quickAddOpen: false,
  shortcutsOpen: false,
  onboardingOpen: false,
  focusOpen: false,
  focusSeedTaskId: null,
  searchOpen: false,
  filtersOpen: false,
  aiOpen: false,
  paywallOpen: false,

  navigate: (view, opts) =>
    set({
      route: {
        view,
        projectId: opts?.projectId !== undefined ? opts.projectId : undefined,
        section: opts?.section !== undefined ? opts.section : undefined,
      },
    }),

  openTask: (taskId) => set({ taskModal: { open: true, mode: 'edit', taskId } }),
  openNewTask: (opts) =>
    set({
      taskModal: {
        open: true,
        mode: 'create',
        projectId: opts?.projectId,
        section: opts?.section,
        title: opts?.title,
        dueDate: opts?.dueDate !== undefined ? opts.dueDate : null,
        dueTime: opts?.dueTime !== undefined ? opts.dueTime : null,
      },
    }),
  closeTaskModal: () => set((s) => ({ taskModal: { ...s.taskModal, open: false } })),

  openNewProject: () => set({ projectModal: { open: true } }),
  openProjectSettings: (projectId) => set({ projectModal: { open: true, projectId } }),
  closeProjectModal: () => set((s) => ({ projectModal: { ...s.projectModal, open: false } })),

  setQuickAdd: (open) => set({ quickAddOpen: open }),
  setShortcuts: (open) => set({ shortcutsOpen: open }),
  setOnboarding: (open) => set({ onboardingOpen: open }),
  setFocus: (open, seedTaskId) =>
    set({ focusOpen: open, focusSeedTaskId: open ? seedTaskId ?? null : null }),
  setSearch: (open) => set({ searchOpen: open }),
  setFilters: (open) => set({ filtersOpen: open }),
  setAi: (open) => set({ aiOpen: open }),
  setPaywall: (open) => set({ paywallOpen: open }),
}))
