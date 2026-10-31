import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot, CalendarClock, Check, Clock, GitBranch, Loader2, Mic, MicOff, Sparkles, Wand2, Zap, Battery, BatteryLow, BatteryMedium,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { Modal } from '@/components/ui/Modal'
import { todayISO } from '@/lib/dates'
import { estimateLabel, formatTime } from '@/lib/time'
import type { EnergyLevel, Task } from '@/lib/types'
import {
  applyPlanTimes,
  buildDayPlan,
  buildWeeklyReview,
  captureFromText,
  learnedDuration,
  minutesToHHMM,
  pickNextAction,
  suggestSubtasks,
  type DayPlan,
  type PlanSlot,
  type WeeklyReview,
} from '@/lib/agent'

type Tab = 'today' | 'capture' | 'review'

export function AiOverlay() {
  const open = useUIStore((s) => s.aiOpen)
  const setAi = useUIStore((s) => s.setAi)
  const setFocus = useUIStore((s) => s.setFocus)
  const openTask = useUIStore((s) => s.openTask)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const settings = useStore((s) => s.settings)
  const updateTask = useStore((s) => s.updateTask)
  const addQuickTask = useStore((s) => s.addQuickTask)
  const setSubtasks = useStore((s) => s.setSubtasks)
  const postponeTask = useStore((s) => s.postponeTask)
  const setEnergy = useStore((s) => s.setEnergy)
  const toast = useStore((s) => s.toast)
  const tab = useUIStore((s) => s.aiTab)
  const setTab = (id: Tab) => setAi(true, id)
  const [applied, setApplied] = useState(false)
  const [reviewStep, setReviewStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [aiPlan, setAiPlan] = useState<DayPlan | null>(null)
  const [capture, setCapture] = useState('')
  const [splitId, setSplitId] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const recRef = useRef<{ stop: () => void } | null>(null)

  const hasKey = !!settings.ai?.apiKey
  const energy = settings.energy ?? 'medium'
  const local = useMemo(() => buildDayPlan(tasks, energy), [tasks, energy])
  const plan = aiPlan ?? local
  const next = useMemo(() => pickNextAction(tasks, energy), [tasks, energy])
  const review = useMemo(() => buildWeeklyReview(tasks, projects, goals), [tasks, projects, goals])
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

  const apply = () => {
    for (const patch of applyPlanTimes(plan)) {
      updateTask(patch.id, { dueDate: patch.dueDate, dueTime: patch.dueTime })
    }
    setApplied(true)
    toast({ title: 'Plan applied', message: `${plan.slots.length} tasks timed for today`, kind: 'success' })
  }

  const planWithAI = async () => {
    if (!settings.ai) return
    setBusy(true)
    setErr(null)
    try {
      const res = await llmPlan(tasks, energy, settings.ai)
      setAiPlan(res)
      setApplied(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The model did not return a usable plan.')
    } finally {
      setBusy(false)
    }
  }

  const onCapture = () => {
    const parsed = captureFromText(capture)
    if (!parsed.title) {
      toast({ title: 'Say what you need to do', kind: 'info' })
      return
    }
    const created = addQuickTask(parsed)
    if (created) {
      toast({ title: 'Captured', message: created.title, kind: 'success' })
      setCapture('')
    }
  }

  useEffect(() => {
    if (!open && recRef.current) {
      recRef.current.stop()
      recRef.current = null
      setListening(false)
    }
    if (open && tab === 'review') setReviewStep(0)
  }, [open, tab])

  const toggleVoice = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition
    if (!SR) {
      toast({ title: 'Voice not supported in this browser', kind: 'info' })
      return
    }
    if (listening && recRef.current) {
      recRef.current.stop()
      recRef.current = null
      setListening(false)
      return
    }
    const rec = new SR()
    rec.lang = navigator.language || 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (ev: SpeechRecEvent) => {
      let text = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript
      setCapture(text.trim())
    }
    rec.onerror = () => {
      setListening(false)
      recRef.current = null
    }
    rec.onend = () => {
      setListening(false)
      recRef.current = null
    }
    recRef.current = rec
    rec.start()
    setListening(true)
    setTab('capture')
  }

  const splitTask = (task: Task) => {
    const parts = suggestSubtasks(task.title)
    if (!parts.length) {
      toast({ title: 'Could not split that title', kind: 'info' })
      return
    }
    setSubtasks(task.id, parts.map((title, i) => ({ id: `${task.id}-s${i}`, title, completed: false })))
    setSplitId(task.id)
    toast({ title: 'Broken down', message: `${parts.length} steps`, kind: 'success' })
  }

  const projectName = (id: string | null) => (id ? projects.find((p) => p.id === id)?.name ?? '' : '')

  return (
    <Modal
      open={open}
      onClose={() => setAi(false)}
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--tf-accent)] to-[#7c3aed] text-white">
            <Bot size={15} />
          </span>
          Plan your day
        </span>
      }
      variant="drawer"
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-1 rounded-xl bg-[var(--tf-surface-2)] p-1">
          {([
            { id: 'today', label: 'Today' },
            { id: 'capture', label: 'Capture' },
            { id: 'review', label: 'Review' },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-lg py-1.5 text-[12.5px] font-semibold ${tab === t.id ? 'bg-[var(--tf-surface)] text-[var(--tf-text)] shadow-sm' : 'text-[var(--tf-text-muted)]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <EnergyRow value={energy} onChange={setEnergy} />

        {tab === 'today' && (
          <>
            {next && (
              <div className="card space-y-3 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Do this next</p>
                <p className="text-[16px] font-semibold text-[var(--tf-text)]">{next.task.title}</p>
                <p className="text-xs text-[var(--tf-text-muted)]">{next.reason}</p>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-primary btn-sm" onClick={() => { setFocus(true, next.task.id); setAi(false) }}>
                    <Zap size={13} /> Start
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => postponeTask(next.task.id)}>Later</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => openTask(next.task.id)}>Open</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => splitTask(next.task)}>
                    <GitBranch size={13} /> Split
                  </button>
                </div>
                {next.blockers.length > 0 && (
                  <p className="text-xs text-amber-600">Blocked by {next.blockers.map((b) => b.title).join(', ')}</p>
                )}
              </div>
            )}

            {plan.conflicts.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                {plan.conflicts.slice(0, 3).map((c) => (
                  <p key={c.message}>{c.message}</p>
                ))}
              </div>
            )}

            {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">{err}</div>}

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--tf-text-secondary)]">
                {aiPlan ? 'Model plan' : 'Suggested plan'}
              </h4>
              <div className="flex items-center gap-2">
                {busy ? (
                  <span className="flex items-center gap-1.5 text-xs text-[var(--tf-text-muted)]">
                    <Loader2 size={13} className="animate-spin" /> thinking…
                  </span>
                ) : (
                  <>
                    {hasKey && (
                      <button className="btn btn-secondary btn-sm" onClick={planWithAI}>
                        <Sparkles size={13} /> Generate with AI
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAiPlan(null); setApplied(false) }}>
                      <Wand2 size={13} /> Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            {plan.slots.length === 0 ? (
              <div className="card space-y-2 p-6 text-center">
                <Sparkles size={22} className="mx-auto text-[var(--tf-accent)]" />
                <p className="text-sm font-medium text-[var(--tf-text)]">Nothing to schedule</p>
                <p className="text-xs text-[var(--tf-text-muted)]">Capture a task or mark something due today.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plan.slots.map((s) => {
                  const task = byId.get(s.taskId)
                  if (!task) return null
                  return (
                    <div key={s.taskId} className={`card flex items-center gap-3 p-3 ${s.fixed ? 'opacity-75' : ''}`}>
                      <div className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--tf-surface-3)]">
                        <Clock size={12} className="text-[var(--tf-accent)]" />
                        <span className="text-xs font-semibold tabular-nums text-[var(--tf-text)]">{minutesToHHMM(s.startMin)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--tf-text)]">{task.title}</p>
                        <p className="text-xs text-[var(--tf-text-muted)]">
                          {projectName(task.projectId)}
                          {task.projectId ? ' · ' : ''}
                          {estimateLabel(s.endMin - s.startMin)} · {s.reason}
                        </p>
                      </div>
                      {s.fixed && (
                        <span className="shrink-0 rounded-full bg-[var(--tf-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--tf-accent)]">
                          TIMED
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {plan.loadMinutes > 0 && (
              <p className="text-xs text-[var(--tf-text-muted)]">
                <CalendarClock size={12} className="mr-1 inline" />
                {Math.round(plan.loadMinutes / 60 * 10) / 10}h planned of {plan.capacityMinutes / 60}h capacity
                {plan.unscheduled.length ? ` · ${plan.unscheduled.length} left unscheduled` : ''}
              </p>
            )}

            {plan.slots.length > 0 && !busy && (
              <button className="btn btn-primary w-full" onClick={apply} disabled={applied}>
                {applied ? (<><Check size={15} /> Applied to your day</>) : 'Apply this plan'}
              </button>
            )}
          </>
        )}

        {tab === 'capture' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--tf-text-muted)]">
              Type like a human. Dates, times, #project, p1–p4, duration and recurrence all parse on-device.
            </p>
            <textarea
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onCapture()
              }}
              placeholder="Buy groceries tomorrow at 6pm for 45m #shopping"
              className="input min-h-[96px]"
              aria-label="Capture task"
            />
            <CapturePreview text={capture} />
            <div className="flex gap-2">
              <button
                className={`btn btn-sm ${listening ? 'btn-primary' : 'btn-secondary'}`}
                onClick={toggleVoice}
                aria-pressed={listening}
                aria-label={listening ? 'Stop listening' : 'Speak a task'}
              >
                {listening ? <MicOff size={14} /> : <Mic size={14} />}
                {listening ? 'Listening…' : 'Speak'}
              </button>
              <button className="btn btn-primary flex-1" onClick={onCapture}>Capture</button>
            </div>
            {splitId && <p className="text-xs text-[var(--tf-text-muted)]">Last split saved on the task as subtasks.</p>}
          </div>
        )}

        {tab === 'review' && (
          <WeeklyReviewFlow
            review={review}
            step={reviewStep}
            setStep={setReviewStep}
            onCommit={() => {
              setTab('today')
              toast({ title: 'Three priorities locked', message: review.nextWeekFocus.slice(0, 3).join(' · '), kind: 'success' })
            }}
          />
        )}
      </div>
    </Modal>
  )
}

