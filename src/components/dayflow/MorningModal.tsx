import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { buildMorning, type MorningChoice } from '@/lib/dayflow'
import { estimateLabel } from '@/lib/time'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const CHOICES: { id: MorningChoice; label: string; hint: string }[] = [
  { id: 'commit', label: 'Commit', hint: 'Lock it for today' },
  { id: 'later', label: 'Tomorrow', hint: 'Snooze until tomorrow' },
  { id: 'park', label: 'Someday', hint: 'Park it out of today' },
]

export function MorningModal() {
  const open = useUIStore((s) => s.morningOpen)
  const setMorning = useUIStore((s) => s.setMorning)
  const tasks = useStore((s) => s.tasks)
  const goals = useStore((s) => s.goals)
  const settings = useStore((s) => s.settings)
  const energy = settings.energy ?? 'medium'
  const applyMorning = useStore((s) => s.applyMorning)
  const plan = useMemo(() => buildMorning(tasks, goals, energy, settings), [tasks, goals, energy, settings])
  const [choices, setChoices] = useState<Record<string, MorningChoice>>({})

  useEffect(() => {
    if (!open) return
    const next: Record<string, MorningChoice> = {}
    for (const item of plan.candidates) next[item.id] = 'commit'
    setChoices(next)
  }, [open, plan.candidates])

  if (!open) return null

  const apply = () => {
    applyMorning(plan.candidates.map((item) => ({ id: item.id, choice: choices[item.id] ?? 'commit' })))
    setMorning(false)
  }

  return (
    <Modal open={open} onClose={() => setMorning(false)} title="Start this morning" size="md">
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--tf-text-muted)]">{plan.summary}</p>
        {plan.candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--tf-border-strong)] px-3.5 py-3 text-[13px] text-[var(--tf-text-secondary)]">
            Nothing obvious to commit. Capture a task, or pull one from Someday.
          </p>
        ) : (
          <ul className="space-y-2">
            {plan.candidates.map((item) => (
              <li key={item.id} className="rounded-xl border border-[var(--tf-border)] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="min-w-0 truncate text-[14px] font-medium text-[var(--tf-text)]">{item.title}</p>
                  <span className="shrink-0 text-[11px] text-[var(--tf-text-faint)]">
                    {item.minutes ? estimateLabel(item.minutes) : item.why}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Start ${item.title}`}>
                  {CHOICES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`rounded-lg border px-2.5 py-1 text-[12px] font-medium ${
                        (choices[item.id] ?? 'commit') === c.id
                          ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]'
                          : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)]'
                      }`}
                      aria-pressed={(choices[item.id] ?? 'commit') === c.id}
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
          <Button variant="ghost" onClick={() => setMorning(false)}>
            Not yet
          </Button>
          <Button onClick={apply}>{plan.candidates.length ? 'Start the day' : 'Mark morning done'}</Button>
        </div>
      </div>
    </Modal>
  )
}
