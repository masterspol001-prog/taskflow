import { useMemo, useState } from 'react'
import { Trash } from 'lucide-react'
import type { Task } from '@/lib/types'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { SimpleListView } from '@/components/tasks/SimpleListView'
import { GroupedTaskListView } from '@/components/tasks/GroupedTaskListView'
import { DashboardView } from '@/components/dashboard/DashboardView'
import { AnalyticsView } from '@/components/analytics/AnalyticsView'
import { CalendarView } from '@/components/calendar/CalendarView'
import { GoalsView } from '@/components/views/GoalsView'
import { RoutinesView } from '@/components/views/RoutinesView'
import { SettingsView } from '@/components/settings/SettingsView'
import { RewardsView } from '@/components/rewards/RewardsView'
import { WaitingView } from '@/components/views/WaitingView'
import { EmptyState } from '@/components/ui/states'
import type { TaskGroup } from '@/lib/viewTasks'
import { todayLocalKey, toDayKey, yesterdayKey, pretty } from '@/lib/dateFmt'
import { ProjectHeader, SectionTitle, TaskMiniList, SectionAdder } from '@/components/tasks/projectBlocks'
import { AddTaskRow } from '@/components/tasks/AddTaskRow'
import { TodayView } from '@/components/tasks/TodayView'
import { InboxView } from '@/components/views/InboxView'
import { PlanView } from '@/components/views/PlanView'
import { ReviewView } from '@/components/views/ReviewView'
import { NotesView } from '@/components/views/NotesView'
import { TemplatesView } from '@/components/views/TemplatesView'
import { RiskView } from '@/components/views/RiskView'
import { ProjectsHub } from '@/components/views/ProjectsHub'
import { TimelineView } from '@/components/views/TimelineView'
import { AllTasksView } from '@/components/views/AllTasksView'
import { SomedayView } from '@/components/views/SomedayView'
import { BoardView } from '@/components/views/BoardView'
import { UpcomingView } from '@/components/views/UpcomingView'
import { KanbanBoard } from '@/components/tasks/KanbanBoard'
import { Icon } from '@/components/ui/Icon'
import { buildRiskRadar } from '@/lib/workspace'

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
    case 'analytics':
      content = <AnalyticsView />
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
    case 'rewards':
      content = <RewardsView />
      break
    case 'inbox':
      content = <InboxView />
      break
    case 'today':
      content = <TodayView />
      break
    case 'plan':
      content = <PlanView />
      break
    case 'review':
      content = <ReviewView />
      break
    case 'notes':
      content = <NotesView />
      break
    case 'templates':
      content = <TemplatesView />
      break
    case 'risk':
      content = <RiskView />
      break
    case 'projects':
      content = <ProjectsHub />
      break
    case 'timeline':
      content = <TimelineView />
      break
    case 'someday':
      content = <SomedayView />
      break
    case 'board':
      content = <BoardView />
      break
    case 'upcoming':
      content = <UpcomingView />
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
    case 'waiting':
      content = <WaitingView />
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
        content = <AllTasksView />
      }
  }

  return <div className="page-wrap min-w-0">{content}</div>
}

function ProjectDetail({ projectId }: { projectId: string }) {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const notes = useStore((s) => s.notes)
  const goals = useStore((s) => s.goals)
  const addSection = useStore((s) => s.addSection)
  const duplicateProject = useStore((s) => s.duplicateProject)
  const addNote = useStore((s) => s.addNote)
  const updateNote = useStore((s) => s.updateNote)
  const openProjectSettings = useUIStore((s) => s.openProjectSettings)
  const openTask = useUIStore((s) => s.openTask)
  const [board, setBoard] = useState<'list' | 'board' | 'notes' | 'risk'>('list')
  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])
  const projectNotes = useMemo(
    () => notes.filter((n) => n.projectId === projectId).sort((a, b) => b.updatedAt - a.updatedAt),
    [notes, projectId]
  )
  const projectRisks = useMemo(
    () => buildRiskRadar(tasks, projects, goals).filter((item) => item.projectId === projectId),
    [tasks, projects, goals, projectId]
  )

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
    out.push({ key: '__general', label: 'General', date: null, projectId, section: null, tasks: general })
    for (const s of sections) {
      const arr = open.filter((t) => t.section === s)
      out.push({ key: s, label: s, date: null, projectId, section: s, tasks: arr })
    }
    return out
  }, [open, sections, projectId])

  if (!project) return null
  const color = project.color

  return (
    <div className="space-y-5">
      <div>
        <ProjectHeader project={project} done={done.length} total={open.length + done.length} />
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button className={`btn btn-sm ${board === 'list' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setBoard('list')}>
            List
          </button>
          <button className={`btn btn-sm ${board === 'board' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setBoard('board')}>
            Board
          </button>
          <button className={`btn btn-sm ${board === 'notes' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setBoard('notes')}>
            Notes
          </button>
          <button className={`btn btn-sm ${board === 'risk' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setBoard('risk')}>
            Risk
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => duplicateProject(project.id)}>
            Duplicate
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => openProjectSettings(project.id)}>
            <Icon name="settings" size={13} /> Manage project
          </button>
        </div>
      </div>

      {board === 'board' && <KanbanBoard projectId={projectId} />}

      {board === 'notes' && (
        <div className="space-y-2">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => addNote({ title: 'Untitled note', projectId })}
          >
            New note
          </button>
          {projectNotes.length === 0 ? (
            <p className="text-[13px] text-[var(--tf-text-muted)]">No notes on this project yet. They stay on this device.</p>
          ) : (
            projectNotes.map((n) => (
              <div key={n.id} className="card space-y-2 p-3">
                <input
                  className="input text-[14px] font-semibold"
                  value={n.title}
                  onChange={(e) => updateNote(n.id, { title: e.target.value })}
                  aria-label="Note title"
                />
                <textarea
                  className="input min-h-[6rem]"
                  value={n.body}
                  onChange={(e) => updateNote(n.id, { body: e.target.value })}
                  aria-label="Note body"
                />
              </div>
            ))
          )}
        </div>
      )}

      {board === 'risk' && (
        <div className="space-y-2">
          {projectRisks.length === 0 ? (
            <p className="text-[13px] text-[var(--tf-text-muted)]">No calculated risks on this project.</p>
          ) : (
            projectRisks.map((item) => (
              <div key={item.id} className="card flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-[var(--tf-text)]">{item.title}</p>
                  <p className="text-[12px] text-[var(--tf-text-muted)]">{item.why} · {item.next}</p>
                </div>
                {item.taskId && (
                  <button className="btn btn-secondary btn-sm" onClick={() => openTask(item.taskId!)}>Open</button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {board === 'list' && (
        <>
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label || 'Tasks'}>
              {sections.length > 0 && g.label && <SectionTitle title={g.label} color={color} />}
              {g.tasks.length > 0 && <TaskMiniList tasks={g.tasks} />}
              <div className="mt-1.5">
                <AddTaskRow projectId={projectId} section={g.section ?? null} />
              </div>
            </section>
          ))}
          <SectionAdder onSubmit={(name) => addSection(projectId, name)} />
        </>
      )}
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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
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
            {pendingDelete === t.id ? (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  removeTask(t.id)
                  setPendingDelete(null)
                }}
              >
                Confirm
              </button>
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setPendingDelete(t.id)} aria-label={`Delete ${t.title}`}>
                <Trash size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