function EnergyRow({ value, onChange }: { value: EnergyLevel; onChange: (e: EnergyLevel) => void }) {
  const opts: { id: EnergyLevel; label: string; icon: typeof Battery }[] = [
    { id: 'low', label: 'Low', icon: BatteryLow },
    { id: 'medium', label: 'Steady', icon: BatteryMedium },
    { id: 'high', label: 'High', icon: Battery },
  ]
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Energy</span>
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium ${
            value === o.id
              ? 'border-[var(--tf-accent)] bg-[var(--tf-accent)]/10 text-[var(--tf-accent-text)]'
              : 'border-[var(--tf-border)] text-[var(--tf-text-muted)]'
          }`}
        >
          <o.icon size={12} /> {o.label}
        </button>
      ))}
    </div>
  )
}

function CapturePreview({ text }: { text: string }) {
  if (!text.trim()) return null
  const p = captureFromText(text)
  return (
    <div className="rounded-lg bg-[var(--tf-surface-2)] p-3 text-xs text-[var(--tf-text-secondary)]">
      <b className="text-[var(--tf-text)]">{p.title || '…'}</b>
      {p.dueDate ? ` · ${p.dueDate}` : ''}
      {p.dueTime ? ` ${formatTime(p.dueTime)}` : ''}
      {p.estimate ? ` · ${estimateLabel(p.estimate)}` : ''}
      {p.projectKey ? ` · #${p.projectKey}` : ''}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-lg font-bold text-[var(--tf-text)]">{value}</div>
      <div className="text-[11px] text-[var(--tf-text-muted)]">{label}</div>
    </div>
  )
}

