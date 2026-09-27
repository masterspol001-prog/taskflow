import { useMemo } from 'react'
import { Search, Plus, Menu, Sparkles } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { VIEW_META } from '@/lib/constants'
import { format } from 'date-fns'
import { Icon } from '@/components/ui/Icon'
import { todayISO } from '@/lib/dates'
import { isPro } from '@/lib/pro'

export function Header({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const route = useUIStore((s) => s.route)
  const navigate = useUIStore((s) => s.navigate)
  const openNewTask = useUIStore((s) => s.openNewTask)
  const setQuickAdd = useUIStore((s) => s.setQuickAdd)
  const setSearch = useUIStore((s) => s.setSearch)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const settings = useStore((s) => s.settings)
  const setAi = useUIStore((s) => s.setAi)
  const setPaywall = useUIStore((s) => s.setPaywall)

  const project = route.projectId ? projects.find((p) => p.id === route.projectId) : undefined
  const title = project?.name ?? VIEW_META[route.view]?.label ?? 'Tasks'

  const overdueCount = useMemo(
    () =>
      tasks.filter((t) => !t.archived && !t.completed && t.dueDate && t.dueDate < todayISO()).length,
    [tasks]
  )

  return (
    <header className="sticky top-0 z-20 flex h-[4.25rem] items-center gap-2 border-b border-[var(--tf-border)] bg-[var(--tf-glass)] px-4 backdrop-blur-xl sm:px-6">
      <button className="icon-btn lg:hidden" onClick={onOpenSidebar} aria-label="Open navigation">
        <Menu size={20} />
      </button>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="display truncate text-[20px] font-semibold tracking-tight text-[var(--tf-text)]">{title}</h1>
          {route.view === 'all' && project && (
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: project.color }} aria-hidden="true" />
          )}
        </div>
        <p className="hidden truncate text-xs text-[var(--tf-text-muted)] sm:block">
          {format(new Date(), 'EEEE, MMMM d')}
        </p>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => setSearch(true)}
        className="hidden items-center gap-2 rounded-full border border-[var(--tf-border)] bg-[var(--tf-surface)] py-2 pl-3.5 pr-2 text-[13px] text-[var(--tf-text-faint)] shadow-sm transition-all hover:border-[var(--tf-border-strong)] hover:text-[var(--tf-text-muted)] md:flex md:w-64 lg:w-80"
        aria-label="Search tasks"
      >
        <Search size={14} />
        <span className="flex-1 text-left">Search tasks…</span>
        <kbd className="rounded border border-[var(--tf-border)] bg-[var(--tf-surface-2)] px-1 font-mono text-[10px]">/</kbd>
      </button>
      <button className="icon-btn md:hidden" onClick={() => setSearch(true)} aria-label="Search tasks">
        <Search size={19} />
      </button>

      {overdueCount > 0 && route.view !== 'overdue' && route.view !== 'today' && (
        <button
          onClick={() => navigate('overdue')}
          className="hidden items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20 sm:flex"
          aria-label={`${overdueCount} ${overdueCount === 1 ? 'task needs' : 'tasks need'} your attention`}
          title={`${overdueCount} ${overdueCount === 1 ? 'task needs' : 'tasks need'} your attention`}
        >
          <Icon name="alertTriangle" size={13} /> {overdueCount}
        </button>
      )}

      <button
        onClick={() => (isPro(settings) ? setAi(true) : setPaywall(true))}
        className="hidden items-center gap-1.5 rounded-full border border-[var(--tf-accent)]/25 bg-[var(--tf-accent)]/10 px-3.5 py-1.5 text-[13px] font-semibold text-[var(--tf-accent-text)] transition-all hover:bg-[var(--tf-accent)]/18 md:flex"
        aria-label="AI day planner"
      >
        <Sparkles size={15} /> Ask AI
      </button>

      <button
        className="btn btn-primary btn-sm hidden sm:inline-flex"
        onClick={() => setQuickAdd(true)}
      >
        <Plus size={15} />
        <kbd className="rounded bg-white/20 px-1 font-sans text-[10px]">⌘K</kbd>
      </button>
      <button className="icon-btn h-9 w-9 rounded-lg bg-[var(--tf-accent)] text-white shadow-sm sm:hidden" onClick={() => openNewTask()} aria-label="Add task">
        <Plus size={20} />
      </button>
    </header>
  )
}

export function BottomNav() {
  const route = useUIStore((s) => s.route)
  const navigate = useUIStore((s) => s.navigate)
  const openNewTask = useUIStore((s) => s.openNewTask)
  const items = [
    { id: 'dashboard', icon: 'layoutDashboard' },
    { id: 'today', icon: 'sun' },
    { id: 'all', icon: 'listChecks' },
    { id: 'calendar', icon: 'calendarDays' },
  ] as const

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[var(--tf-border)] bg-[var(--tf-glass)] pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Primary">
      {items.slice(0, 2).map((it) => (
        <BottomItem key={it.id} id={it.id} icon={it.icon} label={VIEW_META[it.id].label} active={route.view === it.id} onClick={() => navigate(it.id)} />
      ))}
      <button
        onClick={() => openNewTask()}
        className="-mt-6 flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-[var(--tf-accent-light)] to-[var(--tf-accent-deep)] text-white glow-lg ring-4 ring-[var(--tf-canvas)] transition-transform active:scale-95"
        aria-label="Add task"
      >
        <Plus size={26} />
      </button>
      {items.slice(2).map((it) => (
        <BottomItem key={it.id} id={it.id} icon={it.icon} label={VIEW_META[it.id].label} active={route.view === it.id} onClick={() => navigate(it.id)} />
      ))}
    </nav>
  )
}

function BottomItem({ id, icon, label, active, onClick }: { id: string; icon: string; label: string; active: boolean; onClick: () => void }) {
  const IconCmp = ({ size }: { size?: number }) => <Icon name={icon} size={size ?? 20} />;
  void IconCmp
  return (
    <button onClick={onClick} aria-label={label} aria-current={active ? 'page' : undefined} className="flex w-16 flex-col items-center gap-0.5 py-2">
      <Icon name={icon} size={20} strokeWidth={active ? 2.2 : 1.7} className={active ? 'text-[var(--tf-accent-text)]' : 'text-[var(--tf-text-muted)]'} />
      <span className={`text-[10px] font-medium ${active ? 'text-[var(--tf-accent-text)]' : 'text-[var(--tf-text-faint)]'}`}>{label}</span>
    </button>
  )
}
