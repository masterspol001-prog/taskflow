import { useMemo, useState } from 'react'
import { Pencil, Plus, Target, Trash2, Unlink } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import type { Goal, Project, Task } from '@/lib/types'
import { EmptyState } from '@/components/ui/states'
import { isPro } from '@/lib/pro'
import { ProPrompt } from '@/components/paywall/ProPrompt'
import { projectProgress } from '@/lib/stats'

const COLORS = ['#8e5cf7', '#3b82f6', '#2f9e6e', '#0d9488', '#f97316', '#e5484d', '#d9a514']

export function GoalsView() {
  const goals = useStore((s) => s.goals)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const settings = useStore((s) => s.settings)
  const addGoal = useStore((s) => s.addGoal)
  const updateGoal = useStore((s) => s.updateGoal)
  const removeGoal = useStore((s) => s.removeGoal)
  const toast = useStore((s) => s.toast)

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [picked, setPicked] = useState<string[]>([])

  const visibleProjects = projects.filter((p) => !p.archived)

  if (!isPro(settings)) {
    return <ProPrompt feature="Goals" />
  }

  const resetForm = () => {
    setTitle('')
    setTargetDate('')
    setPicked([])
    setColor(COLORS[0])
    setAdding(false)
    setEditingId(null)
  }

  const startEdit = (g: Goal) => {
    setEditingId(g.id)
    setAdding(false)
    setTitle(g.title)
    setTargetDate(g.targetDate ?? '')
    setColor(g.color)
    setPicked([...g.projectIds])
  }

  const create = () => {
    if (!title.trim()) return
    const created = addGoal({
      title: title.trim(),
      color,
      projectIds: picked,
      targetDate: targetDate || null,
    })
    if (!created) return
    toast({ title: 'Goal created', kind: 'success' })
    resetForm()
  }

  const saveEdit = () => {
    if (!editingId || !title.trim()) return
    updateGoal(editingId, {
      title: title.trim(),
      color,
      projectIds: picked,
      targetDate: targetDate || null,
    })
    toast({ title: 'Goal updated', kind: 'success' })
    resetForm()
  }

  const formOpen = adding || !!editingId

  if (goals.length === 0 && !formOpen) {
    return (
      <EmptyState
        icon="flag"
        title="No goals yet"
        description="A goal connects projects to an outcome you care about. Set a target, link projects, and watch progress."
        action={
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> New goal
          </button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Goals</h2>
          <p className="text-sm text-[var(--tf-text-muted)]">Outcomes, measured by the work in your projects.</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            resetForm()
            setAdding(true)
          }}
        >
          <Plus size={15} /> Goal
        </button>
      </div>

      {formOpen && (
        <GoalForm
          title={title}
          targetDate={targetDate}
          color={color}
          picked={picked}
          projects={visibleProjects}
          editing={!!editingId}
          onTitle={setTitle}
          onTargetDate={setTargetDate}
          onColor={setColor}
          onToggleProject={(id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
          onCancel={resetForm}
          onSubmit={editingId ? saveEdit : create}
        />
      )}

      {goals.map((g) => (
        <GoalCard
          key={g.id}
          goal={g}
          tasks={tasks}
          projects={projects}
          editing={editingId === g.id}
          onEdit={() => startEdit(g)}
          onDelete={() => {
            removeGoal(g.id)
            if (editingId === g.id) resetForm()
            toast({ title: 'Goal deleted', kind: 'info' })
          }}
          onUnlink={(projectId) => {
            updateGoal(g.id, { projectIds: g.projectIds.filter((id) => id !== projectId) })
          }}
          onLink={(projectId) => {
            if (g.projectIds.includes(projectId)) return
            updateGoal(g.id, { projectIds: [...g.projectIds, projectId] })
          }}
        />
      ))}
    </div>
  )
}

function GoalForm({
  title,
  targetDate,
  color,
  picked,
  projects,
  editing,
  onTitle,
  onTargetDate,
  onColor,
  onToggleProject,
  onCancel,
  onSubmit,
}: {
  title: string
  targetDate: string
  color: string
  picked: string[]
  projects: Project[]
  editing: boolean
  onTitle: (v: string) => void
  onTargetDate: (v: string) => void
  onColor: (v: string) => void
  onToggleProject: (id: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <div className="card space-y-3 p-4">
      <input
        autoFocus
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        placeholder="e.g. Buy a car"
        className="input"
        aria-label="Goal title"
      />
      <div>
        <p className="mb-1.5 text-xs font-medium text-[var(--tf-text-secondary)]">Target date</p>
        <input
          type="date"
          value={targetDate}
          onChange={(e) => onTargetDate(e.target.value)}
          className="input"
          aria-label="Goal target date"
        />
      </div>
      <div className="flex items-center gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => onColor(c)}
            className={`h-8 w-8 rounded-full transition-transform ${color === c ? 'scale-110 ring-2 ring-offset-2 ring-[var(--tf-accent)]' : ''}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <ProjectPicker projects={projects} picked={picked} onToggle={onToggleProject} />
      <div className="flex justify-end gap-2">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" onClick={onSubmit} disabled={!title.trim()}>
          {editing ? 'Save goal' : 'Create goal'}
        </button>
      </div>
    </div>
  )
}

function ProjectPicker({
  projects,
  picked,
  onToggle,
}: {
  projects: Project[]
  picked: string[]
  onToggle: (id: string) => void
}) {
  if (projects.length === 0) {
    return <p className="text-xs text-[var(--tf-text-muted)]">Create a project first, then link it here to measure progress.</p>
  }
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-[var(--tf-text-secondary)]">Link projects to measure progress</p>
      <div className="flex flex-wrap gap-1.5">
        {projects.map((p) => {
          const on = picked.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              aria-pressed={on}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${on ? 'border-transparent text-white' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)]'}`}
              style={on ? { background: p.color } : undefined}
            >
              {p.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function goalProgress(goal: Goal, tasks: Task[]) {
  const ts = tasks.filter((t) => !t.archived && t.projectId && goal.projectIds.includes(t.projectId))
  const done = ts.filter((t) => t.completed).length
  const total = ts.length
  const pct = total ? Math.round((done / total) * 100) : 0
  return { done, total, pct }
}

function GoalCard({
  goal,
  tasks,
  projects,
  editing,
  onEdit,
  onDelete,
  onUnlink,
  onLink,
}: {
  goal: Goal
  tasks: Task[]
  projects: Project[]
  editing: boolean
  onEdit: () => void
  onDelete: () => void
  onUnlink: (projectId: string) => void
  onLink: (projectId: string) => void
}) {
  const navigate = useUIStore((s) => s.navigate)
  const [linking, setLinking] = useState(false)
  const { done, total, pct } = useMemo(() => goalProgress(goal, tasks), [tasks, goal])
  const linked = projects.filter((p) => goal.projectIds.includes(p.id) && !p.archived)
  const available = projects.filter((p) => !p.archived && !goal.projectIds.includes(p.id))

  return (
    <div className={`card space-y-3 p-4 ${editing ? 'ring-2 ring-[var(--tf-accent)]' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: goal.color + '22', color: goal.color }}>
          <Target size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-[var(--tf-text)]">{goal.title}</h3>
          <p className="text-xs text-[var(--tf-text-muted)]">
            {total === 0
              ? linked.length === 0
                ? 'Link projects to measure progress'
                : 'Linked project has no tasks yet'
              : `${done} of ${total} tasks done · ${pct}%`}
            {goal.targetDate
              ? ` · target ${new Date(goal.targetDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
              : ''}
          </p>
        </div>
        <button className="icon-btn" onClick={onEdit} aria-label={`Edit ${goal.title}`}>
          <Pencil size={15} />
        </button>
        <button className="icon-btn" onClick={onDelete} aria-label={`Delete ${goal.title}`}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: goal.color }} />
      </div>

      {linked.length > 0 && (
        <div className="space-y-1.5">
          {linked.map((p) => {
            const pt = tasks.filter((t) => !t.archived && t.projectId === p.id)
            const pDone = pt.filter((t) => t.completed).length
            const pPct = projectProgress(pt)
            return (
              <div key={p.id} className="flex items-center gap-2 rounded-xl border border-[var(--tf-border)] px-2.5 py-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate('all', { projectId: p.id })}
                >
                  <p className="truncate text-[13px] font-medium text-[var(--tf-text)]">{p.name}</p>
                  <p className="text-[11px] text-[var(--tf-text-muted)]">
                    {pt.length === 0 ? 'No tasks' : `${pDone}/${pt.length} · ${pPct}%`}
                  </p>
                </button>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
                  <div className="h-full rounded-full" style={{ width: `${pPct}%`, background: p.color }} />
                </div>
                <button className="icon-btn" onClick={() => onUnlink(p.id)} aria-label={`Unlink ${p.name}`}>
                  <Unlink size={13} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {linking ? (
        <div className="space-y-2">
          {available.length === 0 ? (
            <p className="text-xs text-[var(--tf-text-muted)]">No other projects to link.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {available.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="rounded-lg border border-[var(--tf-border)] px-2.5 py-1 text-xs font-medium text-[var(--tf-text-secondary)]"
                  onClick={() => {
                    onLink(p.id)
                    setLinking(false)
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setLinking(false)}>
            Done
          </button>
        </div>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={() => setLinking(true)}>
          <Plus size={13} /> Link projects to measure progress
        </button>
      )}
    </div>
  )
}
