import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Link2,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import type {
  Goal,
  GoalCategory,
  GoalHorizon,
  GoalProgressType,
  GoalStatus,
  Project,
  Task,
} from '@/lib/types'
import { EmptyState } from '@/components/ui/states'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { isPro } from '@/lib/pro'
import { ProPrompt } from '@/components/paywall/ProPrompt'
import { uid } from '@/lib/dates'
import {
  GOAL_CATEGORIES,
  GOAL_TEMPLATES,
  HORIZONS,
  PROGRESS_TYPES,
  buildGoalReview,
  categoryMeta,
  computeGoalAnalytics,
  computeGoalStats,
  defaultTargetDate,
  filterAndSortGoals,
  goalChildren,
  goalHealthInfo,
  goalLinkedTasks,
  goalProgress,
  horizonMeta,
  horizonRollups,
  nextOpenLinkedTask,
  nextOpenMilestone,
  milestonesNeedingTasks,
  suggestGoalPlan,
  type GoalHealthInfo,
  type GoalSort,
  type GoalTemplate,
} from '@/lib/goals'

const COLORS = ['#8e5cf7', '#3b82f6', '#2f9e6e', '#0d9488', '#f97316', '#e5484d', '#d9a514']

interface GoalFormState {
  title: string
  horizon: GoalHorizon
  targetDate: string
  category: GoalCategory
  why: string
  metric: string
  progressType: GoalProgressType
  targetValue: string
  currentValue: string
  unit: string
  parentId: string | null
  color: string
  projectIds: string[]
  taskIds: string[]
  milestones: string[]
}

function emptyForm(horizon: GoalHorizon = 'month'): GoalFormState {
  return {
    title: '',
    horizon,
    targetDate: defaultTargetDate(horizon),
    category: 'personal',
    why: '',
    metric: '',
    progressType: 'task',
    targetValue: '',
    currentValue: '',
    unit: '',
    parentId: null,
    color: COLORS[0],
    projectIds: [],
    taskIds: [],
    milestones: [],
  }
}

