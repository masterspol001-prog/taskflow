import type { FocusMode } from './types'

export const POMODORO_WORK = 25 * 60
export const POMODORO_BREAK = 5 * 60
export const FOCUS_SESSION_KEY = 'taskflow-focus-session'
const MAX_AGE_MS = 12 * 60 * 60 * 1000

export type FocusPhase = 'focus' | 'break'

export interface FocusTimerSnapshot {
  mode: FocusMode
  phase: FocusPhase
  running: boolean
  finished: boolean
  countdownMin: number
  selected: string
  endsAt: number | null
  remaining: number
  stopwatchStartedAt: number | null
  stopwatchElapsedMs: number
  logged?: boolean
}

export function defaultSnapshot(selected = ''): FocusTimerSnapshot {
  return {
    mode: 'pomodoro',
    phase: 'focus',
    running: false,
    finished: false,
    countdownMin: 15,
    selected,
    endsAt: null,
    remaining: POMODORO_WORK,
    stopwatchStartedAt: null,
    stopwatchElapsedMs: 0,
    logged: false,
  }
}

export function totalSeconds(s: FocusTimerSnapshot): number {
  if (s.mode === 'pomodoro') return s.phase === 'focus' ? POMODORO_WORK : POMODORO_BREAK
  if (s.mode === 'countdown') return Math.max(1, s.countdownMin) * 60
  return 0
}

export function displayedSeconds(s: FocusTimerSnapshot, now = Date.now()): number {
  if (s.mode === 'stopwatch') {
    if (s.running && s.stopwatchStartedAt != null) {
      return Math.max(0, Math.floor((s.stopwatchElapsedMs + (now - s.stopwatchStartedAt)) / 1000))
    }
    return Math.max(0, Math.floor(s.stopwatchElapsedMs / 1000))
  }
  if (s.running && s.endsAt != null) {
    return Math.max(0, Math.ceil((s.endsAt - now) / 1000))
  }
  return Math.max(0, s.remaining)
}

export function startTimer(s: FocusTimerSnapshot, now = Date.now()): FocusTimerSnapshot {
  if (s.mode === 'stopwatch') {
    return {
      ...s,
      running: true,
      finished: false,
      logged: false,
      stopwatchStartedAt: now,
    }
  }
  const rem = s.finished || s.remaining <= 0 ? totalSeconds(s) : s.remaining
  return {
    ...s,
    running: true,
    finished: false,
    logged: false,
    remaining: rem,
    endsAt: now + rem * 1000,
  }
}

export function pauseTimer(s: FocusTimerSnapshot, now = Date.now()): FocusTimerSnapshot {
  if (!s.running) return s
  if (s.mode === 'stopwatch') {
    const extra = s.stopwatchStartedAt != null ? now - s.stopwatchStartedAt : 0
    return {
      ...s,
      running: false,
      stopwatchStartedAt: null,
      stopwatchElapsedMs: s.stopwatchElapsedMs + extra,
    }
  }
  return {
    ...s,
    running: false,
    remaining: displayedSeconds(s, now),
    endsAt: null,
  }
}

export function resetTimer(s: FocusTimerSnapshot): FocusTimerSnapshot {
  return {
    ...s,
    running: false,
    finished: false,
    logged: false,
    endsAt: null,
    remaining: totalSeconds(s),
    stopwatchStartedAt: null,
    stopwatchElapsedMs: 0,
  }
}

export function switchMode(s: FocusTimerSnapshot, mode: FocusMode): FocusTimerSnapshot {
  return resetTimer({
    ...s,
    mode,
    phase: mode === 'pomodoro' ? s.phase : 'focus',
  })
}

export function setPhase(s: FocusTimerSnapshot, phase: FocusPhase): FocusTimerSnapshot {
  return resetTimer({ ...s, phase })
}

export function setCountdownMin(s: FocusTimerSnapshot, minutes: number): FocusTimerSnapshot {
  return resetTimer({ ...s, countdownMin: minutes, mode: 'countdown' })
}

