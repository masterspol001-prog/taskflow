import { describe, it, expect, beforeEach } from 'vitest'
import {
  FOCUS_SESSION_KEY,
  POMODORO_WORK,
  completeTimer,
  defaultSnapshot,
  displayedSeconds,
  hasEnded,
  hydrateTimer,
  loadFocusSession,
  pauseTimer,
  progressPct,
  resetTimer,
  saveFocusSession,
  shouldRestoreFocus,
  shouldRestoreOverlay,
  startTimer,
  totalSeconds,
  workedSeconds,
} from '../focusTimer'

describe('focusTimer', () => {
  const t0 = 1_700_000_000_000

  beforeEach(() => {
    sessionStorage.clear()
  })

  it('starts a countdown against an absolute deadline', () => {
    const started = startTimer(defaultSnapshot('t1'), t0)
    expect(started.running).toBe(true)
    expect(started.endsAt).toBe(t0 + POMODORO_WORK * 1000)
    expect(displayedSeconds(started, t0)).toBe(POMODORO_WORK)
    expect(displayedSeconds(started, t0 + 60_000)).toBe(POMODORO_WORK - 60)
  })

  it('pauses without losing remaining time', () => {
    const started = startTimer(defaultSnapshot('t1'), t0)
    const paused = pauseTimer(started, t0 + 90_000)
    expect(paused.running).toBe(false)
    expect(paused.remaining).toBe(POMODORO_WORK - 90)
    expect(displayedSeconds(paused, t0 + 120_000)).toBe(POMODORO_WORK - 90)
  })

  it('resumes from the paused remaining, not the original duration', () => {
    const started = startTimer(defaultSnapshot('t1'), t0)
    const paused = pauseTimer(started, t0 + 30_000)
    const resumed = startTimer(paused, t0 + 40_000)
    expect(displayedSeconds(resumed, t0 + 50_000)).toBe(POMODORO_WORK - 40)
  })

  it('marks the session ended after the deadline', () => {
    const started = startTimer(defaultSnapshot('t1'), t0)
    expect(hasEnded(started, t0 + POMODORO_WORK * 1000 - 1)).toBe(false)
    expect(hasEnded(started, t0 + POMODORO_WORK * 1000)).toBe(true)
    const done = hydrateTimer(started, t0 + POMODORO_WORK * 1000 + 5_000)
    expect(done.finished).toBe(true)
    expect(done.running).toBe(false)
    expect(workedSeconds(started, t0 + POMODORO_WORK * 1000)).toBe(POMODORO_WORK)
  })

  it('clamps progress between 0 and 100', () => {
    const started = startTimer(defaultSnapshot(), t0)
    expect(progressPct(started, t0)).toBe(0)
    expect(progressPct(started, t0 + POMODORO_WORK * 1000)).toBe(100)
    expect(progressPct(started, t0 + POMODORO_WORK * 2000)).toBe(100)
  })

  it('does not count break time as focused work', () => {
    const brk = startTimer({ ...defaultSnapshot(), phase: 'break' }, t0)
    expect(workedSeconds(brk, t0 + 60_000)).toBe(0)
  })

  it('persists and restores a running session', () => {
    sessionStorage.clear()
    const started = startTimer(defaultSnapshot('ship'), t0)
    saveFocusSession(started)
    expect(sessionStorage.getItem(FOCUS_SESSION_KEY)).toBeTruthy()
    const loaded = loadFocusSession()
    expect(loaded?.selected).toBe('ship')
    expect(loaded?.running).toBe(true)
    expect(shouldRestoreOverlay(loaded)).toBe(true)
    expect(shouldRestoreFocus(loaded)).toBe(true)
  })

  it('does not auto-open a paused session after close', () => {
    const paused = pauseTimer(startTimer(defaultSnapshot('t1'), t0), t0 + 10_000)
    expect(shouldRestoreOverlay(paused)).toBe(false)
    expect(shouldRestoreFocus(paused)).toBe(true)
  })

  it('reset restores the full duration', () => {
    const started = startTimer(defaultSnapshot(), t0)
    const reset = resetTimer(started)
    expect(reset.running).toBe(false)
    expect(reset.remaining).toBe(totalSeconds(reset))
    expect(reset.logged).toBe(false)
  })

  it('completeTimer finishes without inventing extra work', () => {
    const started = startTimer(defaultSnapshot('t1'), t0)
    const done = completeTimer(started, t0 + 120_000)
    expect(done.finished).toBe(true)
    expect(done.running).toBe(false)
    expect(done.remaining).toBe(0)
  })
})

describe('focusTimer storage isolation', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(loadFocusSession()).toBeNull()
  })
})