export function GoalsView() {
  const goals = useStore((s) => s.goals)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const settings = useStore((s) => s.settings)
  const addGoal = useStore((s) => s.addGoal)
  const updateGoal = useStore((s) => s.updateGoal)

  const goalCreateOpen = useUIStore((s) => s.goalCreateOpen)
  const setGoalCreate = useUIStore((s) => s.setGoalCreate)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<GoalFormState>(() => emptyForm())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [horizonFilter, setHorizonFilter] = useState<GoalHorizon | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<GoalStatus | 'all'>('active')
  const [sort, setSort] = useState<GoalSort>('smart')
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)

  const liveGoals = useMemo(() => goals.filter((g) => g.status !== 'archived'), [goals])
  const stats = useMemo(() => computeGoalStats(goals, tasks), [goals, tasks])
  const rollups = useMemo(() => horizonRollups(goals, tasks), [goals, tasks])

  const filtered = useMemo(
    () =>
      filterAndSortGoals(goals, tasks, {
        query,
        horizon: horizonFilter,
        category: categoryFilter,
        status: statusFilter,
        sort,
      }),
    [goals, tasks, query, horizonFilter, categoryFilter, statusFilter, sort]
  )

  const filterActive =
    query.trim().length > 0 || horizonFilter !== 'all' || categoryFilter !== 'all' || statusFilter !== 'active' || sort !== 'smart'

  useEffect(() => {
    if (!goalCreateOpen) return
    setForm(emptyForm())
    setEditingId(null)
    setAdding(true)
    setGoalCreate(false)
  }, [goalCreateOpen, setGoalCreate])

  if (!isPro(settings)) {
    return <ProPrompt feature="Goals" />
  }

  const setField = <K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const resetForm = () => {
    setForm(emptyForm())
    setAdding(false)
    setEditingId(null)
  }

  const startCreate = (horizon: GoalHorizon = 'month', preset?: Partial<GoalFormState>) => {
    setEditingId(null)
    setForm({ ...emptyForm(horizon), ...preset })
    setAdding(true)
  }

  const startEdit = (g: Goal) => {
    setAdding(false)
    setEditingId(g.id)
    setForm({
      title: g.title,
      horizon: g.horizon ?? 'month',
      targetDate: g.targetDate ?? '',
      category: g.category ?? 'personal',
      why: g.why ?? '',
      metric: g.metric ?? '',
      progressType: g.progressType ?? ((g.milestones ?? []).length ? 'milestone' : 'task'),
      targetValue: g.targetValue != null ? String(g.targetValue) : '',
      currentValue: g.currentValue != null ? String(g.currentValue) : '',
      unit: g.unit ?? '',
      parentId: g.parentId ?? null,
      color: g.color,
      projectIds: [...g.projectIds],
      taskIds: [...(g.taskIds ?? [])],
      milestones: (g.milestones ?? []).map((m) => m.title),
    })
  }

  const buildInput = () => ({
    title: form.title.trim(),
    horizon: form.horizon,
    targetDate: form.targetDate || null,
    category: form.category,
    why: form.why.trim(),
    metric: form.metric.trim(),
    progressType: form.progressType,
    targetValue: form.targetValue ? Number(form.targetValue) : null,
    currentValue: form.currentValue ? Number(form.currentValue) : null,
    unit: form.unit.trim(),
    parentId: form.parentId,
    color: form.color,
    projectIds: form.projectIds,
    taskIds: form.taskIds,
    milestones: form.milestones
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({ id: uid('ms-'), title: t, done: false })),
  })

  const submit = () => {
    if (!form.title.trim()) return
    if (editingId) {
      const input = buildInput()
      updateGoal(editingId, {
        title: input.title,
        horizon: input.horizon,
        targetDate: input.targetDate,
        category: input.category,
        why: input.why,
        metric: input.metric,
        progressType: input.progressType,
        targetValue: input.targetValue,
        currentValue: input.currentValue,
        unit: input.unit,
        parentId: input.parentId,
        color: input.color,
        projectIds: input.projectIds,
        taskIds: input.taskIds,
        milestones: input.milestones,
      })
      useStore.getState().toast({ title: 'Goal updated', kind: 'success' })
    } else {
      const created = addGoal(buildInput())
      if (!created) return
      setExpandedId(created.id)
      useStore.getState().toast({ title: 'Goal created', kind: 'success' })
    }
    resetForm()
  }

  const applyTemplate = (tpl: GoalTemplate) => {
    const goal = addGoal({
      title: tpl.title,
      horizon: tpl.horizon,
      targetDate: defaultTargetDate(tpl.horizon),
      category: tpl.category,
      why: tpl.why,
      metric: tpl.metric,
      progressType: 'milestone',
      milestones: tpl.milestones.map((t) => ({ id: uid('ms-'), title: t, done: false })),
    })
    if (!goal) return
     useStore.getState().addTaskToGoal(goal.id, {
      title: tpl.todayAction,
      dueDate: new Date().toISOString().slice(0, 10),
      important: false,
    })
    useStore.getState().generateMilestoneTasks(goal.id)
    setTemplatesOpen(false)
    setExpandedId(goal.id)
    useStore.getState().toast({ title: 'Goal created', message: 'Milestones became tasks for today.', kind: 'success' })
  }

  const formOpen = adding || !!editingId

  if (goals.length === 0 && !formOpen) {
    return (
      <>
        <EmptyState
          icon="flag"
          title="Where do you want to go?"
          description="Turn what matters to you into achievable steps. Start with a horizon, then let TaskFlow connect it to today's actions."
          action={
            <div className="space-y-2">
              <button className="btn btn-primary w-full" onClick={() => startCreate('1y')}>
                <Plus size={16} /> Create your first goal
              </button>
              <div className="flex gap-2">
                <button className="btn btn-secondary flex-1" onClick={() => setTemplatesOpen(true)}>
                  <Sparkles size={15} /> Templates
                </button>
                <button className="btn btn-secondary flex-1" onClick={() => setPlanOpen(true)}>
                  <Target size={15} /> Build with AI
                </button>
              </div>
            </div>
          }
        />
        <HorizonStarter onPick={startCreate} />
        <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} onPick={applyTemplate} />
        <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} onAccept={() => setPlanOpen(false)} />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Goals</h2>
          <p className="text-sm text-[var(--tf-text-muted)]">What matters, connected to today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setTemplatesOpen(true)}>
            <Sparkles size={14} /> Templates
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPlanOpen(true)}>
            <Target size={14} /> Plan with AI
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => startCreate('month')}>
            <Plus size={15} /> New goal
          </button>
        </div>
      </div>

      <GoalStatsRow stats={stats} />

      <HorizonNav rollups={rollups} active={horizonFilter} onSelect={setHorizonFilter} />

      <GoalReviewPanel goals={goals} tasks={tasks} projects={projects} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search goals…"
            className="input h-9"
            aria-label="Search goals"
          />
          {query && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tf-text-faint)]" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as GoalCategory | 'all')} className="input h-9 w-auto" aria-label="Filter by category">
          <option value="all">All categories</option>
          {GOAL_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as GoalStatus | 'all')} className="input h-9 w-auto" aria-label="Filter by status">
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
          <option value="all">All</option>
          <option value="archived">Archived</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as GoalSort)} className="input h-9 w-auto" aria-label="Sort goals">
          <option value="smart">Smart order</option>
          <option value="deadline">Deadline</option>
          <option value="progress">Progress</option>
          <option value="recent">Recent</option>
        </select>
      </div>

      {formOpen && (
        <GoalForm
          value={form}
          projects={projects.filter((p) => !p.archived)}
          goals={liveGoals}
          editing={!!editingId}
          onChange={setField}
          onToggleProject={(id) =>
            setField('projectIds', form.projectIds.includes(id) ? form.projectIds.filter((x) => x !== id) : [...form.projectIds, id])
          }
          onToggleTask={(id) =>
            setField('taskIds', form.taskIds.includes(id) ? form.taskIds.filter((x) => x !== id) : [...form.taskIds, id])
          }
          onAddMilestone={(title) => setField('milestones', [...form.milestones, title])}
          onRemoveMilestone={(i) => setField('milestones', form.milestones.filter((_, idx) => idx !== i))}
          onCancel={resetForm}
          onSubmit={submit}
        />
      )}

      {filtered.length === 0 ? (
        <div className="card p-6 text-center text-sm text-[var(--tf-text-muted)]">
          {filterActive ? 'No goals match these filters.' : 'No goals here yet — create one above.'}
        </div>
      ) : filterActive ? (
        <div className="space-y-3">
          {filtered.map((g) => (
            <GoalCard key={g.id} goal={g} allGoals={liveGoals} tasks={tasks} projects={projects} editing={editingId === g.id} expanded={expandedId === g.id} onToggleExpand={() => setExpandedId((v) => (v === g.id ? null : g.id))} onEdit={() => startEdit(g)} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {goals
            .filter((g) => (g.status ?? 'active') === 'active' && (!g.parentId || !goals.some((p) => p.id === g.parentId)))
            .map((g) => (
              <GoalTree
                key={g.id}
                goal={g}
                allGoals={liveGoals}
                tasks={tasks}
                projects={projects}
                depth={0}
                editingId={editingId}
                expandedId={expandedId}
                onToggleExpand={(id) => setExpandedId((v) => (v === id ? null : id))}
                onEdit={startEdit}
              />
            ))}
        </div>
      )}

      <TemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} onPick={applyTemplate} />
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} onAccept={() => setPlanOpen(false)} />
    </div>
  )
}

