import { useMemo, useState, type ReactNode } from 'react'
import { Play, ChevronDown, ChevronRight, Sun, CalendarClock } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import type { Task } from '@/lib/types'
import { todayISO } from '@/lib/dates'
import { dueLabel } from '@/lib/query'
import { isTaskOverdue } from '@/lib/stats'
import { formatTime } from '@/lib/time'
import { EmptyState } from '@/components/ui/states'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Good evening'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function TodayView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const name = useStore((s) => s.settings.name)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const toggleImportant = useStore((s) => s.toggleImportant)
  const openTask = useUIStore((s) => s.openTask)
  const navigate = useUIStore((s) => s.navigate)
  const setFocus = useUIStore((s) => s.setFocus)

  const today = todayISO()
  const [attentionOpen, setAttentionOpen] = useState(false)

  const data = useMemo(() => {
    const active = tasks.filter((t) => !t.archived)
    const dueToday = active.filter((t) => t.dueDate === today)
    const open = dueToday.filter((t) => !t.completed)
    const done = dueToday.filter((t) => t.completed)
    const overdue = active
      .filter((t) => !t.completed && isTaskOverdue(t))
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    const upcoming = active
      .filter((t) => !t.completed && t.dueDate && t.dueDate > today)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.sortOrder - b.sortOrder)
      .slice(0, 4)
    return { open, done, overdue, upcoming }
  }, [tasks, today])

  const totalToday = data.open.length + data.done.length
  const pct = totalToday ? Math.round((data.done.length / totalToday) * 100) : 0

  const focus = useMemo(() => {
    const pool = [...data.open].sort((a, b) => score(a) - score(b))
    return { top: pool.slice(0, 3), rest: pool.slice(3) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.open])

  const nothingScheduled = totalToday === 0 && data.overdue.length === 0
  const firstName = name ? name.trim().split(/\s+/)[0] : ''

  return (
    <div className="space-y-7">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-[1.6rem] border border-[var(--tf-border)] bg-[var(--tf-surface)] p-5 shadow-[var(--tf-shadow)] sm:p-7">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-70"
          style={{ background: 'radial-gradient(circle, rgb(var(--tf-accent-rgb) / 0.22), transparent 68%)' }}
        />
        <p className="relative text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">
          {greeting()}
          {firstName ? ` · ${firstName}` : ''}
        </p>
        <div className="relative mt-2 flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-[32px] font-semibold leading-[1.05] tracking-tight text-[var(--tf-text)] sm:text-[40px]">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          {totalToday > 0 && (
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--tf-surface-2)] px-3.5 py-2">
              <span className="display text-[22px] font-semibold tabular-nums text-[var(--tf-accent-text)]">{pct}%</span>
              <span className="text-[12px] font-medium leading-tight text-[var(--tf-text-muted)]">
                {data.done.length} of {totalToday}
                <br />
                done
              </span>
            </div>
          )}
        </div>
        <p className="relative mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--tf-text-secondary)]">
          {totalToday > 0
            ? data.done.length === totalToday
              ? 'Everything for today is done. Beautiful work.'
              : `${data.open.length} ${data.open.length === 1 ? 'task' : 'tasks'} left today. Let's make today count.`
            : data.overdue.length > 0
            ? 'Clear the backlog first, then plan ahead.'
            : 'Nothing scheduled for today. A calm day to get ahead.'}
        </p>
        {data.overdue.length > 0 && (
          <span className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500">
            {data.overdue.length} task{data.overdue.length === 1 ? '' : 's'} need your attention
          </span>
        )}
        {totalToday > 0 && (
          <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--tf-accent-light)] to-[var(--tf-accent)] transition-all duration-500 ease-smooth"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </header>

      {/* Fast add */}
      <AddTaskRow placeholder="Add a task for today…" defaultDueDate={today} />

      {/* Focus + later today */}
      {data.open.length > 0 && (
        <>
          <section aria-label="Focus for today">
            <SectionTitle icon={<Sun size={14} />} label="Focus for today" hint={focus.top.length > 1 ? `your top ${focus.top.length}` : undefined} />
            <Panel>
              {focus.top.map((task) => (
                <FocusRow
                  key={task.id}
                  task={task}
                  onToggle={() => toggleComplete(task.id)}
                  onOpen={() => openTask(task.id)}
                  onStart={() => setFocus(true, task.id)}
                />
              ))}
              {focus.rest.length > 0 && (
                <div className="mt-1 border-t border-[var(--tf-border)] px-1 pt-1.5">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-faint)]">
                    Later today · {focus.rest.length}
                  </p>
                  {focus.rest.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      project={task.projectId ? projects.find((p) => p.id === task.projectId) : undefined}
                      onToggle={() => toggleComplete(task.id)}
                      onOpen={() => openTask(task.id)}
                      onToggleImportant={() => toggleImportant(task.id)}
                      compact
                    />
                  ))}
                </div>
              )}
            </Panel>
          </section>
        </>
      )}

      {/* Needs attention (overdue) */}
      {data.overdue.length > 0 && (
        <section aria-label="Needs attention">
          <button
            className="flex w-full items-center gap-2 text-left"
            onClick={() => setAttentionOpen((v) => !v)}
            aria-expanded={attentionOpen}
          >
            <span className="text-[15px] font-semibold text-[var(--tf-text)]">Needs attention</span>
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-500">
              {data.overdue.length} overdue
            </span>
            {attentionOpen ? <ChevronDown size={16} className="text-[var(--tf-text-faint)]" /> : <ChevronRight size={16} className="text-[var(--tf-text-faint)]" />}
          </button>
          {attentionOpen && (
            <Panel className="mt-2">
              {data.overdue.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  project={task.projectId ? projects.find((p) => p.id === task.projectId) : undefined}
                  onToggle={() => toggleComplete(task.id)}
                  onOpen={() => openTask(task.id)}
                  onToggleImportant={() => toggleImportant(task.id)}
                  compact
                  suppressOverduePill
                />
              ))}
            </Panel>
          )}
        </section>
      )}

      {/* Nothing scheduled state */}
      {nothingScheduled && (
        <EmptyState
          icon="sun"
          title="All done for today"
          description={
            data.upcoming.length > 0
              ? 'Nothing is due today. Here is what is coming up next.'
              : 'Nothing is due today. Enjoy the calm, or plan ahead.'
          }
        />
      )}

      {/* Upcoming teaser */}
      {data.upcoming.length > 0 && (
        <section aria-label="Coming up">
          <SectionTitle icon={<CalendarClock size={14} />} label="Coming up" />
          <Panel>
            {data.upcoming.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                project={task.projectId ? projects.find((p) => p.id === task.projectId) : undefined}
                onToggle={() => toggleComplete(task.id)}
                onOpen={() => openTask(task.id)}
                onToggleImportant={() => toggleImportant(task.id)}
                compact
              />
            ))}
            <button className="mt-1 w-full rounded-lg px-2 py-1.5 text-[13px] font-medium text-[var(--tf-accent-text)] hover:bg-[var(--tf-hover)]" onClick={() => navigate('upcoming')}>
              See all upcoming →
            </button>
          </Panel>
        </section>
      )}
    </div>
  )
}

