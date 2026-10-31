import type { EnergyLevel, ViewId } from '@/lib/types'

export type PaletteAction =
  | { type: 'navigate'; view: ViewId }
  | { type: 'plan' }
  | { type: 'focus' }
  | { type: 'goal' }
  | { type: 'quickAdd' }
  | { type: 'shutdown' }
  | { type: 'morning' }
  | { type: 'energy'; energy: EnergyLevel }
  | { type: 'shortcuts' }

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  keywords: string[]
  slash?: string
  action: PaletteAction
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  { id: 'capture', label: 'Capture a task', hint: 'Quick add', keywords: ['add', 'capture', 'new', 'quick'], slash: '/add', action: { type: 'quickAdd' } },
  { id: 'plan', label: 'Plan my day', keywords: ['plan', 'schedule'], slash: '/plan', action: { type: 'plan' } },
  { id: 'focus', label: 'Start focus', keywords: ['focus', 'pomodoro', 'timer'], slash: '/focus', action: { type: 'focus' } },
  { id: 'review', label: 'Weekly review', keywords: ['review', 'week'], slash: '/review', action: { type: 'navigate', view: 'review' } },
  { id: 'goal', label: 'Create a goal', keywords: ['goal'], slash: '/goal', action: { type: 'goal' } },
  { id: 'shutdown', label: 'Shut down the day', keywords: ['shutdown', 'close', 'park'], slash: '/shutdown', action: { type: 'shutdown' } },
  { id: 'morning', label: 'Start the morning', keywords: ['morning', 'start', 'commit'], slash: '/morning', action: { type: 'morning' } },
  { id: 'today', label: 'Go to Today', keywords: ['today'], slash: '/today', action: { type: 'navigate', view: 'today' } },
  { id: 'inbox', label: 'Go to Inbox', keywords: ['inbox'], slash: '/inbox', action: { type: 'navigate', view: 'inbox' } },
  { id: 'insights', label: 'Go to Insights', keywords: ['insights', 'dashboard'], slash: '/insights', action: { type: 'navigate', view: 'dashboard' } },
  { id: 'analytics', label: 'Go to Analytics', keywords: ['analytics', 'charts', 'stats', 'heatmap'], slash: '/analytics', action: { type: 'navigate', view: 'analytics' } },
  { id: 'plan-view', label: 'Go to Plan', keywords: ['plan'], slash: '/plan', action: { type: 'navigate', view: 'plan' } },
  { id: 'projects', label: 'Go to Projects', keywords: ['projects'], slash: '/projects', action: { type: 'navigate', view: 'projects' } },
  { id: 'notes', label: 'Go to Notes', keywords: ['notes'], slash: '/notes', action: { type: 'navigate', view: 'notes' } },
  { id: 'risk', label: 'Go to Risk radar', keywords: ['risk'], slash: '/risk', action: { type: 'navigate', view: 'risk' } },
  { id: 'templates', label: 'Go to Templates', keywords: ['templates', 'workflow'], slash: '/templates', action: { type: 'navigate', view: 'templates' } },
  { id: 'goals', label: 'Go to Goals', keywords: ['goals'], slash: '/goals', action: { type: 'navigate', view: 'goals' } },
  { id: 'calendar', label: 'Go to Calendar', keywords: ['calendar'], slash: '/calendar', action: { type: 'navigate', view: 'calendar' } },
  { id: 'board', label: 'Go to Board', keywords: ['board', 'kanban'], slash: '/board', action: { type: 'navigate', view: 'board' } },
  { id: 'routines', label: 'Go to Routines', keywords: ['routines', 'habits'], slash: '/routines', action: { type: 'navigate', view: 'routines' } },
  { id: 'rewards', label: 'Go to Rewards', keywords: ['rewards', 'streaks'], slash: '/rewards', action: { type: 'navigate', view: 'rewards' } },
  { id: 'upcoming', label: 'Go to Upcoming', keywords: ['upcoming', 'agenda'], slash: '/upcoming', action: { type: 'navigate', view: 'upcoming' } },
  { id: 'timeline', label: 'Go to Timeline', keywords: ['timeline'], slash: '/timeline', action: { type: 'navigate', view: 'timeline' } },
  { id: 'someday', label: 'Go to Someday', keywords: ['someday', 'parked', 'later'], slash: '/someday', action: { type: 'navigate', view: 'someday' } },
  { id: 'settings', label: 'Go to Settings', keywords: ['settings'], slash: '/settings', action: { type: 'navigate', view: 'settings' } },
  { id: 'energy-low', label: 'Set energy: low', keywords: ['energy', 'low'], slash: '/energy low', action: { type: 'energy', energy: 'low' } },
  { id: 'energy-medium', label: 'Set energy: medium', keywords: ['energy', 'medium'], slash: '/energy medium', action: { type: 'energy', energy: 'medium' } },
  { id: 'energy-high', label: 'Set energy: high', keywords: ['energy', 'high'], slash: '/energy high', action: { type: 'energy', energy: 'high' } },
  { id: 'shortcuts', label: 'Keyboard shortcuts', keywords: ['shortcuts', 'keys', 'help'], slash: '/shortcuts', action: { type: 'shortcuts' } },
]

export function matchPaletteCommands(q: string, limit = 8): PaletteCommand[] {
  const s = q.trim().toLowerCase().replace(/^\//, '')
  if (!s) return PALETTE_COMMANDS.slice(0, limit)
  const ranked = PALETTE_COMMANDS.map((c) => {
    const hay = `${c.label} ${c.keywords.join(' ')} ${c.slash ?? ''}`.toLowerCase()
    let score = 0
    if (c.slash?.slice(1).toLowerCase() === s || c.id === s) score = 3
    else if (c.keywords.some((k) => k === s) || c.label.toLowerCase() === s) score = 2
    else if (hay.includes(s)) score = 1
    return { c, score }
  }).filter((x) => x.score > 0)
  ranked.sort((a, b) => b.score - a.score)
  return ranked.slice(0, limit).map((x) => x.c)
}

const RECENT_KEY = 'tf-recent-search'
const RECENT_MAX = 8

export function loadRecentSearches(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

export function pushRecentSearch(q: string): string[] {
  const t = q.trim()
  if (t.length < 2) return loadRecentSearches()
  const next = [t, ...loadRecentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX)
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
  return next
}