function HorizonStarter({ onPick }: { onPick: (h: GoalHorizon) => void }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {HORIZONS.map((h) => (
        <button key={h.id} className="card card-hover flex flex-col items-start gap-1 p-3 text-left" onClick={() => onPick(h.id)}>
          <Icon name={h.icon} size={16} className="text-[var(--tf-accent-text)]" />
          <span className="text-[12.5px] font-semibold text-[var(--tf-text)]">{h.label}</span>
          <span className="text-[10.5px] text-[var(--tf-text-muted)]">{h.tagline}</span>
        </button>
      ))}
    </div>
  )
}

function GoalStatsRow({
  stats,
}: {
  stats: { active: number; completed: number; atRisk: number; overallPct: number; streak: number }
}) {
  const items = [
    { label: 'Active goals', value: stats.active },
    { label: 'Completed', value: stats.completed },
    { label: 'At risk', value: stats.atRisk, tone: stats.atRisk > 0 ? 'text-red-500' : undefined },
    { label: 'Overall progress', value: `${stats.overallPct}%` },
    { label: 'Current streak', value: `${stats.streak}d` },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="card p-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">{i.label}</p>
          <p className={`mt-1 text-[20px] font-bold leading-none tabular-nums ${i.tone ?? 'text-[var(--tf-text)]'}`}>{i.value}</p>
        </div>
      ))}
    </div>
  )
}

