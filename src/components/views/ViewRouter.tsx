import { useMemo } from 'react'
import { Trash } from 'lucide-react'
import type { Task } from '@/lib/types'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { SimpleListView } from '@/components/tasks/SimpleListView'
import { GroupedTaskListView } from '@/components/tasks/GroupedTaskListView'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { CalendarView } from '@/components/calendar/CalendarView'
import { GoalsView } from '@/components/views/GoalsView'
import { RoutinesView } from '@/components/views/RoutinesView'
import { SettingsView } from '@/components/settings/SettingsView'
import { EmptyState } from '@/components/ui/states'
import { groupByDay, groupByProjectSection, type TaskGroup } from '@/lib/viewTasks'
import { todayLocalKey, toDayKey, yesterdayKey, pretty } from '@/lib/dateFmt'
import { ProjectHeader, SectionTitle, TaskMiniList, SectionAdder } from '@/components/tasks/projectBlocks'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TodayView } from '@/components/tasks/TodayView'
import { Icon } from '@/components/ui/Icon'

export function ViewRouter() {
  const route = useUIStore((s) => s.route)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const project = useMemo(() => projects.find((p) => p.id === route.projectId), [projects, route.projectId])

  let content: React.ReactNode

  switch (route.view) {
    case 'dashboard':
      content = <DashboardView />
      break
    case 'calendar':
      content = <CalendarView />
      break
    case 'goals':
      content = <GoalsView />
      break
    case 'routines':
      content = <RoutinesView />
      break
    case 'settings':
      content = <SettingsView />
      break
    case 'inbox':
      content = (
        <SimpleListView
          mode="inbox"
          emptyTitle="Inbox is clear"
          emptyDescription="Tasks without a project land here. Add one to get going."
          emptyIcon="inbox"
        />
      )
      break
    case 'today':
      content = <TodayView />
      break
    case 'upcoming':
      content = (
        <SimpleListView
          mode="upcoming"
          groupBy="day"
          emptyTitle="Nothing upcoming"
          emptyDescription="Tasks with a future due date will show here."
          emptyIcon="calendarClock"
        />
      )
      break
    case 'important':
      content = (
        <SimpleListView
          mode="important"
          emptyTitle="No important tasks"
          emptyDescription="Star the tasks that matter most and they'll show up here."
          emptyIcon="star"
        />
      )
      break
    case 'overdue':
      content = (
        <SimpleListView
          mode="overdue"
          groupBy="day"
          emptyTitle="Nothing overdue"
          emptyDescription="You're on top of everything. Nice work."
          emptyIcon="checkCheck"
        />
      )
      break
    case 'completed':
      content = <CompletedTasks />
      break
    case 'archived':
      content = <ArchivedTasks />
      break
    case 'all':
    default:
      if (project) {
        content = <ProjectDetail key={project.id} projectId={project.id} />
      } else {
        content = (
          <SimpleListView
            mode="all"
            groupBy="project"
            emptyTitle="No tasks yet"
            emptyDescription="Create your first task, or load sample data from Settings."
            emptyIcon="listChecks"
          />
        )
      }
  }

  return <div className="page-wrap">{content}</div>
}

function ProjectDetail({ projectId }: { projectId: string }) {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const addSection = useStore((s) => s.addSection)
  const openProjectSettings = useUIStore((s) => s.openProjectSettings)
  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])

  const open = useMemo(
    () => tasks.filter((t) => !t.archived && !t.completed && t.projectId === projectId),
    [tasks, projectId]
  )
  const done = useMemo(
    () => tasks.filter((t) => !t.archived && t.completed && t.projectId === projectId),
    [tasks, projectId]
  )

  const sections = project?.sections ?? []
  const groups: TaskGroup[] = useMemo(() => {
    if (!sections.length) {
      return [{ key: '__single', label: '', date: null, projectId, section: null, tasks: open }]
    }
    const out: TaskGroup[] = []
    const general = open.filter((t) => !t.section)
    if (general.length)
      out.push({ key: '__general', label: 'General', date: null, projectId, section: null, tasks: general })
    for (const s of sections) {
      const arr = open.filter((t) => t.section === s)
      if (arr.length) out.push({ key: s, label: s, date: null, projectId, section: s, tasks: arr })
    }
    return out
  }, [open, sections, projectId])

  if (!project) return null
  const color = project.color

  return (
    <div className="space-y-5">
      <div>
        <ProjectHeader project={project} done={done.length} total={open.length + done.length} />
        <div className="mt-2 flex justify-end">
          <button className="btn btn-ghost btn-sm" onClick={() => openProjectSettings(project.id)}>
            <Icon name="settings" size={13} /> Manage project
          </button>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.key} aria-label={g.label || 'Tasks'}>
          {sections.length > 0 && g.label && <SectionTitle title={g.label} color={color} />}
          {g.tasks.length > 0 && <TaskMiniList tasks={g.tasks} />}
          <div className="mt-1.5">
            <AddTaskRow projectId={projectId} section={g.section ?? null} />
          </div>
        </section>
      ))}

      <SectionAdder
        onSubmit={(name) => {
          addSection(projectId, name)
        }}
      />
    </div>
  )
}

function CompletedTasks() {
  const tasks = useStore((s) => s.tasks)
  const today = todayLocalKey()
  const completed = useMemo(
    () => tasks.filter((t) => t.completed && !t.archived).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    [tasks]
  )

  const groups: TaskGroup[] = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of completed) {
      const key = t.completedAt ? toDayKey(t.completedAt) : 'unknown'
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return [...map.entries()].map(([key, ts]) => ({
      key,
      label: key === 'unknown' ? 'Unknown' : key === today ? 'Today' : key === yesterdayKey() ? 'Yesterday' : pretty(key),
      date: key === 'unknown' ? null : key,
      tasks: ts,
    }))
  }, [completed, today])

  return (
    <div className="space-y-2">
      <GroupedTaskListView
        groups={groups}
        canAdd={false}
        emptyIcon="checkCheck"
        empty={{ title: 'No completed tasks', description: 'Tasks you finish will appear here.' }}
      />
    </div>
  )
}

function ArchivedTasks() {
  const tasks = useStore((s) => s.tasks)
  const toggleArchive = useStore((s) => s.toggleArchive)
  const removeTask = useStore((s) => s.removeTask)
  const archived = useMemo(() => tasks.filter((t) => t.archived).sort((a, b) => b.updatedAt - a.updatedAt), [tasks])

  if (archived.length === 0) {
    return (
      <EmptyState
        icon="archive"
        title="No archived tasks"
        description="Archive finished work to keep lists clean. You can restore anytime from here."
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-dashed border-[var(--tf-border-strong)] bg-[var(--tf-surface-2)]/60 px-4 py-3 text-[13px] text-[var(--tf-text-secondary)]">
        <span className="font-semibold text-[var(--tf-text)]">Archived tasks</span> are hidden from every other view. Restore one to bring it back.
      </div>
      <div className="space-y-1.5">
        {archived.map((t) => (
          <div key={t.id} className="card flex items-center gap-3 px-4 py-2.5">
            <span className="flex-1 truncate text-[13.5px] text-[var(--tf-text-muted)]">{t.title}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => toggleArchive(t.id)}>
              Restore
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => removeTask(t.id)} aria-label={`Delete ${t.title}`}>
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
