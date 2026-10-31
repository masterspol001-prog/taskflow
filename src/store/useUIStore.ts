import { create } from 'zustand'
import type { ViewId } from '@/lib/types'
import { VIEW_IDS } from '@/lib/constants'
import { trackFunnel } from '@/lib/funnel'
import { FEATURES_UNLOCKED } from '@/lib/pro'

const VIEW_SET = new Set<string>(VIEW_IDS)

export function parseHash(hash = typeof window === 'undefined' ? '' : window.location.hash): RouteState {
  const raw = (hash.startsWith('#') ? hash.slice(1) : hash).replace(/^\/+/, '')
  if (!raw) return { view: 'today' }
  const [path, query] = raw.split('?')
  const view = (path === 'insights' ? 'dashboard' : path) as ViewId
  if (!VIEW_SET.has(view)) return { view: 'today' }
  const params = new URLSearchParams(query ?? '')
  const projectId = params.get('project')
  const section = params.get('section')
  return {
    view,
    projectId: projectId || undefined,
    section: section || undefined,
  }
}

export function writeHash(route: RouteState) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (route.projectId) params.set('project', route.projectId)
  if (route.section) params.set('section', route.section)
  const q = params.toString()
  const next = `#/${route.view}${q ? `?${q}` : ''}`
  if (window.location.hash !== next) window.history.replaceState(null, '', next)
}

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
  aiTab: 'today' | 'capture' | 'review'
  goalCreateOpen: boolean
  shutdownOpen: boolean
  morningOpen: boolean

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
  setAi: (open: boolean, tab?: 'today' | 'capture' | 'review') => void
  setPaywall: (open: boolean) => void
  setGoalCreate: (open: boolean) => void
  setShutdown: (open: boolean) => void
  setMorning: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  route: parseHash(),
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
  aiTab: 'today',
  goalCreateOpen: false,
  shutdownOpen: false,
  morningOpen: false,

  navigate: (view, opts) => {
    const route: RouteState = {
      view,
      projectId: opts?.projectId !== undefined ? opts.projectId : undefined,
      section: opts?.section !== undefined ? opts.section : undefined,
    }
    writeHash(route)
    set({ route })
  },

  openTask: (taskId) =>
    set({
      taskModal: { open: true, mode: 'edit', taskId },
      quickAddOpen: false,
      searchOpen: false,
      shortcutsOpen: false,
      focusOpen: false,
      aiOpen: false,
    }),
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
      quickAddOpen: false,
      searchOpen: false,
      shortcutsOpen: false,
      focusOpen: false,
      aiOpen: false,
    }),
  closeTaskModal: () => set((s) => ({ taskModal: { ...s.taskModal, open: false } })),

  openNewProject: () => set({ projectModal: { open: true } }),
  openProjectSettings: (projectId) => set({ projectModal: { open: true, projectId } }),
  closeProjectModal: () => set((s) => ({ projectModal: { ...s.projectModal, open: false } })),

  setQuickAdd: (open) =>
    set(
      open
        ? { quickAddOpen: true, searchOpen: false, shortcutsOpen: false, focusOpen: false, aiOpen: false, taskModal: { open: false, mode: 'create' } }
        : { quickAddOpen: false }
    ),
  setShortcuts: (open) => set({ shortcutsOpen: open }),
  setOnboarding: (open) => set({ onboardingOpen: open }),
  setFocus: (open, seedTaskId) =>
    set(
      open
        ? { focusOpen: true, focusSeedTaskId: seedTaskId ?? null, quickAddOpen: false, searchOpen: false, shortcutsOpen: false, aiOpen: false }
        : { focusOpen: false, focusSeedTaskId: null }
    ),
  setSearch: (open) =>
    set(
      open
        ? { searchOpen: true, quickAddOpen: false, shortcutsOpen: false, focusOpen: false, aiOpen: false }
        : { searchOpen: false }
    ),
  setFilters: (open) => set({ filtersOpen: open }),
  setAi: (open, tab) =>
    set(
      open
        ? { aiOpen: true, aiTab: tab ?? 'today', quickAddOpen: false, searchOpen: false, shortcutsOpen: false, focusOpen: false }
        : { aiOpen: false }
    ),
  setPaywall: (open) => {
    if (FEATURES_UNLOCKED) {
      set({ paywallOpen: false })
      return
    }
    if (open) trackFunnel('paywall_open')
    set({ paywallOpen: open })
  },
  setGoalCreate: (open) => set({ goalCreateOpen: open }),
  setShutdown: (open) => set({ shutdownOpen: open, morningOpen: open ? false : undefined, ...(open ? { quickAddOpen: false, searchOpen: false, shortcutsOpen: false, aiOpen: false } : {}) }),
  setMorning: (open) => set({ morningOpen: open, shutdownOpen: open ? false : undefined, ...(open ? { quickAddOpen: false, searchOpen: false, shortcutsOpen: false, aiOpen: false } : {}) }),
}))
