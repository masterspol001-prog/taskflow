import { useMemo, useState } from 'react'
import { Plus, ChevronDown, ChevronRight, Archive, Settings } from 'lucide-react'
import type { Project, ViewId } from '@/lib/types'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { Icon } from '@/components/ui/Icon'

interface NavItem {
  id: ViewId
  label: string
  icon: string
  badge?: number
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const route = useUIStore((s) => s.route)
  const navigate = useUIStore((s) => s.navigate)
  const openNewTask = useUIStore((s) => s.openNewTask)
  const openNewProject = useUIStore((s) => s.openNewProject)
  const [showArchived, setShowArchived] = useState(false)

  const counts = useMemo(() => {
    const active = tasks.filter((t) => !t.archived)
    return {
      inbox: active.filter((t) => !t.projectId && !t.completed).length,
      today: active.filter((t) => !t.completed && t.dueDate === todayLocal()).length,
      upcoming: active.filter((t) => !t.completed && t.dueDate && t.dueDate > todayLocal()).length,
      important: active.filter((t) => t.important && !t.completed).length,
      completed: active.filter((t) => t.completed).length,
    }
  }, [tasks])

  const main: NavItem[] = [
    { id: 'inbox', label: 'Inbox', icon: 'inbox', badge: counts.inbox },
    { id: 'today', label: 'Today', icon: 'sun', badge: counts.today },
    { id: 'upcoming', label: 'Upcoming', icon: 'calendarClock', badge: counts.upcoming },
    { id: 'important', label: 'Important', icon: 'star', badge: counts.important },
  ]

  const views: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layoutDashboard' },
    { id: 'all', label: 'All tasks', icon: 'listChecks' },
    { id: 'overdue', label: 'Overdue', icon: 'alertTriangle' },
    { id: 'calendar', label: 'Calendar', icon: 'calendarDays' },
    { id: 'goals', label: 'Goals', icon: 'flag' },
    { id: 'routines', label: 'Routines', icon: 'repeat' },
    { id: 'completed', label: 'Completed', icon: 'checkCheck', badge: counts.completed },
    { id: 'archived', label: 'Archived', icon: 'archive' },
  ]

  const visibleProjects = projects.filter((p) => !p.archived)
  const archivedProjects = projects.filter((p) => p.archived)

  const isActive = (view: ViewId, projectId?: string) =>
    route.view === view && (!projectId || route.projectId === projectId)

  const go = (view: ViewId, projectId?: string) => {
    navigate(view, { projectId })
    onNavigate?.()
  }

  return (
    <nav className="flex h-full flex-col" aria-label="Main">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--tf-accent-light)] to-[var(--tf-accent-deep)] text-white glow-lg">
          <Icon name="check" size={18} strokeWidth={3} />
        </div>
        <div className="min-w-0">
          <div className="display text-[18px] font-semibold tracking-tight text-[var(--tf-text)]">TaskFlow</div>
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-faint)]">Organize · Focus · Finish</div>
        </div>
      </div>

      {/* Add task */}
      <div className="px-4 pb-4">
        <button className="btn btn-primary w-full justify-center gap-2" onClick={() => openNewTask()}>
          <Plus size={16} /> New task
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <SectionLabel>Main</SectionLabel>
        {main.map((item) => (
          <SidebarRow key={item.id} {...item} active={isActive(item.id)} onClick={() => go(item.id)} />
        ))}

        <SectionLabel>Views</SectionLabel>
        {views.map((item) => (
          <SidebarRow key={item.id} {...item} active={isActive(item.id)} onClick={() => go(item.id)} />
        ))}

        <div className="flex items-center px-3 pb-1 pt-5">
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--tf-text-faint)]">Projects</span>
          <button
            className="icon-btn h-6 w-6"
            aria-label="New project"
            onClick={() => openNewProject()}
          >
            <Plus size={14} />
          </button>
        </div>

        {visibleProjects.length === 0 && (
          <p className="px-3 py-1.5 text-xs text-[var(--tf-text-faint)]">
            Create projects to group related tasks.
          </p>
        )}
        {visibleProjects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            count={tasks.filter((t) => t.projectId === p.id && !t.archived && !t.completed).length}
            active={route.view === 'all' && route.projectId === p.id}
            onClick={() => go('all', p.id)}
          />
        ))}

        {archivedProjects.length > 0 && (
          <button
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[var(--tf-text-muted)] hover:bg-[var(--tf-hover)]"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Archive size={13} />
            Archived projects
          </button>
        )}
        {showArchived &&
          archivedProjects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              count={tasks.filter((t) => t.projectId === p.id && !t.archived && !t.completed).length}
              active={route.view === 'all' && route.projectId === p.id}
              onClick={() => go('all', p.id)}
            />
          ))}
      </div>

      {/* Bottom of sidebar */}
      <div className="border-t border-[var(--tf-border)] px-3 py-3">
        <button
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[13px] font-medium text-[var(--tf-text-secondary)] transition-colors hover:bg-[var(--tf-hover)]"
          onClick={() => go('settings')}
        >
          <Settings size={16} className="text-[var(--tf-text-muted)]" />
          <span className="flex-1 text-left">Settings</span>
        </button>
      </div>
    </nav>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--tf-text-faint)] first:pt-2">
      {children}
    </div>
  )
}

function todayLocal(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function SidebarRow({
  id,
  label,
  icon,
  badge,
  active,
  onClick,
}: NavItem & { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex w-full items-center gap-2.5 rounded-xl px-3 py-[8px] text-[13.5px] font-medium transition-all ${
        active
          ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)] shadow-[inset_3px_0_0_0_var(--tf-accent)]'
          : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]'
      }`}
    >
      <Icon
        name={icon}
        size={17}
        strokeWidth={active ? 2.1 : 1.7}
        className={active ? 'text-[var(--tf-accent-text)]' : 'text-[var(--tf-text-muted)] group-hover:text-[var(--tf-text-secondary)]'}
      />
      <span className="flex-1 truncate text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ${
            active ? 'bg-[var(--tf-accent)]/15 text-[var(--tf-accent-text)]' : 'bg-[var(--tf-surface-3)] text-[var(--tf-text-muted)]'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function ProjectRow({
  project,
  count,
  active,
  onClick,
}: {
  project: Project
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-[8px] text-[13.5px] font-medium transition-all ${
        active
          ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)] shadow-[inset_3px_0_0_0_var(--tf-accent)]'
          : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]'
      }`}
    >
      <span className="relative flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-md" style={{ background: project.color + '22' }}>
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: project.color }} />
      </span>
      <span className="flex-1 truncate text-left">{project.name}</span>
      {count > 0 && (
        <span className={`text-[11px] font-semibold tabular-nums ${active ? 'text-[var(--tf-accent-text)]' : 'text-[var(--tf-text-faint)]'}`}>
          {count}
        </span>
      )}
    </button>
  )
}