function HorizonNav({
  rollups,
  active,
  onSelect,
}: {
  rollups: ReturnType<typeof horizonRollups>
  active: GoalHorizon | 'all'
  onSelect: (h: GoalHorizon | 'all') => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        className={`shrink-0 rounded-xl border px-3 py-2 text-left ${active === 'all' ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]' : 'border-[var(--tf-border)]'}`}
        onClick={() => onSelect('all')}
      >
        <span className="block text-[12.5px] font-semibold text-[var(--tf-text)]">All horizons</span>
        <span className="block text-[10.5px] text-[var(--tf-text-muted)]">Every goal</span>
      </button>
      {rollups.map((r) => (
        <button
          key={r.horizon}
          className={`shrink-0 rounded-xl border px-3 py-2 text-left ${active === r.horizon ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]' : 'border-[var(--tf-border)]'}`}
          onClick={() => onSelect(r.horizon)}
        >
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--tf-text)]">
            <Icon name={r.meta.icon} size={13} className="text-[var(--tf-accent-text)]" />
            {r.meta.label}
          </span>
          <span className="mt-0.5 block text-[10.5px] text-[var(--tf-text-muted)]">
            {r.count === 0 ? r.meta.tagline : `${r.count} · ${r.pct}%`}
          </span>
          {r.count > 0 && (
            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
              <span className="block h-full rounded-full bg-[var(--tf-accent)]" style={{ width: `${r.pct}%` }} />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function GoalTree({
  goal,
  allGoals,
  tasks,
  projects,
  depth,
  editingId,
  expandedId,
  onToggleExpand,
  onEdit,
}: {
  goal: Goal
  allGoals: Goal[]
  tasks: Task[]
  projects: Project[]
  depth: number
  editingId: string | null
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onEdit: (g: Goal) => void
}) {
  const children = goalChildren(allGoals, goal.id)
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 20 }} className="space-y-3">
      <GoalCard
        goal={goal}
        allGoals={allGoals}
        tasks={tasks}
        projects={projects}
        editing={editingId === goal.id}
        expanded={expandedId === goal.id}
        onToggleExpand={() => onToggleExpand(goal.id)}
        onEdit={() => onEdit(goal)}
      />
      {children.map((c) => (
        <GoalTree
          key={c.id}
          goal={c}
          allGoals={allGoals}
          tasks={tasks}
          projects={projects}
          depth={depth + 1}
          editingId={editingId}
          expandedId={expandedId}
          onToggleExpand={onToggleExpand}
          onEdit={onEdit}
        />
      ))}
    </div>
  )
}

const HEALTH_TONE: Record<GoalHealthInfo['tone'], string> = {
  green: 'bg-emerald-500/12 text-emerald-600',
  amber: 'bg-amber-500/15 text-amber-600',
  red: 'bg-red-500/12 text-red-500',
  blue: 'bg-sky-500/12 text-sky-600',
  gray: 'bg-[var(--tf-surface-3)] text-[var(--tf-text-muted)]',
}

function GoalCard({
  goal,
  allGoals,
  tasks,
  projects,
  editing,
  expanded,
  onToggleExpand,
  onEdit,
}: {
  goal: Goal
  allGoals: Goal[]
  tasks: Task[]
  projects: Project[]
  editing: boolean
  expanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
}) {
  const navigate = useUIStore((s) => s.navigate)
  const openTask = useUIStore((s) => s.openTask)
  const setFocus = useUIStore((s) => s.setFocus)
  const updateGoal = useStore((s) => s.updateGoal)
  const removeGoal = useStore((s) => s.removeGoal)
  const setGoalStatus = useStore((s) => s.setGoalStatus)
  const setGoalValue = useStore((s) => s.setGoalValue)
  const toggleGoalMilestone = useStore((s) => s.toggleGoalMilestone)
  const addTaskToGoal = useStore((s) => s.addTaskToGoal)
  const linkTaskToGoal = useStore((s) => s.linkTaskToGoal)
  const unlinkTaskFromGoal = useStore((s) => s.unlinkTaskFromGoal)
  const generateMilestoneTasks = useStore((s) => s.generateMilestoneTasks)
  const toast = useStore((s) => s.toast)
  const pendingMilestones = milestonesNeedingTasks(goal, tasks)

  const progress = useMemo(() => goalProgress(goal, tasks), [goal, tasks])
  const health = useMemo(() => goalHealthInfo(goal, tasks), [goal, tasks])
  const linkedProjects = projects.filter((p) => goal.projectIds.includes(p.id) && !p.archived)
  const linkedTasks = goalLinkedTasks(goal, tasks)
  const nextTask = useMemo(() => nextOpenLinkedTask(goal, tasks), [goal, tasks])
  const nextMilestone = nextOpenMilestone(goal)
  const parents = useMemo(() => {
    const out: Goal[] = []
    let cur = goal
    const guard = new Set<string>()
    while (cur.parentId && !guard.has(cur.id)) {
      guard.add(cur.id)
      const p = allGoals.find((g) => g.id === cur.parentId)
      if (!p) break
      out.unshift(p)
      cur = p
    }
    return out
  }, [goal, allGoals])

  const [taskDraft, setTaskDraft] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [milestoneDraft, setMilestoneDraft] = useState('')

  const availableTasks = tasks.filter(
    (t) => !t.archived && !t.completed && !(goal.taskIds ?? []).includes(t.id) && !t.projectId
  )

  const status = goal.status ?? 'active'
  const cat = categoryMeta(goal.category)

  return (
    <div className={`card space-y-3 p-4 ${editing ? 'ring-2 ring-[var(--tf-accent)]' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: goal.color + '22', color: goal.color }}>
          {cat ? <Icon name={cat.icon} size={16} /> : <Target size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          {parents.length > 0 && (
            <p className="mb-0.5 flex flex-wrap items-center gap-1 text-[10.5px] text-[var(--tf-text-faint)]">
              {parents.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--tf-surface-2)] px-1.5 py-0.5 font-medium">
                    <Icon name={horizonMeta(p.horizon).icon} size={10} /> {p.title}
                  </span>
                  <ChevronRight size={10} />
                </span>
              ))}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-[15px] font-semibold text-[var(--tf-text)]">{goal.title}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${HEALTH_TONE[health.tone]}`}>{health.label}</span>
            <span className="rounded-full bg-[var(--tf-surface-3)] px-2 py-0.5 text-[10px] font-semibold text-[var(--tf-text-muted)]">
              {horizonMeta(goal.horizon).label}
            </span>
            {cat && <span className="text-[10px] font-medium text-[var(--tf-text-faint)]">{cat.label}</span>}
          </div>
          <p className="mt-0.5 text-xs text-[var(--tf-text-muted)]">
            {progress.label}
            {goal.targetDate
              ? ` · target ${new Date(goal.targetDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
              : ''}
            {health.forecast.velocityPerWeek > 0 ? ` · ${health.forecast.velocityPerWeek}/wk` : ''}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--tf-text-secondary)]">{health.note}</p>
        </div>
        <button className="icon-btn" onClick={onToggleExpand} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${goal.title}`}>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${goal.title}`}>
          <Pencil size={15} />
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress.pct}%`, background: goal.color }} />
      </div>

      {(nextTask || nextMilestone) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--tf-surface-2)] px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">
            {nextTask ? 'Next action' : 'Next milestone'}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--tf-text)]">
            {nextTask ? nextTask.title : nextMilestone?.title}
          </span>
          {nextTask && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => openTask(nextTask.id)}>
                Open
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setFocus(true, nextTask.id)} aria-label={`Start ${nextTask.title}`}>
                <Play size={12} /> Start
              </button>
            </>
          )}
        </div>
      )}

      {expanded && (
        <GoalDetail
          goal={goal}
          progress={progress}
          health={health}
          parents={parents}
          children={goalChildren(allGoals, goal.id)}
          linkedProjects={linkedProjects}
          linkedTasks={linkedTasks}
          availableTasks={availableTasks}
          taskDraft={taskDraft}
          milestoneDraft={milestoneDraft}
          linkOpen={linkOpen}
          onMilestoneDraft={setMilestoneDraft}
          onTaskDraft={setTaskDraft}
          onLinkOpen={setLinkOpen}
          onToggleMilestone={(id) => toggleGoalMilestone(goal.id, id)}
          onGenerateTasks={() => {
            const n = generateMilestoneTasks(goal.id)
            toast({
              title: n ? `${n} task${n === 1 ? '' : 's'} created` : 'Already linked',
              message: n ? 'Each open milestone now has a task.' : 'Every open milestone already has a task.',
              kind: 'success',
            })
          }}
          pendingTaskCount={pendingMilestones.length}
          onAddMilestone={() => {
            const t = milestoneDraft.trim()
            if (!t) return
            updateGoal(goal.id, {
              milestones: [...(goal.milestones ?? []), { id: uid('ms-'), title: t, done: false }],
            })
            setMilestoneDraft('')
          }}
          onRemoveMilestone={(id) =>
            updateGoal(goal.id, { milestones: (goal.milestones ?? []).filter((m) => m.id !== id) })
          }
          onSetValue={(v) => setGoalValue(goal.id, v)}
          onAddTask={() => {
            const t = taskDraft.trim()
            if (!t) return
            const created = addTaskToGoal(goal.id, { title: t, dueDate: new Date().toISOString().slice(0, 10) })
            if (created) {
              setTaskDraft('')
              toast({ title: 'Task added', message: `“${created.title}” now counts toward this goal.`, kind: 'success' })
            }
          }}
          onLinkTask={(taskId) => {
            linkTaskToGoal(goal.id, taskId)
            setLinkOpen(false)
          }}
          onUnlinkTask={(taskId) => unlinkTaskFromGoal(goal.id, taskId)}
          onOpenTask={openTask}
          onNavigateProject={(id) => navigate('all', { projectId: id })}
          onComplete={() => {
            setGoalStatus(goal.id, 'completed')
            toast({ title: 'Goal completed', message: 'Beautiful work — that one is done.', kind: 'success' })
          }}
          onTogglePause={() => setGoalStatus(goal.id, status === 'paused' ? 'active' : 'paused')}
          onArchive={() => setGoalStatus(goal.id, 'archived')}
          onReactivate={() => setGoalStatus(goal.id, 'active')}
          onDelete={() => {
            if (!window.confirm(`Delete goal “${goal.title}”?`)) return
            removeGoal(goal.id)
            toast({ title: 'Goal deleted', kind: 'info' })
          }}
        />
      )}
    </div>
  )
}

