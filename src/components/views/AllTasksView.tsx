import { useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { PRIORITIES } from '@/lib/constants'
import { applyFilters, type TaskFilters } from '@/lib/query'
import { todayISO, addDaysISO } from '@/lib/dates'
import type { DueFilter, Priority, Task } from '@/lib/types'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TaskItem } from '@/components/tasks/TaskItem'
import { EmptyState } from '@/components/ui/states'
import { groupByProjectSection } from '@/lib/viewTasks'
import { goalForTask } from '@/lib/goals'

const empty: TaskFilters = {
  search: '',
  projectId: null,
  priority: null,
  important: null,
  completed: false,
  due: 'any',
}

export function AllTasksView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const savedFilters = useStore((s) => s.savedFilters)
  const saveFilter = useStore((s) => s.saveFilter)
  const removeFilter = useStore((s) => s.removeFilter)
  const updateTasks = useStore((s) => s.updateTasks)
  const parkTask = useStore((s) => s.parkTask)
  const toggleComplete = useStore((s) => s.toggleComplete)
  const toggleImportant = useStore((s) => s.toggleImportant)
  const toast = useStore((s) => s.toast)
  const openTask = useUIStore((s) => s.openTask)
  const [filters, setFilters] = useState<TaskFilters>(empty)
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const dirty = Boolean(filters.search || filters.projectId || filters.priority || filters.important || filters.due !== 'any')
  const today = todayISO()

  const list = useMemo(() => {
    const pool = tasks.filter((t) => !t.archived && !t.completed && !t.parked)
    return applyFilters(pool, filters)
  }, [tasks, filters])

  const groups = useMemo(() => groupByProjectSection(list), [list])

  const applySaved = (id: string) => {
    const f = savedFilters.find((x) => x.id === id)
    if (!f) return
    setFilters({
      search: f.search,
      projectId: f.projectId,
      priority: f.priority,
      important: f.important || null,
      completed: false,
      due: f.due,
    })
  }

  const onSave = () => {
    const saved = saveFilter({
      name: name.trim() || 'Untitled filter',
      search: filters.search ?? '',
      projectId: filters.projectId ?? null,
      priority: filters.priority ?? null,
      important: Boolean(filters.important),
      due: filters.due,
    })
    if (saved) setName('')
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const apply = (ids: string[], patch: Partial<Task>, message: string) => {
    updateTasks(ids, patch)
    setSelected(new Set())
    toast({ title: message, kind: 'success' })
  }

  const ids = selected.size > 0 ? [...selected] : []
  const visibleProjects = useMemo(() => projects.filter((p) => !p.archived), [projects])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--tf-border)] bg-[var(--tf-surface-2)] px-3 py-2.5">
        <input
          className="input !h-8 !py-0 text-[12.5px] sm:max-w-[12rem]"
          value={filters.search ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search"
          aria-label="Filter by text"
        />
        <select
          className="h-8 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] px-2 text-[12px]"
          value={filters.projectId ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value || null }))}
          aria-label="Filter by project"
        >
          <option value="">All projects</option>
          {projects.filter((p) => !p.archived).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          className="h-8 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] px-2 text-[12px]"
          value={filters.priority ?? ''}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value ? (Number(e.target.value) as Priority) : null }))}
          aria-label="Filter by priority"
        >
          <option value="">Any priority</option>
          {([1, 2, 3, 4] as const).map((p) => (
            <option key={p} value={p}>{PRIORITIES[p].label}</option>
          ))}
        </select>
        <select
          className="h-8 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] px-2 text-[12px]"
          value={filters.due}
          onChange={(e) => setFilters((f) => ({ ...f, due: e.target.value as DueFilter }))}
          aria-label="Filter by due"
        >
          <option value="any">Any date</option>
          <option value="today">Today</option>
          <option value="overdue">Overdue</option>
          <option value="upcoming">Upcoming</option>
          <option value="week">Next 7 days</option>
          <option value="none">No date</option>
        </select>
        <button
          className={`h-8 rounded-lg border px-2 text-[12px] font-medium ${filters.important ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]' : 'border-[var(--tf-border)]'}`}
          aria-pressed={Boolean(filters.important)}
          onClick={() => setFilters((f) => ({ ...f, important: f.important ? null : true }))}
        >
          Important
        </button>
        {dirty && (
          <button className="text-[11px] font-semibold text-[var(--tf-text-faint)]" onClick={() => setFilters(empty)}>
            Reset
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {savedFilters.map((f) => (
          <span key={f.id} className="flex items-center gap-1 rounded-full border border-[var(--tf-border)] bg-[var(--tf-surface)] pl-2.5 pr-1 py-1 text-[12px]">
            <button type="button" onClick={() => applySaved(f.id)}>{f.name}</button>
            <button type="button" className="px-1 text-[var(--tf-text-faint)]" aria-label={`Delete ${f.name}`} onClick={() => removeFilter(f.id)}>
              ×
            </button>
          </span>
        ))}
        {dirty && (
          <span className="flex items-center gap-1">
            <input
              className="input !h-8 !w-36 !py-0 text-[12px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this filter"
              aria-label="Saved filter name"
            />
            <button className="btn btn-secondary btn-sm" onClick={onSave}>Save</button>
          </span>
        )}
      </div>

      {list.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(new Set(list.map((t) => t.id)))}
          >
            Select all {list.length}
          </button>
          {ids.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          )}
        </div>
      )}

      {ids.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--tf-border)] bg-[var(--tf-surface-2)] px-3 py-2">
          <span className="text-[12px] font-semibold text-[var(--tf-text-muted)]">{ids.length} selected</span>
          <button className="btn btn-primary btn-sm" onClick={() => apply(ids, { dueDate: today, parked: false }, 'Scheduled for today')}>
            Today
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => apply(ids, { dueDate: addDaysISO(today, 1), parked: false }, 'Moved to tomorrow')}>
            Tomorrow
          </button>
          <label className="sr-only" htmlFor="all-priority">Priority</label>
          <select
            id="all-priority"
            className="h-8 rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] px-2 text-[12px]"
            defaultValue=""
            onChange={(e) => {
              const value = Number(e.target.value) as Priority
              if (value >= 1 && value <= 4) apply(ids, { priority: value }, `Priority set to ${PRIORITIES[value].label}`)
              e.target.value = ''
            }}
          >
            <option value="" disabled>
              Priority
            </option>
            {([4, 3, 2, 1] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITIES[p].label}
              </option>
            ))}
          </select>
          {visibleProjects.length > 0 && (
            <>
              <label className="sr-only" htmlFor="all-project">Move to project</label>
              <select
                id="all-project"
                className="h-8 max-w-[10rem] rounded-lg border border-[var(--tf-border)] bg-[var(--tf-surface)] px-2 text-[12px]"
                defaultValue=""
                onChange={(e) => {
                  const projectId = e.target.value
                  if (projectId) apply(ids, { projectId }, 'Moved to project')
                  e.target.value = ''
                }}
              >
                <option value="" disabled>
                  Project
                </option>
                {visibleProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              for (const id of ids) parkTask(id)
              setSelected(new Set())
            }}
          >
            Someday
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon="listChecks"
          title={dirty ? 'No matching tasks' : 'No tasks yet'}
          description={dirty ? 'Widen the filter, or capture a new task.' : 'Create your first task, or load sample data from Settings.'}
          action={<AddTaskRow placeholder="Add a task…" />}
        />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="space-y-1">
            {g.label && (
              <h3 className="px-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">{g.label}</h3>
            )}
            <div className="overflow-hidden rounded-[1.25rem] border border-[var(--tf-border)] bg-[var(--tf-surface)]">
              {g.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-1 border-b border-[var(--tf-border)] last:border-b-0">
                  <input
                    type="checkbox"
                    className="ml-3 h-4 w-4 shrink-0"
                    checked={selected.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    aria-label={`Select ${task.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <TaskItem
                      task={task}
                      project={task.projectId ? projects.find((p) => p.id === task.projectId) : undefined}
                      goal={goalForTask(goals, task.id)}
                      onToggle={() => toggleComplete(task.id)}
                      onOpen={() => openTask(task.id)}
                      onToggleImportant={() => toggleImportant(task.id)}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