function ReviewList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="card p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-[var(--tf-text-faint)]">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm text-[var(--tf-text)]">
          {items.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function WeeklyReviewFlow({
  review,
  step,
  setStep,
  onCommit,
}: {
  review: WeeklyReview
  step: number
  setStep: (n: number) => void
  onCommit: () => void
}) {
  const steps = ['What happened', 'Progress & stuck', '3 priorities']
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-[var(--tf-text-muted)]">Three minutes. Look back, then lock next week.</p>
      <div className="flex gap-1">
        {steps.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold ${
              step === i ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text-muted)]'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Done" value={review.completed} />
        <MiniStat label="Overdue" value={review.overdue} />
        <MiniStat label="Logged" value={`${Math.round(review.minutesLogged / 60)}h`} />
      </div>
      {review.summary && <p className="text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">{review.summary}</p>}
      {step === 0 && (
        <div className="space-y-2">
          <ReviewList title="What happened" items={review.wins} empty="Complete something this week." />
          <ReviewList title="Slipped" items={review.slips} empty="Nothing postponed or overdue." />
        </div>
      )}
      {step === 1 && (
        <div className="space-y-2">
          {review.goalsMoved.length > 0 ? (
            <ReviewList title="Goals that moved" items={review.goalsMoved} empty="" />
          ) : review.goalProgress.length > 0 ? (
            <div className="card p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">What progressed</p>
              {review.goalProgress.map((g) => (
                <div key={g.id} className="mb-2">
                  <div className="flex justify-between text-xs">
                    <span>{g.title}</span>
                    <span>{g.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
                    <div className="h-full bg-[var(--tf-accent)]" style={{ width: `${g.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--tf-text-faint)]">No goals linked yet.</p>
          )}
          <ReviewList title="What is stuck" items={review.slips} empty="Nothing is stuck." />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-2">
          <ReviewList title="Three priorities" items={review.nextWeekFocus.slice(0, 3)} empty="" />
          <ReviewList title="Stop" items={review.stopDoing} empty="Nothing to drop this week." />
          <ReviewList title="Start" items={review.startDoing} empty="" />
          <ReviewList title="Adjust next week" items={review.adjustments} empty="" />
        </div>
      )}
      <div className="flex gap-2">
        {step > 0 && (
          <button className="btn btn-secondary flex-1" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step < 2 ? (
          <button className="btn btn-primary flex-1" onClick={() => setStep(step + 1)}>
            Next
          </button>
        ) : (
          <button className="btn btn-primary flex-1" onClick={onCommit}>
            Plan next week
          </button>
        )}
      </div>
    </div>
  )
}

async function llmPlan(tasks: Task[], energy: EnergyLevel, cfg: { baseUrl: string; model: string; apiKey: string }): Promise<DayPlan> {
  const now = todayISO()
  const fallback = buildDayPlan(tasks, energy, now)
  const candidates = fallback.slots
    .map((s) => tasks.find((t) => t.id === s.taskId))
    .filter((t): t is Task => !!t)
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      title: t.title,
      estimateMin: learnedDuration(t),
      due: t.dueDate,
      priority: t.priority ?? 2,
      important: !!t.important,
      energy: t.energy ?? null,
    }))

  if (candidates.length === 0) return fallback

  const system =
    'You are an expert personal productivity planner. Respond ONLY with valid JSON, no markdown. ' +
    'Return an array of {id,time} where time is "HH:MM" between 09:00 and 18:00. Do not overlap tasks.'

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 20000)
  let raw: string
  try {
    const res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ today: now, energy, tasks: candidates }) },
        ],
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`Model request failed (${res.status})`)
    const data = await res.json()
    raw = data?.choices?.[0]?.message?.content ?? ''
  } finally {
    clearTimeout(timer)
  }

  const cleaned = raw.replace(/```json|```/g, '').trim()
  let startIdx = cleaned.indexOf('[')
  let endIdx = cleaned.lastIndexOf(']')
  if (startIdx === -1 || endIdx === -1) {
    startIdx = cleaned.indexOf('{')
    endIdx = cleaned.lastIndexOf('}')
  }
  const parsed = JSON.parse(cleaned.slice(startIdx, endIdx + 1))
  const entries: { id?: string; time?: string }[] = Array.isArray(parsed) ? parsed : [parsed]
  const byId = new Map(candidates.map((c) => [c.id, tasks.find((t) => t.id === c.id)!]))
  const occupied: { start: number; end: number }[] = []
  const slots: PlanSlot[] = []
  const toMin = (k: string) => {
    const [h, m] = k.split(':').map(Number)
    return h * 60 + m
  }
  for (const e of entries) {
    if (!e.id || !e.time) continue
    const task = byId.get(e.id)
    if (!task) continue
    let start = toMin(e.time)
    const dur = learnedDuration(task)
    start = Math.max(9 * 60, Math.min(start, 18 * 60 - dur))
    const clash = occupied.find((o) => start < o.end && start + dur > o.start)
    if (clash) start = Math.max(9 * 60, Math.min(clash.end, 18 * 60 - dur))
    if (start + dur > 18 * 60) continue
    occupied.push({ start, end: start + dur })
    slots.push({ taskId: task.id, startMin: start, endMin: start + dur, reason: 'model', fixed: false })
  }
  if (slots.length === 0) throw new Error('No usable tasks came back from the model.')
  slots.sort((a, b) => a.startMin - b.startMin)
  return {
    date: now,
    slots,
    unscheduled: fallback.unscheduled,
    conflicts: fallback.conflicts,
    loadMinutes: slots.reduce((n, s) => n + (s.endMin - s.startMin), 0),
    capacityMinutes: fallback.capacityMinutes,
  }
}

interface SpeechRecEvent {
  resultIndex: number
  results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }>
}

interface SpeechRec {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((ev: SpeechRecEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
