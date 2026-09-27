import { useMemo } from 'react'
import type { Task } from '@/lib/types'
import { useStore } from '@/store/useStore'
import { todayISO } from '@/lib/dates'
import { groupByDay, groupByProjectSection, type TaskGroup } from '@/lib/viewTasks'
import { GroupedTaskListView } from './GroupedTaskListView'

interface ListViewProps {
  mode: 'inbox' | 'today' | 'upcoming' | 'completed' | 'important' | 'overdue' | 'all'
  projectId?: string | null
  section?: string | null
  groupBy?: 'day' | 'project' | 'none'
  emptyTitle: string
  emptyDescription?: string
  emptyIcon: string
}

export function SimpleListView({
  mode,
  projectId,
  section,
  groupBy = 'none',
  emptyTitle,
  emptyDescription,
  emptyIcon,
}: ListViewProps) {
  const tasks = useStore((s) => s.tasks)
  const today = todayISO()

  const list = useMemo(() => {
    const active = tasks.filter((t) => !t.archived)
    let out: Task[]
    switch (mode) {
      case 'inbox':
        out = active.filter((t) => !t.projectId && !t.completed)
        break
      case 'today':
        out = active.filter((t) => !t.completed && t.dueDate && t.dueDate <= today)
        break
      case 'upcoming':
        out = active.filter((t) => !t.completed && t.dueDate && t.dueDate > today)
        break
      case 'completed':
        out = tasks.filter((t) => t.completed && !t.archived)
        break
      case 'important':
        out = active.filter((t) => t.important && !t.completed)
        break
      case 'overdue':
        out = active.filter((t) => !t.completed && t.dueDate && t.dueDate < today)
        break
      case 'all':
      default:
        out = active.filter((t) => {
          if (t.completed) return false
          if (projectId) return t.projectId === projectId
          return true
        })
        if (section) out = out.filter((t) => t.section === section)
    }
    return out
  }, [tasks, mode, projectId, section, today])

  const groups: TaskGroup[] = useMemo(() => {
    if (groupBy === 'day') return groupByDay(list)
    if (groupBy === 'project') return groupByProjectSection(list)
    if (mode === 'all' && projectId) {
      // group by section
      const map = new Map<string, Task[]>()
      for (const t of list) {
        const key = t.section ?? ''
        const arr = map.get(key) ?? []
        arr.push(t)
        map.set(key, arr)
      }
      return [...map.entries()].map(([key, ts]) => ({
        key: key || 'general',
        label: key || '',
        date: null,
        projectId,
        section: key || null,
        tasks: [...ts].sort((a, b) => a.sortOrder - b.sortOrder),
      }))
    }
    return [{ key: 'main', label: '', date: null, projectId: projectId ?? null, section: section ?? null, tasks: list }]
  }, [list, groupBy, mode, projectId, section])

  return (
    <GroupedTaskListView
      groups={groups}
      emptyIcon={emptyIcon}
      empty={{ title: emptyTitle, description: emptyDescription }}
      defaultProjectId={projectId}
      defaultSection={section}
    />
  )
}
