import { useMemo, useState } from 'react'
import { Copy, Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { projectHealthOf, whatIfDelay } from '@/lib/workspace'
import { EmptyState } from '@/components/ui/states'
import { Icon } from '@/components/ui/Icon'

export function ProjectsHub() {
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const duplicateProject = useStore((s) => s.duplicateProject)
  const applyWhatIf = useStore((s) => s.applyWhatIf)
  const openNewProject = useUIStore((s) => s.openNewProject)
  const navigate = useUIStore((s) => s.navigate)
  const [whatIfId, setWhatIfId] = useState<string | null>(null)
  const [delay, setDelay] = useState(7)
  const live = projects.filter((p) => !p.archived)
  const preview = useMemo(() => (whatIfId ? whatIfDelay(tasks, whatIfId, delay) : null), [tasks, whatIfId, delay])

  if (live.length === 0) {
    return (
      <EmptyState
        icon="layers"
        title="No projects yet"
        description="Group related work into projects."
        action={<button className="btn btn-primary" onClick={() => openNewProject()}>New project</button>}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Projects</h2>
          <p className="text-[13px] text-[var(--tf-text-muted)]">Health is counted from open and overdue tasks.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openNewProject()}>
          <Plus size={14} /> New
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {live.map((p) => {
          const open = tasks.filter((t) => t.projectId === p.id && !t.archived && !t.completed).length
          const health = projectHealthOf(p, tasks)
          return (
            <article key={p.id} className="card space-y-3 p-4">
              <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => navigate('all', { projectId: p.id })}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: p.color + '22', color: p.color }}>
                  <Icon name={p.icon} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--tf-text)]">{p.name}</span>
                  <span className="block text-[12px] text-[var(--tf-text-muted)]">
                    {open} open · {health === 'at-risk' ? 'at risk' : health === 'watch' ? 'watch' : 'healthy'}
                    {p.deadline ? ` · due ${p.deadline}` : ''}
                  </span>
                </span>
              </button>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => duplicateProject(p.id)}>
                  <Copy size={12} /> Duplicate
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setWhatIfId(p.id)}>
                  What if +{delay}d
                </button>
              </div>
            </article>
          )
        })}
      </div>
      {preview && whatIfId && (
        <div className="card space-y-3 p-4">
          <p className="text-[14px] font-semibold text-[var(--tf-text)]">What-if · delay {delay} days</p>
          <p className="text-[13px] text-[var(--tf-text-muted)]">{preview.summary}</p>
          <div className="flex flex-wrap gap-2">
            {[1, 7, 14].map((d) => (
              <button key={d} type="button" className={`btn btn-sm ${delay === d ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDelay(d)}>
                +{d}d
              </button>
            ))}
          </div>
          {preview.moved.slice(0, 8).map((m) => (
            <p key={m.id} className="text-[12.5px] text-[var(--tf-text-secondary)]">{m.title}: {m.from} → {m.to}</p>
          ))}
          <div className="flex gap-2">
            <button className="btn btn-primary btn-sm" onClick={() => { applyWhatIf(whatIfId, delay); setWhatIfId(null) }}>
              Apply dates
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setWhatIfId(null)}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  )
}
