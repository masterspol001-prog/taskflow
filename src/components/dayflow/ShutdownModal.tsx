import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { buildShutdown, type ShutdownChoice } from '@/lib/dayflow'
import { estimateLabel } from '@/lib/time'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const CHOICES: { id: ShutdownChoice; label: string; hint: string }[] = [
  { id: 'tomorrow', label: 'Tomorrow', hint: 'Park it for the next day' },
  { id: 'keep', label: 'Keep', hint: 'Leave it on today' },
  { id: 'drop', label: 'Drop', hint: 'Archive it' },
]

export function ShutdownModal() {
  const open = useUIStore((s) => s.shutdownOpen)
  const setShutdown = useUIStore((s) => s.setShutdown)
  const tasks = useStore((s) => s.tasks)
  const goals = useStore((s) => s.goals)
  const settings = useStore((s) => s.settings)
  const energy = settings.energy ?? 'medium'
  const applyShutdown = useStore((s) => s.applyShutdown)
  const plan = useMemo(() => buildShutdown(tasks, goals, energy, settings), [tasks, goals, energy, settings])
  const [choices, setChoices] = useState<Record<string, ShutdownChoice>>({})

  useEffect(() => {
    if (!open) return
    const next: Record<string, ShutdownChoice> = {}
    for (const item of plan.leftover) next[item.id] = 'tomorrow'
    setChoices(next)
  }, [open, plan.leftover])

  if (!open) return null

  const apply = () => {
    applyShutdown(plan.leftover.map((item) => ({ id: item.id, choice: choices[item.id] ?? 'tomorrow' })))
    setShutdown(false)
  }

  return (
    <Modal open={open} onClose={() => setShutdown(false)} title="Shut down today" size="md">
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--tf-text-muted)]">
          {plan.done} finished · {plan.leftover.length} still open. {plan.summary}
        </p>
        {plan.leftover.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--tf-border-strong)] px-3.5 py-3 text-[13px] text-[var(--tf-text-secondary)]">
            Nothing left to park. Close the day and start clean tomorrow.
          </p>
        ) : (
          <ul className="space-y-2">
            {plan.leftover.map((item) => (
              <li key={item.id} className="rounded-xl border border-[var(--tf-border)] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-[14px] font-medium text-[var(--tf-text)]">{item.title}</p>
                  <span className="shrink-0 text-[11px] text-[var(--tf-text-faint)]">
                    {item.minutes ? estimateLabel(item.minutes) : item.why}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Park ${item.title}`}>
                  {CHOICES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium ${
                        (choices[item.id] ?? 'tomorrow') === c.id
                          ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]'
                          : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)]'
                      }`}
                      aria-pressed={(choices[item.id] ?? 'tomorrow') === c.id}
                      title={c.hint}
                      onClick={() => setChoices((prev) => ({ ...prev, [item.id]: c.id }))}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setShutdown(false)}>
            Not yet
          </Button>
          <Button onClick={apply}>{plan.leftover.length ? 'Shut down' : 'Close the day'}</Button>
        </div>
      </div>
    </Modal>
  )
}
