import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Flag, Plus, Sparkles, Target, Upload } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { toISODate, todayISO, parseISODate, formatDateShort } from '@/lib/dates'
import { WeekPulse } from '@/components/analytics/WeekPulse'
import type { Goal, Task } from '@/lib/types'
import { buildDayPlan, detectConflicts, minutesToHHMM, hhmmToMinutes, learnedDuration } from '@/lib/agent'
import { horizonMeta } from '@/lib/goals'
import { tasksToICS } from '@/lib/ics'

const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const updateTask = useStore((s) => s.updateTask)
  const openNewTask = useUIStore((s) => s.openNewTask)
  const openTask = useUIStore((s) => s.openTask)
  const navigate = useUIStore((s) => s.navigate)
  const settings = useStore((s) => s.settings)

  const [monthOffset, setMonthOffset] = useState(0)
  const [weekOffset, setWeekOffset] = useState(0)
  const [mode, setMode] = useState<'month' | 'week' | 'day'>('month')
  const [dragOver, setDragOver] = useState<string | null>(null)
  const setAi = useUIStore((s) => s.setAi)
  const importICS = useStore((s) => s.importICS)
  const toast = useStore((s) => s.toast)
  const icsRef = useRef<HTMLInputElement>(null)
  const todayPlan = useMemo(() => buildDayPlan(tasks, settings.energy ?? 'medium', todayISO()), [tasks, settings.energy])
  const plannedIds = useMemo(() => new Set(todayPlan.slots.map((s) => s.taskId)), [todayPlan])
  const planByTask = useMemo(() => new Map(todayPlan.slots.map((s) => [s.taskId, s])), [todayPlan])

  const today = todayISO()
  const anchor = useMemo(() => {
    const base = new Date()
    base.setHours(12, 0, 0, 0)
    base.setDate(1)
    base.setMonth(base.getMonth() + monthOffset)
    return base
  }, [monthOffset])

  const cells = useMemo(() => {
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const first = new Date(year, month, 1, 12)
    const startDow = first.getDay()
    const lead = settings.weekStartMonday ? (startDow === 0 ? -6 : 1 - startDow) : -startDow
    const gridStart = new Date(year, month, 1 + lead, 12)
    const out: { iso: string; inMonth: boolean; isToday: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      const iso = toISODate(d)
      out.push({ iso, inMonth: d.getMonth() === month, isToday: iso === today })
    }
    return out
  }, [anchor, today, settings.weekStartMonday])

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    const active = tasks.filter((t) => !t.archived && !t.completed && t.dueDate)
    for (const t of active) {
      const arr = map.get(t.dueDate!) ?? []
      arr.push(t)
      map.set(t.dueDate!, arr)
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.dueTime ?? '').localeCompare(b.dueTime ?? '') || b.priority - a.priority)
    return map
  }, [tasks])

  const monthLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const projectColor = (id: string | null) => {
    const p = projects.find((x) => x.id === id)
    return p ? p.color : '#8a8ea3'
  }
  const weekdays = settings.weekStartMonday ? WEEKDAYS_MON : WEEKDAYS_SUN
  const dayTasks = (iso: string) => byDate.get(iso) ?? []

  const goalByDate = useMemo(() => {
    const map = new Map<string, Goal[]>()
    for (const g of goals) {
      if (g.status === 'archived' || !g.targetDate) continue
      const arr = map.get(g.targetDate) ?? []
      arr.push(g)
      map.set(g.targetDate, arr)
    }
    return map
  }, [goals])

  const milestoneByDate = useMemo(() => {
    const map = new Map<string, { goal: Goal; id: string; title: string }[]>()
    for (const g of goals) {
      if (g.status === 'archived') continue
      for (const m of g.milestones ?? []) {
        if (!m.dueDate || m.done) continue
        const arr = map.get(m.dueDate) ?? []
        arr.push({ goal: g, id: m.id, title: m.title })
        map.set(m.dueDate, arr)
      }
    }
    return map
  }, [goals])

  const monthGoals = useMemo(() => {
    const prefix = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}`
    return goals
      .filter((g) => g.status !== 'archived' && g.status !== 'completed' && g.targetDate?.startsWith(prefix))
      .sort((a, b) => (a.targetDate ?? '').localeCompare(b.targetDate ?? ''))
  }, [goals, anchor])

  const weekDays = useMemo(() => {
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    const dow = now.getDay()
    const back = settings.weekStartMonday ? (dow === 0 ? 6 : dow - 1) : dow
    now.setDate(now.getDate() - back + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(now.getDate() + i)
      const iso = toISODate(d)
      return { iso, isToday: iso === today, label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }
    })
  }, [weekOffset, settings.weekStartMonday, today])

  const hours = Array.from({ length: 12 }, (_, i) => 8 + i)

  const exportIcs = () => {
    const payload = tasksToICS(tasks)
    const blob = new Blob([payload], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `taskflow-${today}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const onImportIcs = async (file: File) => {
    const text = await file.text()
    const res = importICS(text)
    if (res.ok) toast({ title: 'Calendar imported', message: `${res.added} events added as tasks.`, kind: 'success' })
    else toast({ title: 'Import failed', message: res.error, kind: 'error' })
    if (icsRef.current) icsRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <WeekPulse tasks={tasks} />

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">
          {mode === 'month' ? monthLabel : mode === 'day' ? (weekDays.find((d) => d.isToday) ?? weekDays[0])?.label : `${weekDays[0]?.label} – ${weekDays[6]?.label}`}
        </h2>
        <span className="flex-1" />
        <div className="flex rounded-lg border border-[var(--tf-border)] p-0.5">
          <button
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${mode === 'month' ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text-muted)]'}`}
            onClick={() => setMode('month')}
          >
            Month
          </button>
          <button
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${mode === 'week' ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text-muted)]'}`}
            onClick={() => setMode('week')}
          >
            Week
          </button>
          <button
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${mode === 'day' ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text-muted)]'}`}
            onClick={() => setMode('day')}
          >
            Day
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => (mode === 'month' ? setMonthOffset((v) => v - 1) : setWeekOffset((v) => v - 1))}
            aria-label={mode === 'month' ? 'Previous month' : 'Previous week'}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setMonthOffset(0)
              setWeekOffset(0)
            }}
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => (mode === 'month' ? setMonthOffset((v) => v + 1) : setWeekOffset((v) => v + 1))}
            aria-label={mode === 'month' ? 'Next month' : 'Next week'}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={exportIcs}>
          <Download size={14} /> ICS
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => icsRef.current?.click()}>
          <Upload size={14} /> Import
        </button>
        <input
          ref={icsRef}
          type="file"
          accept=".ics,text/calendar"
          className="hidden"
          aria-label="Import ICS calendar"
          onChange={(e) => e.target.files?.[0] && onImportIcs(e.target.files[0])}
        />
        <button className="btn btn-secondary btn-sm" onClick={() => setAi(true)}>
          <Sparkles size={14} /> Fuse plan
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => openNewTask({ dueDate: today })}>
          <Plus size={14} /> New task
        </button>
      </div>

      {todayPlan.slots.length > 0 && monthOffset === 0 && (
        <div className="card flex flex-wrap items-center gap-2 p-3 text-[12.5px] text-[var(--tf-text-secondary)]">
          <Sparkles size={14} className="text-[var(--tf-accent)]" />
          Today’s plan · {todayPlan.slots.length} blocks · {Math.round(todayPlan.loadMinutes / 60 * 10) / 10}h
          {todayPlan.conflicts.length > 0 && (
            <span className="font-medium text-amber-600">{todayPlan.conflicts.length} conflict{todayPlan.conflicts.length === 1 ? '' : 's'}</span>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--tf-text-muted)]">
        {projects.filter((p) => !p.archived).map((p) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: p.color }} /> {p.name}
          </span>
        ))}
        {projects.filter((p) => !p.archived).length === 0 && <span>No projects yet — tasks will use gray chips.</span>}
      </div>

      {mode === 'week' || mode === 'day' ? (
        <WeekGrid
          weekDays={mode === 'day' ? [weekDays.find((d) => d.isToday) ?? weekDays[0]] : weekDays}
          hours={hours}
          dayTasks={dayTasks}
          projectColor={projectColor}
          openTask={openTask}
          openNewTask={openNewTask}
          updateTask={updateTask}
          dragOver={dragOver}
          setDragOver={setDragOver}
        />
      ) : (
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[var(--tf-border)]" role="row">
          {weekdays.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-[var(--tf-text-faint)]">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7" role="grid" aria-label={`${monthLabel} calendar`}>
          {cells.map((cell) => {
            const list = dayTasks(cell.iso)
            return (
              <div
                key={cell.iso}
                onClick={() => openNewTask({ dueDate: cell.iso })}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(cell.iso)
                }}
                onDragLeave={() => setDragOver((v) => (v === cell.iso ? null : v))}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/task-id') || e.dataTransfer.getData('text/plain')
                  if (id && cell.iso) updateTask(id, { dueDate: cell.iso })
                  setDragOver(null)
                }}
                aria-label={`${formatDateShort(cell.iso)}, ${list.length} task${list.length === 1 ? '' : 's'}`}
                role="gridcell"
                className={`group relative flex min-h-[72px] cursor-pointer flex-col items-stretch gap-1 border-b border-r border-[var(--tf-border)] p-1.5 text-left transition-colors sm:min-h-[96px] ${
                  cell.iso === dragOver
                    ? 'bg-[var(--tf-accent-soft)] ring-1 ring-inset ring-[var(--tf-accent-soft-strong)]'
                    : cell.inMonth
                    ? 'bg-[var(--tf-surface)] hover:bg-[var(--tf-hover)]'
                    : 'bg-[var(--tf-surface-2)]/50 hover:bg-[var(--tf-hover)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${
                      cell.isToday
                        ? 'bg-[var(--tf-accent)] text-white glow-sm'
                        : cell.inMonth
                        ? 'text-[var(--tf-text-secondary)]'
                        : 'text-[var(--tf-text-faint)]'
                    }`}
                  >
                    {parseISODate(cell.iso)?.getDate()}
                  </span>
                  {list.length > 0 && cell.inMonth && (
                    <span className="rounded-md bg-[var(--tf-surface-3)] px-1 text-[9px] font-bold text-[var(--tf-text-faint)]">{list.length}</span>
                  )}
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-1">
                  {list.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/task-id', t.id)
                        e.dataTransfer.setData('text/plain', t.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        openTask(t.id)
                      }}
                      className="flex cursor-grab items-center gap-1 overflow-hidden rounded-lg px-1.5 py-1 text-[11px] font-medium text-white shadow-sm transition-transform hover:brightness-110 active:cursor-grabbing"
                      style={{ background: projectColor(t.projectId) }}
                      title={t.title}
                    >
                      <span className="min-w-0 flex-1 truncate">{t.title}</span>
                      {(t.dueTime || (cell.isToday && plannedIds.has(t.id))) && (
                        <span className="shrink-0 text-[9px] font-bold opacity-80">
                          {t.dueTime || (planByTask.get(t.id) ? minutesToHHMM(planByTask.get(t.id)!.startMin) : '')}
                        </span>
                      )}
                    </button>
                  ))}
                  {list.length > 3 && (
                    <button
                      type="button"
                      className="px-1.5 text-left text-[10px] font-semibold text-[var(--tf-text-muted)] hover:text-[var(--tf-accent-text)]"
                      onClick={(e) => {
                        e.stopPropagation()
                        openTask(list[3].id)
                      }}
                    >
                      +{list.length - 3} more
                    </button>
                  )}
                </div>

                {(goalByDate.get(cell.iso)?.length || milestoneByDate.get(cell.iso)?.length) ? (
                  <div className="mt-auto flex flex-wrap gap-0.5">
                    {(goalByDate.get(cell.iso) ?? []).map((g) => (
                      <span
                        key={g.id}
                        className="inline-flex max-w-full items-center gap-0.5 truncate rounded px-1 text-[9px] font-bold text-white"
                        style={{ background: g.color }}
                        title={`Goal deadline: ${g.title}`}
                      >
                        <Target size={8} /> <span className="truncate">{g.title}</span>
                      </span>
                    ))}
                    {(milestoneByDate.get(cell.iso) ?? []).map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex max-w-full items-center gap-0.5 truncate rounded border px-1 text-[9px] font-semibold"
                        style={{ borderColor: m.goal.color, color: m.goal.color }}
                        title={`Milestone: ${m.title} (${m.goal.title})`}
                      >
                        <Flag size={8} /> <span className="truncate">{m.title}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      )}

      {mode === 'month' && monthGoals.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Target size={15} className="text-[var(--tf-accent-text)]" />
            <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Goal deadlines this month</h3>
          </div>
          <div className="space-y-1.5">
            {monthGoals.map((g) => (
              <button key={g.id} className="flex w-full items-center gap-2 text-left" onClick={() => navigate('goals')}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--tf-text-secondary)]">{g.title}</span>
                <span className="shrink-0 text-[10.5px] text-[var(--tf-text-faint)]">{horizonMeta(g.horizon).short}</span>
                <span className="shrink-0 text-[11px] text-[var(--tf-text-muted)]">{formatDateShort(g.targetDate!)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-[11px] text-[var(--tf-text-faint)]">
        Tap an empty day to schedule a new task. Drag a colored chip onto another day to reschedule. Tap a chip to edit. Export ICS to share timed blocks.
      </p>
    </div>
  )
}

function WeekGrid({
  weekDays,
  hours,
  dayTasks,
  projectColor,
  openTask,
  openNewTask,
  updateTask,
  dragOver,
  setDragOver,
}: {
  weekDays: { iso: string; isToday: boolean; label: string }[]
  hours: number[]
  dayTasks: (iso: string) => Task[]
  projectColor: (id: string | null) => string
  openTask: (id: string) => void
  openNewTask: (opts?: { dueDate?: string | null; dueTime?: string | null }) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  dragOver: string | null
  setDragOver: (v: string | null) => void
}) {
  const PX = 48
  return (
    <div className="card max-w-full overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid border-b border-[var(--tf-border)]" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
          <div />
          {weekDays.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => openNewTask({ dueDate: d.iso })}
              className={`px-2 py-2 text-center text-[12px] font-semibold ${d.isToday ? 'text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text-secondary)]'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
          <div className="relative" style={{ height: hours.length * PX }}>
            {hours.map((h) => (
              <div key={h} className="absolute right-1 text-[10px] text-[var(--tf-text-faint)]" style={{ top: (h - hours[0]) * PX }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {weekDays.map((d) => {
            const list = dayTasks(d.iso)
            const clashIds = new Set(
              detectConflicts(list, d.iso)
                .filter((c) => c.kind === 'overlap')
                .flatMap((c) => c.taskIds)
            )
            const dropKey = d.iso
            return (
              <div
                key={d.iso}
                className={`relative border-l border-[var(--tf-border)] ${d.iso === dragOver ? 'bg-[var(--tf-accent-soft)]' : d.isToday ? 'bg-[var(--tf-accent-soft)]/30' : ''}`}
                style={{ height: hours.length * PX }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(dropKey)
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/task-id') || e.dataTransfer.getData('text/plain')
                  const y = e.nativeEvent.offsetY
                  const hour = hours[0] + Math.max(0, Math.min(hours.length - 1, Math.floor(y / PX)))
                  const minute = y % PX > PX / 2 ? 30 : 0
                  if (id) updateTask(id, { dueDate: d.iso, dueTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` })
                  setDragOver(null)
                }}
                onClick={(e) => {
                  const y = (e.target as HTMLElement) === e.currentTarget ? e.nativeEvent.offsetY : 0
                  const hour = hours[0] + Math.max(0, Math.min(hours.length - 1, Math.floor(y / PX)))
                  openNewTask({ dueDate: d.iso, dueTime: `${String(hour).padStart(2, '0')}:00` })
                }}
              >
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-[var(--tf-border)]/70" style={{ top: (h - hours[0]) * PX, height: PX }} />
                ))}
                {list.map((t) => {
                  const start = t.dueTime ? hhmmToMinutes(t.dueTime) : hours[0] * 60
                  const dur = learnedDuration(t)
                  const top = ((start - hours[0] * 60) / 60) * PX
                  const height = Math.max(22, (dur / 60) * PX)
                  const clash = clashIds.has(t.id)
                  return (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation()
                        e.dataTransfer.setData('text/task-id', t.id)
                        e.dataTransfer.setData('text/plain', t.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        openTask(t.id)
                      }}
                      className={`absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-white shadow-sm ${clash ? 'ring-2 ring-amber-400' : ''}`}
                      style={{ top: Math.max(0, top), height, background: projectColor(t.projectId) }}
                      title={clash ? `${t.title} (conflict)` : t.title}
                    >
                      <span className="block truncate">{t.title}</span>
                      {t.dueTime && <span className="block text-[9px] opacity-80">{t.dueTime}</span>}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
