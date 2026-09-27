import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { toISODate, todayISO, parseISODate, formatDateShort } from '@/lib/dates'
import { WeekPulse } from '@/components/analytics/WeekPulse'
import type { Task } from '@/lib/types'

const WEEKDAYS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CalendarView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const updateTask = useStore((s) => s.updateTask)
  const openNewTask = useUIStore((s) => s.openNewTask)
  const openTask = useUIStore((s) => s.openTask)
  const settings = useStore((s) => s.settings)

  const [monthOffset, setMonthOffset] = useState(0)
  const [dragOver, setDragOver] = useState<string | null>(null)

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

  return (
    <div className="space-y-4">
      <WeekPulse tasks={tasks} />

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">{monthLabel}</h2>
        <span className="rounded-full bg-[var(--tf-accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--tf-accent-text-strong)]">
          {monthLabel.split(' ')[1]} · {monthLabel.split(' ')[0]}
        </span>
        <span className="flex-1" />
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-sm" onClick={() => setMonthOffset((v) => v - 1)} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonthOffset(0)} aria-label="Go to this month">
            Today
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonthOffset((v) => v + 1)} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openNewTask({ dueDate: today })}>
          <Plus size={14} /> New task
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--tf-text-muted)]">
        {projects.filter((p) => !p.archived).map((p) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: p.color }} /> {p.name}
          </span>
        ))}
        {projects.filter((p) => !p.archived).length === 0 && <span>No projects yet — tasks will use gray chips.</span>}
      </div>

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
                  const id = e.dataTransfer.getData('text/task-id')
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
                      {t.dueTime && <span className="shrink-0 text-[9px] font-bold opacity-80">{t.dueTime}</span>}
                    </button>
                  ))}
                  {list.length > 3 && <span className="px-1.5 text-[10px] font-semibold text-[var(--tf-text-muted)]">+{list.length - 3} more</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-center text-[11px] text-[var(--tf-text-faint)]">
        Tap an empty day to schedule a new task. Drag a colored chip onto another day to reschedule. Tap a chip to edit.
      </p>
    </div>
  )
}