function score(t: Task): number {
  const urgent = t.dueDate && t.dueTime ? 1 : 0
  return -(Number(t.important) * 10000 + t.priority * 1000 + urgent * 100)
}

function SectionTitle({ icon, label, hint }: { icon: ReactNode; label: string; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">{icon}</span>
      <h2 className="display text-[18px] font-semibold text-[var(--tf-text)]">{label}</h2>
      {hint && <span className="text-xs text-[var(--tf-text-faint)]">· {hint}</span>}
      <span className="ml-auto" />
    </div>
  )
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-[var(--tf-shadow)] ${className ?? ''}`}>
      {children}
    </div>
  )
}

function FocusRow({
  task,
  onToggle,
  onOpen,
  onStart,
}: {
  task: Task
  onToggle: () => void
  onOpen: () => void
  onStart: () => void
}) {
  const projects = useStore((s) => s.projects)
  const project = task.projectId ? projects.find((p) => p.id === task.projectId) : undefined
  const row = (
    <>
      <FocusCheck onToggle={onToggle} task={task} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Open ${task.title}`}>
        <p className="truncate text-[15px] font-medium text-[var(--tf-text)]">{task.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--tf-text-muted)]">
          {project && (
            <span className="inline-flex items-center gap-1">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {task.dueDate && task.dueTime && <span>{dueLabel(task.dueDate)} · {formatTime(task.dueTime)}</span>}
          {task.important && <span className="font-medium text-amber-500">Important</span>}
        </p>
      </button>
      <button
        className="btn btn-primary btn-sm shrink-0"
        onClick={(e) => {
          e.stopPropagation()
          onStart()
        }}
        aria-label={`Start focusing on ${task.title}`}
      >
        <Play size={13} /> Focus
      </button>
    </>
  )

  return (
    <div className="flex items-center gap-3 border-b border-[var(--tf-border)] px-3.5 py-3.5 last:border-b-0 hover:bg-[var(--tf-hover)]">
      {row}
    </div>
  )
}

function FocusCheck({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <TaskCheckbox
      completed={task.completed}
      priority={task.priority}
      onToggle={onToggle}
      label={`Mark "${task.title}" ${task.completed ? 'as not done' : 'as done'}`}
    />
  )
}
