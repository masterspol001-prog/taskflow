import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Play, Pause, RotateCcw, Target, Coffee, Check, Plus, CalendarClock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { notify, permissionGranted } from '@/lib/notify'
import { todayISO, toISODate } from '@/lib/dates'
import type { FocusMode } from '@/lib/types'
import { PRIORITIES } from '@/lib/constants'
import { estimateLabel } from '@/lib/time'

type SessionMode = FocusMode
const POMODORO_WORK = 25 * 60
const POMODORO_BREAK = 5 * 60

export function FocusOverlay() {
  const open = useUIStore((s) => s.focusOpen)
  const setOpen = useUIStore((s) => s.setFocus)
  const focusSeedTaskId = useUIStore((s) => s.focusSeedTaskId)
  const tasks = useStore((s) => s.tasks)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const logFocusMinutes = useStore((s) => s.logFocusMinutes)
  const postponeTask = useStore((s) => s.postponeTask)
  const toast = useStore((s) => s.toast)

  const [selected, setSelected] = useState<string>('')

  const todayOpen = useMemo(() => {
    const open = tasks.filter((t) => !t.archived && !t.completed)
    const seed = focusSeedTaskId ? open.find((t) => t.id === focusSeedTaskId) : undefined
    const rest = open.filter((t) => t.id !== focusSeedTaskId && (t.dueDate === todayISO() || t.dueDate === null))
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
    const selectedTask = tasks.find((t) => t.id === selected)
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
  }, [tasks, selected])

  const [mode, setMode] = useState<SessionMode>('pomodoro')
  const [seconds, setSeconds] = useState(POMODORO_WORK)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<'focus' | 'break'>('focus')
  const [countdownMin, setCountdownMin] = useState(15)
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const tick = useRef<number | null>(null)
  const stopwatchStart = useRef<number>(0)

  const totalSeconds =
    mode === 'pomodoro'
      ? phase === 'focus'
        ? POMODORO_WORK
        : POMODORO_BREAK
      : mode === 'countdown'
      ? countdownMin * 60
      : 0

  // Reset the timer when opened or mode changes.
  useEffect(() => {
    if (!open) return
    setRunning(false)
    setFinished(false)
    setPhase('focus')
    setSeconds(POMODORO_WORK)
    setElapsed(0)
    setMode('pomodoro')
    const seed = focusSeedTaskId && tasks.some((t) => t.id === focusSeedTaskId && !t.archived && !t.completed)
      ? focusSeedTaskId
      : todayOpen[0]?.id ?? ''
    setSelected(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!running) return
    if (mode === 'stopwatch') {
      stopwatchStart.current = Date.now() - elapsed * 1000
    }
    tick.current = window.setInterval(() => {
      if (mode === 'stopwatch') {
        setElapsed(Math.floor((Date.now() - stopwatchStart.current) / 1000))
      } else {
        setSeconds((s) => {
          if (s <= 1) {
            window.setTimeout(() => handleSessionEnd(), 0)
            return 0
          }
          return s - 1
        })
      }
    }, 1000)
    return () => {
      if (tick.current) window.clearInterval(tick.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode])

  const logSession = (mins: number) => {
    if (selected && mins >= 1 && !(mode === 'pomodoro' && phase === 'break')) {
      logFocusMinutes(selected, mins)
    }
  }

  const handleSessionEnd = () => {
    setRunning(false)
    setFinished(true)
    const worked =
      mode === 'stopwatch'
        ? elapsed
        : mode === 'countdown'
        ? countdownMin * 60 - seconds
        : phase === 'focus'
        ? POMODORO_WORK
        : 0
    logSession(Math.round(worked / 60))
    const title = mode === 'pomodoro' ? (phase === 'focus' ? 'Focus session complete' : 'Break over') : 'Countdown finished'
    const body = mode === 'pomodoro' && phase === 'focus' ? 'Time for a short break — nice work.' : selected ? 'Time to refocus on your task.' : 'Great session.'
    notify(title, body)
  }

  useEffect(() => {
    if (!open || mode !== 'pomodoro') return
    setSeconds(phase === 'focus' ? POMODORO_WORK : POMODORO_BREAK)
    setRunning(false)
  }, [phase, mode, open])

  if (!open) return null

  const fmt = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const displayed = mode === 'stopwatch' ? elapsed : seconds
  const progress =
    mode === 'stopwatch'
      ? 0
      : totalSeconds
      ? Math.min(100, Math.max(0, ((totalSeconds - seconds) / totalSeconds) * 100))
      : 0

  const startStop = () => {
    if (finished) {
      setFinished(false)
      if (mode !== 'stopwatch') setSeconds(totalSeconds)
      else setElapsed(0)
    }
    setRunning((r) => !r)
  }

  const reset = () => {
    setRunning(false)
    setFinished(false)
    if (mode === 'pomodoro') setSeconds(phase === 'focus' ? POMODORO_WORK : POMODORO_BREAK)
    else if (mode === 'countdown') setSeconds(countdownMin * 60)
    else setElapsed(0)
  }

  const finishEarly = () => {
    if (mode === 'pomodoro') {
      if (phase === 'focus') {
        logSession(Math.max(1, Math.round((POMODORO_WORK - seconds) / 60)))
        setPhase('break')
        setFinished(true)
        notify('Focus session complete', 'Time for a short break — nice work.')
      } else {
        setPhase('focus')
        setFinished(true)
        notify('Break over', 'Time to refocus.')
      }
    } else {
      handleSessionEnd()
    }
  }

  const addFiveMinutes = () => {
    setFinished(false)
    if (mode === 'stopwatch') {
      setRunning(true)
      return
    }
    setSeconds((s) => s + 5 * 60)
    setRunning(true)
  }

  const markDone = () => {
    if (selected) {
      toggleComplete(selected)
      toast({ title: 'Done', message: 'Task completed. Nice work.', kind: 'success' })
    }
    setFinished(false)
    setOpen(false)
  }

  const rescheduleSelected = () => {
    if (selected) postponeTask(selected)
    setFinished(false)
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Focus mode">
      <div className="absolute inset-0 bg-[var(--tf-overlay)] backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-modal animate-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--tf-border)] px-5 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">
            <Target size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[var(--tf-text)]">
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
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close focus mode">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          {/* Mode tabs */}
          <div className="flex gap-1 rounded-xl bg-[var(--tf-surface-2)] p-1" role="tablist" aria-label="Focus type">
            {(['pomodoro', 'countdown', 'stopwatch'] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m)
                  setRunning(false)
                  setFinished(false)
                  if (m === 'pomodoro') setSeconds(phase === 'focus' ? POMODORO_WORK : POMODORO_BREAK)
                  else if (m === 'countdown') setSeconds(countdownMin * 60)
                  else setElapsed(0)
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
                    setCountdownMin(n)
                    setSeconds(n * 60)
                    setFinished(false)
                    setRunning(false)
                  }}
                  aria-pressed={countdownMin === n}
                  className={`rounded-lg border px-2 py-1 text-[12px] font-semibold ${countdownMin === n ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-strong)]'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* Timer display */}
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              className="relative flex h-56 w-56 items-center justify-center rounded-full"
              style={{ background: 'radial-gradient(circle, var(--tf-surface-2) 0%, var(--tf-surface-3) 100%)' }}
            >
              <svg className="absolute inset-0 -rotate-90" width="224" height="224" viewBox="0 0 224 224">
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
                <div className="font-mono text-5xl font-bold tabular-nums tracking-tight text-[var(--tf-text)]">{fmt(displayed)}</div>
                <div className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[var(--tf-text-muted)]">
                  {mode === 'pomodoro' ? (phase === 'focus' ? 'Focus' : 'Break') : mode === 'countdown' ? 'Countdown' : 'Elapsed'}
                </div>
              </div>
            </div>

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
                <button className="btn btn-primary h-12 w-32 justify-center gap-2 text-[15px]" onClick={startStop}>
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

          {/* Pick a task */}
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
                    <button
                      key={t.id}
                      onClick={() => setSelected(active ? '' : t.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors ${
                        active ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-strong)]'
                      }`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITIES[t.priority].color }} />
                      <span className="min-w-0 flex-1 truncate">
                        {t.title}
                        {t.estimate ? <span className="ml-1 text-[10px] opacity-70">{estimateLabel(t.estimate)}</span> : null}
                      </span>
                      <button className="btn btn-ghost icon-btn h-6 w-6 shrink-0" aria-label={`Complete ${t.title}`} onClick={(e) => { e.stopPropagation(); toggleComplete(t.id) }}>
                        <Check size={13} />
                      </button>
                    </button>
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
