import { useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { buildRecoveryPlan, type RecoveryChoice } from '@/lib/recovery'

const CHOICES: { id: RecoveryChoice; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'later', label: 'In 3 days' },
  { id: 'drop', label: 'Archive' },
]

export function RecoveryPanel() {
  const tasks = useStore((s) => s.tasks)
  const applyRecovery = useStore((s) => s.applyRecovery)
  const toast = useStore((s) => s.toast)
  const plan = useMemo(() => buildRecoveryPlan(tasks), [tasks])
  const [choices, setChoices] = useState<Record<string, RecoveryChoice>>({})

  if (plan.items.length === 0) return null

  const pick = (id: string, choice: RecoveryChoice) => {
    setChoices((prev) => ({ ...prev, [id]: choice }))
  }

  const apply = () => {
    const rows = plan.items.map((item) => ({ id: item.id, choice: choices[item.id] ?? item.suggested }))
    const n = applyRecovery(rows)
    toast({
      title: n ? 'Catch-up plan applied' : 'Nothing changed',
      message: n ? `${n} ${n === 1 ? 'task' : 'tasks'} updated. Original slip stays in postpone history.` : undefined,
      kind: n ? 'success' : 'info',
    })
  }

  return (
    <section id="insights-recovery" aria-label="Recover overdue" className="card space-y-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Recover overdue</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">{plan.summary}</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={apply}>
          Apply suggestions
        </button>
      </div>
      <ul className="space-y-2">
        {plan.items.map((item) => {
          const choice = choices[item.id] ?? item.suggested
          return (
            <li key={item.id} className="rounded-xl border border-[var(--tf-border)] bg-[var(--tf-surface-2)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-[var(--tf-text)]">{item.title}</p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--tf-text-muted)]">
                    {item.reason}
                    {item.originalDue ? ` · was ${item.originalDue}` : ''} · ~{item.minutes}m
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--tf-surface-3)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--tf-text-muted)]">
                  {item.urgency}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {CHOICES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`btn btn-sm ${choice === c.id ? 'btn-secondary' : 'btn-ghost'}`}
                    aria-pressed={choice === c.id}
                    onClick={() => pick(item.id, c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--tf-text-faint)]">
                {choice === item.suggested ? item.consequence : consequenceFor(choice)}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function consequenceFor(choice: RecoveryChoice): string {
  if (choice === 'today') return 'Sets due to today. Keep this list short so it can finish.'
  if (choice === 'tomorrow') return 'Moves the due date to tomorrow. Postpone count keeps the slip in history.'
  if (choice === 'later') return 'Parks it three days out so today stays realistic.'
  return 'Archives it. Restore from Archived if it still matters.'
}
