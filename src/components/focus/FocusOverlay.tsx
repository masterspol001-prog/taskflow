import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Play, Pause, RotateCcw, Target, Coffee, Check, Plus, CalendarClock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { notify, permissionGranted } from '@/lib/notify'
import { todayISO, toISODate } from '@/lib/dates'
import { PRIORITIES } from '@/lib/constants'
import { estimateLabel } from '@/lib/time'
import {
  type FocusTimerSnapshot,
  clearFocusSession,
  completeTimer,
  defaultSnapshot,
  displayedSeconds,
  extendSeconds,
  hasEnded,
  hydrateTimer,
  loadFocusSession,
  pauseTimer,
  progressPct,
  resetTimer,
  saveFocusSession,
  setCountdownMin,
  setPhase,
  shouldRestoreFocus,
  shouldRestoreOverlay,
  startTimer,
  switchMode,
  workedSeconds,
} from '@/lib/focusTimer'

export function FocusOverlay() {
  const open = useUIStore((s) => s.focusOpen)
  const setOpen = useUIStore((s) => s.setFocus)
  const focusSeedTaskId = useUIStore((s) => s.focusSeedTaskId)
  const tasks = useStore((s) => s.tasks)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const logFocusMinutes = useStore((s) => s.logFocusMinutes)
  const postponeTask = useStore((s) => s.postponeTask)
  const toast = useStore((s) => s.toast)

  const [session, setSession] = useState<FocusTimerSnapshot>(() => defaultSnapshot())
  const [now, setNow] = useState(() => Date.now())
  const [interruptions, setInterruptions] = useState(0)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const startRef = useRef<HTMLButtonElement | null>(null)
  const endedRef = useRef(false)
  const restoredRef = useRef(false)

  const todayOpen = useMemo(() => {
    const openTasks = tasks.filter((t) => !t.archived && !t.completed)
    const seed = focusSeedTaskId ? openTasks.find((t) => t.id === focusSeedTaskId) : undefined
    const rest = openTasks.filter((t) => t.id !== focusSeedTaskId && (t.dueDate === todayISO() || t.dueDate === null))
    return (seed ? [seed, ...rest] : rest).slice(0, 12)
  }, [tasks, focusSeedTaskId])

  const sessionStats = useMemo(() => {
    const today = todayISO()
    let minutes = 0
    let sessions = 0
    for (const t of tasks) {
      const hist = t.actualMinutes ?? []
      if (!hist.length) continue
      if (t.completed && t.completedAt && toISODate(new Date(t.completedAt)) === today) {
        minutes += hist[hist.length - 1]
        sessions += 1
      } else if (!t.completed) {
        minutes += hist.reduce((a, b) => a + b, 0)
        sessions += hist.length
      }
    }
    const selectedTask = tasks.find((t) => t.id === session.selected)
    const vsEstimate =
      selectedTask && selectedTask.estimate
        ? Math.round(((selectedTask.actualMinutes ?? []).reduce((a, b) => a + b, 0) / selectedTask.estimate) * 100)
        : null
    const log = tasks
      .filter((t) => (t.actualMinutes ?? []).length > 0)
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        minutes: (t.actualMinutes ?? []).reduce((a, b) => a + b, 0),
        estimate: t.estimate ?? null,
      }))
    return { minutes, sessions, vsEstimate, log }
  }, [tasks, session.selected])

  useEffect(() => {
    const saved = loadFocusSession()
    if (saved && shouldRestoreOverlay(saved) && !useUIStore.getState().focusOpen) {
      useUIStore.getState().setFocus(true, saved.selected || null)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      restoredRef.current = false
      endedRef.current = false
      return
    }
    const saved = loadFocusSession()
    const seed =
      focusSeedTaskId && tasks.some((t) => t.id === focusSeedTaskId && !t.archived && !t.completed)
        ? focusSeedTaskId
        : todayOpen[0]?.id ?? ''
    setInterruptions(0)
    if (saved && shouldRestoreFocus(saved) && !restoredRef.current) {
      restoredRef.current = true
      const restored = hydrateTimer({ ...saved, selected: saved.selected || seed })
      endedRef.current = Boolean(restored.logged)
      setSession(restored)
    } else if (!restoredRef.current) {
      restoredRef.current = true
      setSession(defaultSnapshot(seed))
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const id = window.setTimeout(() => startRef.current?.focus(), 0)
    return () => {
      document.body.style.overflow = prevOverflow
      window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    saveFocusSession(session)
  }, [open, session])

  useEffect(() => {
    if (!open) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 250)
    const onVis = () => tick()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [open])

  const logSession = (mins: number, current: FocusTimerSnapshot) => {
    if (current.selected && mins >= 1 && !(current.mode === 'pomodoro' && current.phase === 'break')) {
      logFocusMinutes(current.selected, mins, interruptions)
      setInterruptions(0)
    }
  }

  const handleSessionEnd = (current: FocusTimerSnapshot, at = Date.now()) => {
    if (endedRef.current || current.logged) return
    endedRef.current = true
    const next = { ...completeTimer(current, at), logged: true }
    setSession(next)
    const worked = workedSeconds(current, at)
    logSession(Math.round(worked / 60), current)
    const title = current.mode === 'pomodoro' ? (current.phase === 'focus' ? 'Focus session complete' : 'Break over') : 'Countdown finished'
    const body = current.mode === 'pomodoro' && current.phase === 'focus' ? 'Time for a short break — nice work.' : current.selected ? 'Time to refocus on your task.' : 'Great session.'
    notify(title, body)
  }

  useEffect(() => {
    if (!open) return
    if (hasEnded(session, now) || (session.finished && !session.logged)) handleSessionEnd(session, now)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, now, session.running, session.endsAt])

  if (!open) return null

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const displayed = displayedSeconds(session, now)
  const progress = progressPct(session, now)
  const { mode, phase, running, finished, countdownMin, selected } = session

  const startStop = () => {
    endedRef.current = false
    setSession((s) => (s.running ? pauseTimer(s) : startTimer(s.finished ? resetTimer(s) : s)))
  }

  const reset = () => {
    endedRef.current = false
    setSession((s) => resetTimer(s))
  }

  const finishEarly = () => {
    if (session.mode === 'pomodoro') {
      if (session.phase === 'focus') {
        const mins = Math.max(1, Math.round(workedSeconds(session) / 60))
        logSession(mins, session)
        endedRef.current = true
        setSession((s) => ({ ...setPhase(s, 'break'), finished: true, logged: true }))
        notify('Focus session complete', 'Time for a short break — nice work.')
      } else {
        endedRef.current = true
        setSession((s) => ({ ...setPhase(s, 'focus'), finished: true, logged: true }))
        notify('Break over', 'Time to refocus.')
      }
    } else {
      handleSessionEnd(session)
    }
  }

  const addFiveMinutes = () => {
    endedRef.current = false
    setSession((s) => extendSeconds(s, 5 * 60))
  }

  const markDone = () => {
    if (selected) {
      toggleComplete(selected)
      toast({ title: 'Done', message: 'Task completed. Nice work.', kind: 'success' })
    }
    clearFocusSession()
    setOpen(false)
  }

  const rescheduleSelected = () => {
    if (selected) postponeTask(selected)
    clearFocusSession()
    setOpen(false)
  }

  const close = () => {
    if (!session.running && (session.finished || displayedSeconds(session) === 0 || session.mode === 'stopwatch' && displayedSeconds(session) === 0)) {
      clearFocusSession()
    } else {
      saveFocusSession(session.running ? pauseTimer(session) : session)
    }
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="focus-title">
      <div className="absolute inset-0 bg-[var(--tf-overlay)] backdrop-blur-sm animate-fade-in" onClick={close} aria-hidden="true" />
      <div ref={panelRef} className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-modal animate-scale-in">
        <div className="flex items-center gap-3 border-b border-[var(--tf-border)] px-5 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">
            <Target size={17} />
          </span>
          <div className="min-w-0">
            <h2 id="focus-title" className="truncate text-[15px] font-semibold text-[var(--tf-text)]">
              {tasks.find((t) => t.id === selected)?.title ?? 'Focus'}
            </h2>
            <p className="text-[11px] text-[var(--tf-text-muted)]">One thing. Until it is done.</p>
          </div>
          {finished && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-bold text-green-600">
              <Check size={11} /> Session complete
            </span>
          )}
          <span className="flex-1" />
          {!permissionGranted() && <span className="hidden text-[10px] text-[var(--tf-text-faint)] sm:block">enable notifications for chimes</span>}
          <button className="icon-btn" onClick={close} aria-label="Close focus mode">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="flex gap-1 rounded-xl bg-[var(--tf-surface-2)] p-1" role="tablist" aria-label="Focus type">
            {(['pomodoro', 'countdown', 'stopwatch'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  endedRef.current = false
                  setSession((s) => switchMode(s, m))
                }}
                className={`flex-1 rounded-lg py-2 text-[12.5px] font-semibold capitalize transition-colors ${
                  mode === m ? 'bg-[var(--tf-surface)] text-[var(--tf-accent-text-strong)] shadow-sm' : 'text-[var(--tf-text-muted)] hover:text-[var(--tf-text)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {mode === 'countdown' && (
            <div className="flex items-center gap-2 text-[12.5px] text-[var(--tf-text-secondary)]">
              <span>Minutes</span>
              {[5, 10, 15, 25, 45, 60].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    endedRef.current = false
                    setSession((s) => setCountdownMin(s, n))
                  }}
                  aria-pressed={countdownMin === n}
                  className={`rounded-lg border px-2 py-1 text-[12px] font-semibold ${countdownMin === n ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-strong)]'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col items-center gap-3 py-2">
            <div
              className="relative flex h-56 w-56 items-center justify-center rounded-full"
              style={{ background: 'radial-gradient(circle, var(--tf-surface-2) 0%, var(--tf-surface-3) 100%)' }}
            >
              <svg className="absolute inset-0 -rotate-90" width="224" height="224" viewBox="0 0 224 224" aria-hidden="true">
                <circle cx="112" cy="112" r="100" fill="none" strokeWidth="10" style={{ stroke: 'var(--tf-surface-3)' }} />
                <circle
                  cx="112"
                  cy="112"
                  r="100"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 100}
                  strokeDashoffset={(1 - progress / 100) * 2 * Math.PI * 100}
                  style={{ stroke: mode === 'pomodoro' && phase === 'break' ? '#2f9e6e' : 'var(--tf-accent)' }}
                  className="transition-[stroke-dashoffset] duration-500 ease-smooth"
                />
              </svg>
              <div className="text-center">
                <div className="font-mono text-5xl font-bold tabular-nums tracking-tight text-[var(--tf-text)]" aria-live="polite" aria-atomic="true">
                  {fmt(displayed)}
                </div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--tf-text-muted)]">
                  {mode === 'pomodoro' ? (phase === 'focus' ? 'Focus' : 'Break') : mode === 'countdown' ? 'Countdown' : 'Elapsed'}
                </div>
              </div>
            </div>

            {!finished && (
              <div className="flex items-center gap-2 text-[12.5px] text-[var(--tf-text-muted)]">
                <span>Interruptions</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setInterruptions((n) => n + 1)}
                  aria-label="Log an interruption"
                >
                  +1
                </button>
                <span className="tabular-nums font-medium text-[var(--tf-text)]">{interruptions}</span>
              </div>
            )}

            {finished ? (
              <div className="flex w-full flex-col items-center gap-2">
                <p className="text-[12.5px] font-medium text-[var(--tf-text-muted)]">Session complete — what next?</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button className="btn btn-primary h-11 px-4" onClick={markDone} aria-label="Mark task done">
                    <Check size={16} /> Done
                  </button>
                  <button className="btn btn-secondary h-11 px-4" onClick={addFiveMinutes} aria-label="Add five minutes">
                    <Plus size={16} /> +5 min
                  </button>
                  <button className="btn btn-ghost h-11 px-4" onClick={rescheduleSelected} aria-label="Reschedule task" disabled={!selected}>
                    <CalendarClock size={16} /> Reschedule
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost icon-btn" onClick={reset} aria-label="Reset timer">
                  <RotateCcw size={18} />
                </button>
                <button
                  ref={startRef}
                  className="btn btn-primary h-12 w-32 justify-center gap-2 text-[15px]"
                  onClick={startStop}
                  aria-label={running ? 'Pause focus timer' : 'Start focus timer'}
                >
                  {running ? <Pause size={18} /> : <Play size={18} />}
                  {running ? 'Pause' : 'Start'}
                </button>
                <button className="btn btn-ghost icon-btn" onClick={finishEarly} aria-label="Skip / finish session">
                  <Coffee size={18} />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[var(--tf-surface-2)] px-2 py-2">
              <p className="text-[16px] font-semibold tabular-nums text-[var(--tf-text)]">{sessionStats.minutes}m</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Today</p>
            </div>
            <div className="rounded-xl bg-[var(--tf-surface-2)] px-2 py-2">
              <p className="text-[16px] font-semibold tabular-nums text-[var(--tf-text)]">{sessionStats.sessions}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Sessions</p>
            </div>
            <div className="rounded-xl bg-[var(--tf-surface-2)] px-2 py-2">
              <p className="text-[16px] font-semibold tabular-nums text-[var(--tf-text)]">
                {sessionStats.vsEstimate != null ? `${sessionStats.vsEstimate}%` : '—'}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">vs est.</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Focusing on</p>
            {todayOpen.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--tf-border-strong)] px-4 py-3 text-[13px] text-[var(--tf-text-faint)]">
                No open tasks to focus on. Add a task first — or just enjoy a distraction-free block.
              </p>
            ) : (
              <div className="grid max-h-44 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {todayOpen.map((t) => {
                  const active = selected === t.id
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] transition-colors ${
                        active ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-strong)]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSession((s) => ({ ...s, selected: active ? '' : t.id }))}
                        aria-pressed={active}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITIES[t.priority].color }} aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">
                          {t.title}
                          {t.estimate ? <span className="ml-1 text-[10px] opacity-70">{estimateLabel(t.estimate)}</span> : null}
                        </span>
                      </button>
                      <button type="button" className="btn btn-ghost icon-btn h-6 w-6 shrink-0" aria-label={`Complete ${t.title}`} onClick={() => toggleComplete(t.id)}>
                        <Check size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            {sessionStats.log.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Session log</p>
                {sessionStats.log.map((row) => (
                  <p key={row.id} className="flex justify-between text-[12px] text-[var(--tf-text-secondary)]">
                    <span className="truncate">{row.title}</span>
                    <span className="tabular-nums">{row.minutes}m{row.estimate ? ` / ${row.estimate}m` : ''}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