function GoalDetail({
  goal,
  progress,
  health,
  parents,
  children,
  linkedProjects,
  linkedTasks,
  availableTasks,
  taskDraft,
  milestoneDraft,
  linkOpen,
  onMilestoneDraft,
  onTaskDraft,
  onLinkOpen,
  onToggleMilestone,
  onAddMilestone,
  onRemoveMilestone,
  onGenerateTasks,
  pendingTaskCount,
  onSetValue,
  onAddTask,
  onLinkTask,
  onUnlinkTask,
  onOpenTask,
  onNavigateProject,
  onComplete,
  onTogglePause,
  onArchive,
  onReactivate,
  onDelete,
}: {
  goal: Goal
  progress: ReturnType<typeof goalProgress>
  health: GoalHealthInfo
  parents: Goal[]
  children: Goal[]
  linkedProjects: Project[]
  linkedTasks: Task[]
  availableTasks: Task[]
  taskDraft: string
  milestoneDraft: string
  linkOpen: boolean
  onMilestoneDraft: (v: string) => void
  onTaskDraft: (v: string) => void
  onLinkOpen: (v: boolean) => void
  onToggleMilestone: (id: string) => void
  onAddMilestone: () => void
  onRemoveMilestone: (id: string) => void
  onGenerateTasks: () => void
  pendingTaskCount: number
  onSetValue: (v: number) => void
  onAddTask: () => void
  onLinkTask: (id: string) => void
  onUnlinkTask: (id: string) => void
  onOpenTask: (id: string) => void
  onNavigateProject: (id: string) => void
  onComplete: () => void
  onTogglePause: () => void
  onArchive: () => void
  onReactivate: () => void
  onDelete: () => void
}) {
  const status = goal.status ?? 'active'
  const isNumeric = progress.source === 'numeric' || progress.source === 'percentage' || progress.source === 'habit'
  const [value, setValue] = useState(String(goal.currentValue ?? ''))
  useEffect(() => setValue(String(goal.currentValue ?? '')), [goal.currentValue, goal.id])

  return (
    <div className="space-y-4 border-t border-[var(--tf-border)] pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <DetailLabel>Why it matters</DetailLabel>
          <p className="text-[13px] leading-relaxed text-[var(--tf-text-secondary)]">{goal.why || 'Add a why to stay motivated.'}</p>
        </div>
        <div className="space-y-1">
          <DetailLabel>Success metric</DetailLabel>
          <p className="text-[13px] leading-relaxed text-[var(--tf-text-secondary)]">{goal.metric || 'Define how you will know it worked.'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-[var(--tf-surface-2)] px-2 py-0.5 font-medium text-[var(--tf-text-muted)]">{health.label} · {health.note}</span>
        <span className="rounded-full bg-[var(--tf-surface-2)] px-2 py-0.5 font-medium text-[var(--tf-text-muted)]">
          {PROGRESS_TYPES.find((p) => p.id === progress.source)?.label}
        </span>
        {health.forecast.etaISO && health.status !== 'completed' && (
          <span className="rounded-full bg-[var(--tf-surface-2)] px-2 py-0.5 font-medium text-[var(--tf-text-muted)]">
            pace ETA {health.forecast.etaISO}
          </span>
        )}
      </div>

      {isNumeric && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <DetailLabel>{progress.source === 'percentage' ? 'Current %' : goal.unit ? `Current (${goal.unit})` : 'Current'}</DetailLabel>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => onSetValue(Number(value) || 0)}
              className="input h-9 w-28"
              aria-label="Update progress value"
            />
          </div>
          {goal.targetValue != null && progress.source !== 'percentage' && (
            <span className="pb-2 text-[12px] text-[var(--tf-text-muted)]">of {goal.targetValue}{goal.unit ? ` ${goal.unit}` : ''}</span>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <DetailLabel>{nextOpenMilestone(goal) ? `Next milestone · ${nextOpenMilestone(goal)!.title}` : 'Milestones'}</DetailLabel>
        {(goal.milestones ?? []).length === 0 && <p className="text-[12.5px] text-[var(--tf-text-faint)]">Break this goal into a few milestones.</p>}
        {(goal.milestones ?? []).map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-[13px] text-[var(--tf-text-secondary)]">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <input type="checkbox" checked={m.done} onChange={() => onToggleMilestone(m.id)} />
              <span className={m.done ? 'text-[var(--tf-text-faint)] line-through' : ''}>{m.title}</span>
              {m.taskId && !m.done && (
                <span className="rounded-full bg-[var(--tf-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tf-accent-text-strong)]">task</span>
              )}
            </label>
            <button className="icon-btn" onClick={() => onRemoveMilestone(m.id)} aria-label={`Remove ${m.title}`}>
              <X size={12} />
            </button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={milestoneDraft}
            onChange={(e) => onMilestoneDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddMilestone()}
            placeholder="Add a milestone"
            className="input h-8 text-[13px]"
            aria-label="New milestone"
          />
          <button className="btn btn-secondary btn-sm" onClick={onAddMilestone}>
            <Plus size={13} />
          </button>
        </div>
        {pendingTaskCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={onGenerateTasks}>
            Turn {pendingTaskCount} milestone{pendingTaskCount === 1 ? '' : 's'} into tasks
          </button>
        )}
      </div>

      {(linkedProjects.length > 0 || linkedTasks.length > 0) && (
        <div className="space-y-1.5">
          <DetailLabel>Linked work</DetailLabel>
          {linkedProjects.map((p) => {
            const pt = linkedTasks.filter((t) => t.projectId === p.id)
            const done = pt.filter((t) => t.completed).length
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onNavigateProject(p.id)}
                className="flex w-full items-center gap-2 rounded-xl border border-[var(--tf-border)] px-2.5 py-2 text-left"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--tf-text)]">{p.name} (project)</span>
                <span className="text-[11px] text-[var(--tf-text-muted)]">{done}/{pt.length}</span>
              </button>
            )
          })}
          {linkedTasks
            .filter((t) => !t.projectId || !goal.projectIds.includes(t.projectId))
            .map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-xl border border-[var(--tf-border)] px-2.5 py-2">
                <button className="min-w-0 flex-1 truncate text-left text-[13px] text-[var(--tf-text)]" onClick={() => onOpenTask(t.id)}>
                  {t.completed ? '✓ ' : ''}
                  {t.title}
                </button>
                <button className="icon-btn" onClick={() => onUnlinkTask(t.id)} aria-label={`Unlink ${t.title}`}>
                  <X size={12} />
                </button>
              </div>
            ))}
        </div>
      )}

      {children.length > 0 && (
        <div className="space-y-1.5">
          <DetailLabel>Child goals</DetailLabel>
          <div className="flex flex-wrap gap-1.5">
            {children.map((c) => (
              <span key={c.id} className="rounded-lg bg-[var(--tf-surface-2)] px-2 py-1 text-[11.5px] font-medium text-[var(--tf-text-secondary)]">
                {horizonMeta(c.horizon).label} · {c.title}
              </span>
            ))}
          </div>
        </div>
      )}
      {parents.length > 0 && (
        <p className="text-[11.5px] text-[var(--tf-text-faint)]">
          Part of: {parents.map((p) => p.title).join(' → ')}
        </p>
      )}

      <div className="space-y-2">
        <DetailLabel>Actions</DetailLabel>
        <div className="flex gap-2">
          <input
            value={taskDraft}
            onChange={(e) => onTaskDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddTask()}
            placeholder="Add a task for this goal"
            className="input h-8 flex-1 text-[13px]"
            aria-label="New goal task"
          />
          <button className="btn btn-secondary btn-sm" onClick={onAddTask}>
            <Plus size={13} /> Add task
          </button>
        </div>
        {linkOpen ? (
          <div className="space-y-1.5">
            {availableTasks.length === 0 ? (
              <p className="text-[12px] text-[var(--tf-text-faint)]">No unlinked inbox tasks to link.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {availableTasks.slice(0, 12).map((t) => (
                  <button key={t.id} className="rounded-lg border border-[var(--tf-border)] px-2 py-1 text-[12px] text-[var(--tf-text-secondary)]" onClick={() => onLinkTask(t.id)}>
                    <Link2 size={11} className="mr-1 inline" />
                    {t.title}
                  </button>
                ))}
              </div>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => onLinkOpen(false)}>
              Done
            </button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => onLinkOpen(true)}>
            <Link2 size={13} /> Link an existing task
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[var(--tf-border)] pt-3">
        {status !== 'completed' ? (
          <button className="btn btn-primary btn-sm" onClick={onComplete}>
            <Check size={14} /> Complete goal
          </button>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={onReactivate}>
            <RotateCcw size={14} /> Reactivate
          </button>
        )}
        {status !== 'completed' && (
          <button className="btn btn-secondary btn-sm" onClick={onTogglePause}>
            {status === 'paused' ? <Play size={14} /> : <Pause size={14} />}
            {status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onArchive}>
          <Archive size={14} /> Archive
        </button>
        <span className="flex-1" />
        <button className="btn btn-ghost btn-sm text-red-500" onClick={onDelete}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  )
}

function DetailLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">{children}</p>
}

function GoalForm({
  value,
  projects,
  goals,
  editing,
  onChange,
  onToggleProject,
  onToggleTask,
  onAddMilestone,
  onRemoveMilestone,
  onCancel,
  onSubmit,
}: {
  value: GoalFormState
  projects: Project[]
  goals: Goal[]
  editing: boolean
  onChange: <K extends keyof GoalFormState>(key: K, v: GoalFormState[K]) => void
  onToggleProject: (id: string) => void
  onToggleTask: (id: string) => void
  onAddMilestone: (title: string) => void
  onRemoveMilestone: (i: number) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  const [advanced, setAdvanced] = useState(editing)
  const [milestoneDraft, setMilestoneDraft] = useState('')
  const [taskQuery, setTaskQuery] = useState('')
  const tasks = useStore((s) => s.tasks)
  const linkable = tasks.filter((t) => !t.archived && !t.completed && !t.projectId).slice(0, 20)

  return (
    <div className="card space-y-3 p-4">
      <input
        autoFocus
        value={value.title}
        onChange={(e) => onChange('title', e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !advanced && onSubmit()}
        placeholder="e.g. Run a marathon"
        className="input"
        aria-label="Goal title"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <DetailLabel>Horizon</DetailLabel>
          <select
            value={value.horizon}
            onChange={(e) => {
              const h = e.target.value as GoalHorizon
              onChange('horizon', h)
              onChange('targetDate', defaultTargetDate(h))
            }}
            className="input"
            aria-label="Goal horizon"
          >
            {HORIZONS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label} — {h.tagline}
              </option>
            ))}
          </select>
        </div>
        <div>
          <DetailLabel>Target date</DetailLabel>
          <input type="date" value={value.targetDate} onChange={(e) => onChange('targetDate', e.target.value)} className="input" aria-label="Goal target date" />
        </div>
        <div>
          <DetailLabel>Category</DetailLabel>
          <select value={value.category} onChange={(e) => onChange('category', e.target.value as GoalCategory)} className="input" aria-label="Goal category">
            {GOAL_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => onChange('color', c)}
            className={`h-7 w-7 rounded-full transition-transform ${value.color === c ? 'scale-110 ring-2 ring-offset-2 ring-[var(--tf-accent)]' : ''}`}
            style={{ background: c }}
          />
        ))}
        <button className="btn btn-ghost btn-sm ml-auto" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? 'Hide options' : 'More options'}
        </button>
      </div>

      {advanced && (
        <div className="space-y-3 rounded-xl border border-[var(--tf-border)] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <DetailLabel>Why it matters</DetailLabel>
              <input value={value.why} onChange={(e) => onChange('why', e.target.value)} placeholder="Your reason" className="input" aria-label="Why this goal matters" />
            </div>
            <div>
              <DetailLabel>Success metric</DetailLabel>
              <input value={value.metric} onChange={(e) => onChange('metric', e.target.value)} placeholder="e.g. Save ₹6L" className="input" aria-label="Goal success metric" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <DetailLabel>Progress method</DetailLabel>
              <select value={value.progressType} onChange={(e) => onChange('progressType', e.target.value as GoalProgressType)} className="input" aria-label="Progress method">
                {PROGRESS_TYPES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {(value.progressType === 'numeric' || value.progressType === 'percentage' || value.progressType === 'habit') && (
              <>
                <div>
                  <DetailLabel>{value.progressType === 'habit' ? 'Target days' : 'Target'}</DetailLabel>
                  <input type="number" value={value.targetValue} onChange={(e) => onChange('targetValue', e.target.value)} className="input" aria-label="Target value" />
                </div>
                <div>
                  <DetailLabel>Current</DetailLabel>
                  <input type="number" value={value.currentValue} onChange={(e) => onChange('currentValue', e.target.value)} className="input" aria-label="Current value" />
                </div>
                {value.progressType === 'numeric' && (
                  <div>
                    <DetailLabel>Unit</DetailLabel>
                    <input value={value.unit} onChange={(e) => onChange('unit', e.target.value)} placeholder="km, ₹, hrs" className="input" aria-label="Unit" />
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <DetailLabel>Parent goal</DetailLabel>
            <select value={value.parentId ?? ''} onChange={(e) => onChange('parentId', e.target.value || null)} className="input" aria-label="Parent goal">
              <option value="">None (top-level)</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {horizonMeta(g.horizon).label} · {g.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <DetailLabel>Milestones</DetailLabel>
            <div className="space-y-1.5">
              {value.milestones.map((m, i) => (
                <div key={`${m}-${i}`} className="flex items-center gap-2 text-[13px] text-[var(--tf-text-secondary)]">
                  <span className="flex-1">{m}</span>
                  <button className="icon-btn" onClick={() => onRemoveMilestone(i)} aria-label={`Remove ${m}`}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={milestoneDraft}
                  onChange={(e) => setMilestoneDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !milestoneDraft.trim()) return
                    onAddMilestone(milestoneDraft.trim())
                    setMilestoneDraft('')
                  }}
                  placeholder="Add a milestone"
                  className="input h-8 text-[13px]"
                  aria-label="New milestone"
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (!milestoneDraft.trim()) return
                    onAddMilestone(milestoneDraft.trim())
                    setMilestoneDraft('')
                  }}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>

          <div>
            <DetailLabel>Link projects to measure progress</DetailLabel>
            {projects.length === 0 ? (
              <p className="text-[12px] text-[var(--tf-text-faint)]">Create a project first, then link it here.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {projects.map((p) => {
                  const on = value.projectIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onToggleProject(p.id)}
                      aria-pressed={on}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? 'border-transparent text-white' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)]'}`}
                      style={on ? { background: p.color } : undefined}
                    >
                      {p.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <DetailLabel>Link existing inbox tasks</DetailLabel>
            <input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)} placeholder="Filter tasks…" className="input mb-1.5 h-8 text-[13px]" aria-label="Filter tasks to link" />
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {linkable
                .filter((t) => t.title.toLowerCase().includes(taskQuery.toLowerCase()))
                .map((t) => {
                  const on = value.taskIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onToggleTask(t.id)}
                      aria-pressed={on}
                      className={`rounded-lg border px-2 py-1 text-[12px] font-medium ${on ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)]'}`}
                    >
                      {t.title}
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={!value.title.trim()}>
          {editing ? 'Save goal' : 'Create goal'}
        </button>
      </div>
    </div>
  )
}

function GoalReviewPanel({ goals, tasks, projects }: { goals: Goal[]; tasks: Task[]; projects: Project[] }) {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const sinceMs = useMemo(() => {
    const now = new Date()
    if (period === 'week') {
      const d = new Date(now)
      const dow = d.getDay()
      d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }, [period])

  const review = useMemo(() => buildGoalReview(goals, tasks, projects, sinceMs), [goals, tasks, projects, sinceMs])
  const analytics = useMemo(() => computeGoalAnalytics(goals, tasks), [goals, tasks])
  const [open, setOpen] = useState(false)

  if (goals.length === 0) return null

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Icon name="trendingUp" size={16} className="text-[var(--tf-accent-text)]" />
        <h3 className="text-[14px] font-semibold text-[var(--tf-text)]">Reviews</h3>
        <div className="flex rounded-lg border border-[var(--tf-border)] p-0.5">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-semibold ${period === p ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text-muted)]'}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button className="text-[12px] font-semibold text-[var(--tf-accent-text-strong)] hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Show review'}
        </button>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <ReviewList
            title={period === 'week' ? 'What moved you closer' : 'Progress this month'}
            items={[
              ...review.progressed.map((p) => `${p.title} — ${p.pct}%`),
              ...review.contributing.map((c) => `${c.title} → ${c.goalTitle}`),
            ]}
            empty="No linked progress yet. Link a task to a goal."
          />
          <ReviewList
            title="What got in the way"
            items={review.needsAttention.map((g) => `${g.title} — ${g.health === 'at_risk' ? 'at risk' : 'needs attention'}`)}
            empty="Nothing is falling behind. Keep the rhythm."
          />
          <ReviewList
            title="What matters next"
            items={review.nextActions}
            empty={review.completedGoals.length ? `Completed: ${review.completedGoals.join(', ')}` : 'Add a next step to your goals.'}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-[var(--tf-text-muted)]">
        <span>{analytics.completed} completed</span>
        <span>· {analytics.completionRate}% completion rate</span>
        <span>· {analytics.completedThisMonth} completed this month</span>
        <span>· {review.milestonesDone} milestones done</span>
      </div>
    </div>
  )
}

function ReviewList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="rounded-xl bg-[var(--tf-surface-2)] p-3">
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">{title}</p>
      {items.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-faint)]">{empty}</p>
      ) : (
        <ul className="space-y-1 text-[12.5px] text-[var(--tf-text-secondary)]">
          {items.slice(0, 6).map((i, idx) => (
            <li key={`${i}-${idx}`}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TemplatesModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: GoalTemplate) => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Goal templates" size="lg">
      <p className="mb-3 text-[13px] text-[var(--tf-text-muted)]">
        Start from a proven structure. Each template creates the goal, milestones, and a first action for today.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {GOAL_TEMPLATES.map((t) => (
          <button key={t.id} className="card card-hover flex flex-col items-start gap-1 p-3 text-left" onClick={() => onPick(t)}>
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--tf-text)]">
              <Icon name={t.icon} size={15} className="text-[var(--tf-accent-text)]" /> {t.label}
            </span>
            <span className="text-[12.5px] font-medium text-[var(--tf-text-secondary)]">{t.title}</span>
            <span className="text-[11.5px] text-[var(--tf-text-muted)]">{t.metric}</span>
            <span className="text-[11px] text-[var(--tf-text-faint)]">{horizonMeta(t.horizon).label} · {t.milestones.length} milestones</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function PlanModal({ open, onClose, onAccept }: { open: boolean; onClose: () => void; onAccept: () => void }) {
  const addGoal = useStore((s) => s.addGoal)
  const addTaskToGoal = useStore((s) => s.addTaskToGoal)
  const generateMilestoneTasks = useStore((s) => s.generateMilestoneTasks)
  const toast = useStore((s) => s.toast)
  const [prompt, setPrompt] = useState('')
  const [plan, setPlan] = useState<ReturnType<typeof suggestGoalPlan> | null>(null)

  useEffect(() => {
    if (!open) {
      setPrompt('')
      setPlan(null)
    }
  }, [open])

  const generate = () => {
    if (!prompt.trim()) return
    setPlan(suggestGoalPlan(prompt))
  }

  const accept = () => {
    if (!plan) return
    let parentId: string | null = null
    let todayGoalId: string | null = null
    for (const step of plan.steps) {
      const goal = addGoal({
        title: step.title,
        horizon: step.horizon,
        targetDate: defaultTargetDate(step.horizon),
        category: plan.category,
        why: step.why,
        metric: step.metric,
        progressType: 'milestone',
        parentId,
        milestones: [{ id: uid('ms-'), title: step.milestone, done: false }],
      })
      if (!goal) return
      generateMilestoneTasks(goal.id)
      parentId = goal.id
      if (step.horizon === 'today') todayGoalId = goal.id
    }
    if (todayGoalId) {
      const action = plan.steps.find((s) => s.horizon === 'today')?.todayAction
      if (action) addTaskToGoal(todayGoalId, { title: action, dueDate: new Date().toISOString().slice(0, 10) })
    }
    toast({ title: 'Goal ladder created', message: 'From 5-year vision to today’s first action.', kind: 'success' })
    onAccept()
  }

  return (
    <Modal open={open} onClose={onClose} title="Plan with AI" size="lg">
      <p className="text-[13px] text-[var(--tf-text-muted)]">
        Describe what you want. TaskFlow proposes an editable 5-year → today ladder. Nothing is created until you confirm.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          autoFocus
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generate()}
          placeholder="e.g. I want to run a marathon"
          className="input flex-1"
          aria-label="Describe your goal"
        />
        <button className="btn btn-secondary" onClick={generate} disabled={!prompt.trim()}>
          <Sparkles size={14} /> Suggest
        </button>
      </div>

      {plan && (
        <div className="mt-4 space-y-2">
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{plan.summary}</p>
          {plan.steps.map((s) => (
            <div key={s.horizon} className="flex items-start gap-3 rounded-xl border border-[var(--tf-border)] p-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">
                <Icon name={horizonMeta(s.horizon).icon} size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">{horizonMeta(s.horizon).label}</p>
                <p className="text-[13.5px] font-medium text-[var(--tf-text)]">{s.title}</p>
                <p className="text-[11.5px] text-[var(--tf-text-muted)]">Today: {s.todayAction}</p>
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn btn-ghost btn-sm" onClick={() => setPlan(null)}>
              Discard
            </button>
            <button className="btn btn-primary btn-sm" onClick={accept}>
              <Check size={14} /> Create these goals
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
