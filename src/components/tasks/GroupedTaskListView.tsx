import type { Project, Task } from '@/lib/types'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { TaskList } from './TaskList'
import { AddTaskRow } from './AddTaskRow'
import { EmptyState } from '@/components/ui/states'
import { formatDayHeader } from '@/lib/dates'
import type { TaskGroup } from '@/lib/viewTasks'
import { Icon } from '@/components/ui/Icon'

export function GroupedTaskListView({
  groups,
  empty,
  emptyIcon = 'inbox',
  defaultProjectId,
  defaultSection,
  defaultDueDate,
  canAdd = true,
  title,
  onNewTaskInProject,
}: {
  groups: TaskGroup[]
  empty?: { title: string; description?: string }
  emptyIcon?: string
  defaultProjectId?: string | null
  defaultSection?: string | null
  defaultDueDate?: string | null
  canAdd?: boolean
  title?: string
  onNewTaskInProject?: (projectId: string | null, section: string | null) => void
}) {
  const { moveTask } = useStore()
  const openNewTask = useUIStore((s) => s.openNewTask)

  const total = groups.reduce((n, g) => n + g.tasks.length, 0)
  const emptyState = empty ?? { title: 'Nothing here yet', description: 'Add a task to get started.' }

  const handleReorder = (activeId: string, overId: string) => {
    const flat = groups.flatMap((g) => g.tasks)
    const from = flat.find((t) => t.id === activeId)
    const to = flat.findIndex((t) => t.id === overId)
    if (from && to >= 0) {
      // Move within the same project/view scope using global order on the current pool
      const peers = flat.filter((t) => !t.completed)
      const fromIdx = peers.findIndex((t) => t.id === activeId)
      const toIdx = peers.findIndex((t) => t.id === overId)
      if (fromIdx >= 0 && toIdx >= 0) moveTaskInScope(peers, fromIdx, toIdx)
    }
  }

  const moveTaskInScope = (peers: Task[], from: number, to: number) => {
    const [moved] = peers.splice(from, 1)
    peers.splice(to, 0, moved)
    peers.forEach((t, i) => {
      if (t.sortOrder !== i) moveTask(t.id, i)
    })
  }

  if (total === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyState.title}
        description={emptyState.description}
        action={
          canAdd ? (
            <AddTaskRow
              projectId={defaultProjectId ?? null}
              section={defaultSection ?? null}
              defaultDueDate={defaultDueDate}
              onCreated={() => onNewTaskInProject?.(defaultProjectId ?? null, defaultSection ?? null)}
            />
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.label || 'Tasks'}>
          <GroupHeader group={g} />
          <div className="card overflow-hidden">
            <TaskList
              tasks={g.tasks}
              onReorder={handleReorder}
              hideProject={!g.label && !!g.projectId ? false : true}
              compact={g.key.startsWith('no-date')}
            />
          </div>
          {canAdd && (
            <AddTaskRow
              projectId={g.projectId ?? defaultProjectId ?? null}
              section={g.section ?? defaultSection ?? null}
              defaultDueDate={g.date ?? defaultDueDate}
              placeholder="Add a task…"
              onCreated={() => onNewTaskInProject?.(g.projectId ?? null, g.section ?? null)}
            />
          )}
        </section>
      ))}
    </div>
  )
}

function GroupHeader({ group }: { group: TaskGroup }) {
  const projects = useStore((s) => s.projects)
  const project = group.projectId ? projects.find((p) => p.id === group.projectId) : undefined

  const heading = group.label
    ? group.label
    : group.date
    ? formatDayHeader(group.date)
    : project
    ? project.name
    : 'Tasks'

  return (
    <div className="mb-1.5 flex items-center gap-2 px-1">
      {project && group.projectId && !group.label && (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-md"
          style={{ background: project.color + '22', color: project.color }}
        >
          <Icon name={project.icon} size={12} />
        </span>
      )}
      {project && group.label && (
        <span className="h-2 w-2 rounded-full" style={{ background: project.color }} />
      )}
      <h2 className="display text-[15px] font-semibold leading-none text-[var(--tf-text)]">{heading}</h2>
      <span className="text-[11px] font-medium leading-none text-[var(--tf-text-faint)]">
        {group.tasks.length}
      </span>
      <span className="ml-auto" />
    </div>
  )
}
