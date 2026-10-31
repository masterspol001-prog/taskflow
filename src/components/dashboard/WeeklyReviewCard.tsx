import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { buildWeeklyReview } from '@/lib/agent'
import { hoursLabel } from '@/lib/insights'
export function WeeklyReviewCard() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const sessions = useStore((s) => s.progress.sessions)
  const navigate = useUIStore((s) => s.navigate)
  const review = useMemo(() => buildWeeklyReview(tasks, projects, goals, new Date(), sessions), [tasks, projects, goals, sessions])

  return (
    <section aria-label="This week" className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">This week</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">{review.summary}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => navigate('review')}>
          Full review
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Mini label="Finished" value={String(review.completed)} />
        <Mini label="Carried over" value={String(review.carriedOver)} />
        <Mini label="Focused" value={hoursLabel(review.minutesLogged)} />
        <Mini label="Planned" value={hoursLabel(review.plannedMinutes)} />
      </div>
      {review.adjustments.length > 0 && (
        <ul className="space-y-1">
          {review.adjustments.map((line) => (
            <li key={line} className="text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">
              {line}
            </li>
          ))}
        </ul>
      )}
      {review.nextWeekFocus.length > 0 && (
        <p className="text-[12px] text-[var(--tf-text-muted)]">
          Next: {review.nextWeekFocus.slice(0, 2).join(' · ')}
        </p>
      )}
    </section>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--tf-surface-2)] px-3 py-2">
      <p className="text-[11px] font-medium text-[var(--tf-text-muted)]">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-[var(--tf-text)]">{value}</p>
    </div>
  )
}