export function extendSeconds(s: FocusTimerSnapshot, extra: number, now = Date.now()): FocusTimerSnapshot {
  if (s.mode === 'stopwatch') {
    return startTimer({ ...s, finished: false }, now)
  }
  const rem = displayedSeconds(s, now) + extra
  return {
    ...s,
    running: true,
    finished: false,
    logged: false,
    remaining: rem,
    endsAt: now + rem * 1000,
  }
}

export function completeTimer(s: FocusTimerSnapshot, now = Date.now()): FocusTimerSnapshot {
  const paused = pauseTimer(s, now)
  return { ...paused, running: false, finished: true, remaining: 0, endsAt: null }
}

export function hydrateTimer(s: FocusTimerSnapshot, now = Date.now()): FocusTimerSnapshot {
  if (hasEnded(s, now)) return completeTimer(s, now)
  if (s.running && s.mode === 'stopwatch' && s.stopwatchStartedAt == null) {
    return { ...s, stopwatchStartedAt: now }
  }
  return s
}

export function hasEnded(s: FocusTimerSnapshot, now = Date.now()): boolean {
  if (!s.running || s.mode === 'stopwatch') return false
  return s.endsAt != null && now >= s.endsAt
}

export function shouldRestoreOverlay(s: FocusTimerSnapshot | null, now = Date.now()): boolean {
  if (!s) return false
  if (s.running) return true
  if (hasEnded(s, now) && !s.logged) return true
  return false
}

export function workedSeconds(s: FocusTimerSnapshot, now = Date.now()): number {
  if (s.mode === 'pomodoro' && s.phase === 'break') return 0
  if (s.mode === 'stopwatch') return displayedSeconds(s, now)
  return Math.max(0, totalSeconds(s) - displayedSeconds(s, now))
}

export function progressPct(s: FocusTimerSnapshot, now = Date.now()): number {
  if (s.mode === 'stopwatch') return 0
  const total = totalSeconds(s)
  if (!total) return 0
  return Math.min(100, Math.max(0, ((total - displayedSeconds(s, now)) / total) * 100))
}

function sessionStorageOrNull(): Storage | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}

export function loadFocusSession(): FocusTimerSnapshot | null {
  const st = sessionStorageOrNull()
  if (!st) return null
  try {
    const raw = st.getItem(FOCUS_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FocusTimerSnapshot & { updatedAt?: number }
    if (typeof parsed !== 'object' || parsed == null) return null
    if (parsed.updatedAt && Date.now() - parsed.updatedAt > MAX_AGE_MS) {
      st.removeItem(FOCUS_SESSION_KEY)
      return null
    }
    if (parsed.mode !== 'pomodoro' && parsed.mode !== 'countdown' && parsed.mode !== 'stopwatch') return null
    return {
      ...defaultSnapshot(typeof parsed.selected === 'string' ? parsed.selected : ''),
      ...parsed,
      selected: typeof parsed.selected === 'string' ? parsed.selected : '',
    }
  } catch {
    return null
  }
}

export function saveFocusSession(s: FocusTimerSnapshot) {
  const st = sessionStorageOrNull()
  if (!st) return
  try {
    st.setItem(FOCUS_SESSION_KEY, JSON.stringify({ ...s, updatedAt: Date.now() }))
  } catch {
    /* private mode */
  }
}

export function clearFocusSession() {
  const st = sessionStorageOrNull()
  if (!st) return
  try {
    st.removeItem(FOCUS_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function shouldRestoreFocus(s: FocusTimerSnapshot | null, now = Date.now()): boolean {
  if (!s) return false
  if (s.running || hasEnded(s, now) || s.finished) return true
  if (s.mode === 'stopwatch' && s.stopwatchElapsedMs > 0) return true
  return s.remaining > 0 && s.remaining < totalSeconds(s)
}
