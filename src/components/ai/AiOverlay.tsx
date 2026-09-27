import { useMemo, useState } from 'react'
import { Bot, CalendarClock, Clock, Loader2, Sparkles, Wand2, X, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { Modal } from '@/components/ui/Modal'
import { todayISO, addDaysISO } from '@/lib/dates'
import { estimateLabel, taskDuration } from '@/lib/time'
import { isPro } from '@/lib/pro'
import type { Task } from '@/lib/types'

function toMin(k: string) {
  const [h, m] = k.split(':').map(Number)
  return h * 60 + m
}

function fmt(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

interface Slot {
  task: Task
  start: number
  end: number
  fixed?: boolean
}

export function AiOverlay() {
  const open = useUIStore((s) => s.aiOpen)
  const setAi = useUIStore((s) => s.setAi)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const settings = useStore((s) => s.settings)
  const updateTask = useStore((s) => s.updateTask)
  const [applied, setApplied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [aiSlots, setAiSlots] = useState<Slot[] | null>(null)

  const pro = isPro(settings)
  const hasKey = pro && !!settings.ai?.apiKey

  const local = useMemo(() => schedule(tasks), [tasks])
  const slots = aiSlots ?? local
  const usingAI = aiSlots !== null

  const todayOpen = useMemo(() => tasks.filter((t) => !t.archived && !t.completed && t.dueDate === todayISO()), [tasks])
  const projected = useMemo(
    () => todayOpen.filter((t) => !t.dueTime).reduce((sum, t) => sum + taskDuration(t), 0),
    [todayOpen]
  )

  const apply = () => {
    for (const s of slots) {
      updateTask(s.task.id, { dueTime: fmt(s.start) })
    }
    setApplied(true)
  }

  const planWithAI = async () => {
    setBusy(true)
    setErr(null)
    setAiSlots(null)
    try {
      const res = await llmPlan(tasks, settings.ai!)
      setAiSlots(res)
      setApplied(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The model did not return a usable plan.')
      setAiSlots(null)
    } finally {
      setBusy(false)
    }
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
          AI Day Planner
          {hasKey && <span className="rounded-full bg-[var(--tf-accent)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--tf-accent-text)]">LLM</span>}
        </span>
      }
      variant="drawer"
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-[var(--tf-text-muted)]">
          A smart schedule for your most valuable work — pulled from due dates, priorities and the estimates you set.
          It runs on your device, needs no API key and costs nothing.
        </p>

        {projected > 0 && (
          <div className="card flex items-center gap-3 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
              <CalendarClock size={17} />
            </span>
            <p className="text-sm text-[var(--tf-text-secondary)]">
              About <b className="text-[var(--tf-text)]">{Math.max(1, Math.round(projected / 60))}h</b> of work is due today.
            </p>
          </div>
        )}

        {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">{err}</div>}

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--tf-text-secondary)]">
            {usingAI ? 'Model plan' : 'Suggested plan'}
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
                <button className="btn btn-ghost btn-sm" onClick={() => { setAiSlots(null); setApplied(false) }}>
                  <Wand2 size={13} /> Reset
                </button>
              </>
            )}
          </div>
        </div>

        {slots.length === 0 ? (
          <div className="card space-y-2 p-6 text-center">
            <Sparkles size={22} className="mx-auto text-[var(--tf-accent)]" />
            <p className="text-sm font-medium text-[var(--tf-text)]">Nothing scheduled for today</p>
            <p className="text-xs text-[var(--tf-text-muted)]">
              Add or point a task at today and open this again — or tag an undated task as important and it can appear here too.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {slots.map((s, i) => (
              <div key={s.task.id + String(i)} className={`card flex items-center gap-3 p-3 ${s.fixed ? 'opacity-75' : ''}`}>
                <div className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--tf-surface-3)]">
                  <Clock size={12} className="text-[var(--tf-accent)]" />
                  <span className="text-xs font-semibold tabular-nums text-[var(--tf-text)]">{fmt(s.start)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--tf-text)]">{s.task.title}</p>
                  <p className="text-xs text-[var(--tf-text-muted)]">
                    {projectName(s.task.projectId)}
                    {s.task.projectId ? ' · ' : ''}
                    {s.task.estimate ? estimateLabel(s.task.estimate) : `scheduled ${estimateLabel(s.end - s.start)}`}
                  </p>
                </div>
                {s.fixed && (
                  <span className="shrink-0 rounded-full bg-[var(--tf-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--tf-accent)]">
                    TIMED
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {slots.length > 0 && !busy && (
          <button className="btn btn-primary w-full" onClick={apply} disabled={applied}>
            {applied ? (<><Check size={15} /> Applied to your day</>) : 'Apply this plan'}
          </button>
        )}

        <div className="flex items-start gap-2 rounded-xl bg-[var(--tf-surface-2)] p-3 text-xs leading-relaxed text-[var(--tf-text-muted)]">
          <X size={13} className="mt-0.5 shrink-0" />
          {hasKey
            ? 'Model plans only use the endpoint you configure. The built-in scheduler always stays free.'
            : 'Your plan is built on this device — private, instant and free.'}
        </div>
      </div>
    </Modal>
  )
}

function schedule(tasks: Task[]): Slot[] {
  const now = todayISO()
  const horizon = addDaysISO(now, 7)
  const dayStart = 9 * 60
  const dayEnd = 18 * 60

  const open = tasks.filter((t) => !t.archived && !t.completed)

  const fixed = open
    .filter((t) => t.dueDate === now && t.dueTime)
    .sort((a, b) => (a.dueTime! < b.dueTime! ? -1 : 1))
    .map((t) => ({
      task: t,
      start: toMin(t.dueTime!),
      end: toMin(t.dueTime!) + taskDuration(t),
      fixed: true,
    }))

  // Schedulable floaters: anything due today/overdue, or due inside the week.
  let float = open.filter(
    (t) => !t.dueTime && (!t.dueDate || (t.dueDate >= now && t.dueDate <= horizon) || t.dueDate < now)
  )
  // If the day is empty, gently pull in undated important tasks so there is always a plan.
  if (float.length === 0) {
    float = open.filter((t) => !t.dueTime && !t.dueDate && (t.important || (t.priority ?? 2) <= 2)).slice(0, 6)
  }
  float.sort((a, b) => score(a) - score(b))

  const out: Slot[] = [...fixed]
  let cursor = dayStart

  for (const t of float) {
    const dur = taskDuration(t)
    let start = Math.max(cursor, dayStart)
    if (start + dur > dayEnd) break
    const overlapsFixed = fixed.some((f) => start < f.end && start + dur > f.start)
    if (overlapsFixed) {
      start = Math.max(...fixed.map((f) => f.end))
      if (start + dur > dayEnd) break
    }
    out.push({ task: t, start, end: start + dur })
    cursor = start + dur + 5
  }

  return out
}

function score(t: Task): number {
  const prio = (t.priority ?? 2) - 1
  const imp = t.important ? 0 : 1
  const due = t.dueDate
    ? t.dueDate < todayISO()
      ? -1
      : (Date.parse(t.dueDate + 'T00:00:00') - Date.parse(todayISO() + 'T00:00:00')) / 86400000
    : 3
  return prio * 4 + imp * 2 + Math.max(-1, Math.min(due, 3))
}

/** Builds scheduling slots from an LLM response, clamping to the working day. */
async function llmPlan(tasks: Task[], cfg: { baseUrl: string; model: string; apiKey: string }): Promise<Slot[]> {
  const now = todayISO()
  const horizon = addDaysISO(now, 7)
  const candidates = tasks
    .filter((t) => !t.archived && !t.completed && !t.dueTime && !!t.estimate && t.dueDate && t.dueDate >= now && t.dueDate <= horizon)
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      title: t.title,
      estimateMin: t.estimate,
      due: t.dueDate,
      priority: t.priority ?? 2,
      important: !!t.important,
    }))

  if (candidates.length === 0) {
    return schedule(tasks).filter((s) => !s.fixed)
  }

  const system =
    'You are an expert personal productivity planner. You schedule focused work into a day. ' +
    'Respond ONLY with valid JSON, no prose, no markdown fences. ' +
    'Return an array of objects, one per input task you choose to schedule today, with keys {id,time} where time is "HH:MM" between 09:00 and 18:00. ' +
    'Do not overlap tasks: leave at least 10 minutes between end of one (start + estimateMin) and start of the next. ' +
    'Place important and high-priority tasks first, and never schedule past 18:00.'

  const user = JSON.stringify({
    today: now,
    guidance:
      'Schedule the highest-value tasks for today within 09:00-18:00. Use each task id exactly as given. Prefer tasks due today, then important, then earlier deadlines.',
    tasks: candidates,
  })

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
          { role: 'user', content: user },
        ],
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Model request failed (${res.status}). ${body.slice(0, 140)}`)
    }
    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    raw = content
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

  const dayStart = 9 * 60
  const dayEnd = 18 * 60
  const byId = new Map(candidates.map((c) => [c.id, tasks.find((t) => t.id === c.id)!]))
  const occupied: { start: number; end: number }[] = schedule(tasks)
    .filter((s) => s.fixed)
    .map((s) => ({ start: s.start, end: s.end }))

  const out: Slot[] = []
  for (const e of entries) {
    if (!e.id || !e.time) continue
    const task = byId.get(e.id)
    if (!task) continue
    let start = toMin(e.time)
    const dur = taskDuration(task, 60)
    start = Math.max(dayStart, Math.min(start, dayEnd - dur))
    const clash = occupied.find((o) => start < o.end && start + dur > o.start)
    if (clash) start = Math.max(dayStart, Math.min(clash.end, dayEnd - dur))
    if (start + dur > dayEnd) continue
    occupied.push({ start, end: start + dur })
    out.push({ task, start, end: start + dur })
  }

  if (out.length === 0) throw new Error('No usable tasks came back from the model.')
  out.sort((a, b) => a.start - b.start)
  return out
}
