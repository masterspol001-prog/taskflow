import { memo, useState, type ReactNode } from 'react'
import { Calendar, Clock, Repeat, Star, ListChecks, GripVertical, AlertTriangle } from 'lucide-react'
import type { Project, Task } from '@/lib/types'
import { PRIORITIES } from '@/lib/constants'
import { dueLabel } from '@/lib/query'
import { isTaskOverdue } from '@/lib/stats'
import { todayISO, parseISODate, addDaysISO } from '@/lib/dates'
import { TaskCheckbox } from './TaskCheckbox'
import { formatTime, estimateLabel } from '@/lib/time'

export interface TaskItemProps {
  task: Task
  project?: Project
  onToggle: () => void
  onOpen: () => void
  onToggleImportant: () => void
  dragHandleProps?: Record<string, unknown>
  dragProps?: Record<string, unknown>
  innerRef?: (el: HTMLElement | null) => void
  compact?: boolean
  hideProject?: boolean
  /** When true, suppress the standalone "Overdue" flag (rows inside an overdue/needs-attention group). */
  suppressOverduePill?: boolean
}

export const TaskItem = memo(function TaskItem({
  task,
  project,
  onToggle,
  onOpen,
  onToggleImportant,
  dragHandleProps,
  dragProps,
  innerRef,
  compact,
  hideProject,
  suppressOverduePill,
}: TaskItemProps) {
  const [hovered, setHovered] = useState(false)
  const overdue = isTaskOverdue(task)
  const isDueToday = !task.completed && task.dueDate === todayISO()

  // Secondary line: date · time · project · tags (calm, one hierarchy level)
  const meta: ReactNode[] = []

  if (task.dueDate) {
    const isLate = overdue && !task.completed
    const label =
      isLate && suppressOverduePill ? calmOverdueLabel(task.dueDate) : dueLabel(task.dueDate)
    meta.push(
      <span
        key="due"
        className={`inline-flex items-center gap-1 ${
          isLate && !suppressOverduePill
            ? 'font-semibold text-red-500'
            : isDueToday && !suppressOverduePill
            ? 'font-medium text-orange-600'
            : 'text-[var(--tf-text-muted)]'
        }`}
      >
        {isLate && !suppressOverduePill && <AlertTriangle size={11} />}
        <Calendar size={11} className="opacity-70" />
        {label}
      </span>
    )
  }

  if (task.dueDate && task.dueTime) {
    meta.push(
      <span key="time" className="inline-flex items-center gap-1 text-[var(--tf-text-faint)]">
        <Clock size={11} /> {formatTime(task.dueTime)}
      </span>
    )
  }

  if (task.estimate) {
    meta.push(
      <span key="estimate" className="inline-flex items-center gap-1 text-[var(--tf-text-faint)]">
        {estimateLabel(task.estimate)}
      </span>
    )
  }

  if (!hideProject && project && task.projectId) {
    meta.push(
      <span key="project" className="inline-flex items-center gap-1.5 text-[var(--tf-text-muted)]">
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: project.color }} />
        {project.name}
      </span>
    )
  }

  for (const tag of task.tags.slice(0, 2)) {
    meta.push(
      <span key={`tag-${tag}`} className="text-[var(--tf-text-faint)]">
        #{tag}
      </span>
    )
  }

  const subCount = task.subtasks.length
  const subDone = task.subtasks.filter((s) => s.completed).length
  if (subCount > 0) {
    meta.push(
      <span
        key="subs"
        className={`inline-flex items-center gap-1 ${subDone === subCount ? 'text-emerald-500' : 'text-[var(--tf-text-muted)]'}`}
      >
        <ListChecks size={11} />
        {subDone}/{subCount}
      </span>
    )
  }

  if (task.recurrence) {
    meta.push(
      <span key="repeat" className="text-[var(--tf-text-faint)]" title="Repeating task">
        <Repeat size={11} />
      </span>
    )
  }

  return (
    <div
      ref={innerRef}
      {...dragProps}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-200 ${
        task.completed
          ? 'border-transparent opacity-50'
          : 'border-transparent hover:border-[var(--tf-border)] hover:bg-[var(--tf-surface-2)]/90 hover:shadow-[var(--tf-shadow)]'
      } ${compact ? '' : 'min-h-[52px]'}`}
    >
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="mt-0.5 cursor-grab touch-none text-[var(--tf-text-faint)] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
          role="button"
          tabIndex={-1}
        >
          <GripVertical size={15} />
        </div>
      )}

      <TaskCheckbox
        completed={task.completed}
        priority={task.priority}
        onToggle={onToggle}
        label={`Mark "${task.title}" ${task.completed ? 'as not done' : 'as done'}`}
      />

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-none" aria-label={`Open ${task.title}`}>
        <p
          className={`truncate text-[14px] leading-snug ${
            task.completed
              ? 'text-[var(--tf-text-muted)] line-through decoration-1'
              : 'font-medium text-[var(--tf-text)]'
          }`}
        >
          {task.title}
        </p>

        {meta.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-none">
            {meta.map((el, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="mr-0.5 text-[10px] text-[var(--tf-text-faint)] opacity-70">·</span>}
                {el}
              </span>
            ))}
          </div>
        )}

        {task.notes && !compact && (
          <p className="mt-1 truncate text-xs text-[var(--tf-text-faint)]">{task.notes}</p>
        )}
      </button>

      {/* Right side: tertiary priority indicator + important action (hover-revealed, focus-revealed) */}
      <div
        className={`flex shrink-0 items-center gap-1 transition-opacity duration-150 ${
          hovered || task.completed || task.important ? 'opacity-100' : 'opacity-0 focus-within:opacity-100'
        }`}
      >
        {task.priority >= 3 && (
          <span
            className="hidden h-[22px] items-center justify-center rounded-md px-1.5 text-[11px] font-semibold leading-none sm:flex"
            style={{ color: PRIORITIES[task.priority].color, background: PRIORITIES[task.priority].bg }}
            title={`${PRIORITIES[task.priority].label} priority`}
          >
            {PRIORITIES[task.priority].label}
          </span>
        )}
        <button
          className="icon-btn h-7 w-7"
          aria-label={task.important ? 'Remove from important' : 'Mark important'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleImportant()
          }}
        >
          <Star
            size={15}
            className={task.important ? 'text-amber-500' : 'text-[var(--tf-text-faint)]'}
            fill={task.important ? 'currentColor' : 'none'}
          />
        </button>
      </div>
    </div>
  )
})

/** Calm, non-alarmist due label used inside an overdue/"needs attention" group. */
function calmOverdueLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Today'
  if (iso === addDaysISO(today, -1)) return 'Yesterday'
  const d = parseISODate(iso)
  if (!d) return iso
  const days = Math.round((Date.now() - d.getTime()) / 86400000)
  if (days < 8) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
