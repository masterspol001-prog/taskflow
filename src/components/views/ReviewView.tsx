import { useMemo, useState } from 'react'
import { useStore } from '@/store/useStore'
import { buildWeeklyReview } from '@/lib/agent'
import { hoursLabel } from '@/lib/insights'
import { startOfWeekISO } from '@/lib/dates'
import { EmptyState } from '@/components/ui/states'

export function ReviewView() {
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)
  const goals = useStore((s) => s.goals)
  const sessions = useStore((s) => s.progress.sessions)
  const reviews = useStore((s) => s.reviews)
  const saveWeeklyReview = useStore((s) => s.saveWeeklyReview)
  const weekStartMonday = useStore((s) => s.settings.weekStartMonday)
  const snapshot = useMemo(
    () => buildWeeklyReview(tasks, projects, goals, new Date(), sessions),
    [tasks, projects, goals, sessions]
  )
  const weekStart = startOfWeekISO(weekStartMonday !== false)
  const existing = reviews.find((r) => r.weekStart === weekStart)
  const [wentWell, setWentWell] = useState(existing?.wentWell ?? '')
  const [improve, setImprove] = useState(existing?.improve ?? '')
  const [nextPriorities, setNextPriorities] = useState(existing?.nextPriorities ?? snapshot.nextWeekFocus.slice(0, 3).join('\n'))
  const [selectedId, setSelectedId] = useState<string | null>(existing?.id ?? null)
  const selected = reviews.find((r) => r.id === selectedId) ?? null

  const save = () => {
    const record = saveWeeklyReview({
      weekStart,
      summary: snapshot.summary,
      completed: snapshot.completed,
      carriedOver: snapshot.carriedOver,
      overdue: snapshot.overdue,
      minutesLogged: snapshot.minutesLogged,
      plannedMinutes: snapshot.plannedMinutes,
      wins: snapshot.wins,
      slips: snapshot.slips,
      adjustments: snapshot.adjustments,
      nextWeekFocus: snapshot.nextWeekFocus,
      wentWell: wentWell.trim(),
      improve: improve.trim(),
      nextPriorities: nextPriorities.trim(),
    })
    setSelectedId(record.id)
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-text-muted)]">Weekly review</p>
        <h2 className="display mt-1 text-[26px] font-semibold leading-tight tracking-tight text-[var(--tf-text)]">Look back, then lock next week</h2>
        <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--tf-text-secondary)]">{snapshot.summary}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Finished" value={String(snapshot.completed)} />
        <Stat label="Carried over" value={String(snapshot.carriedOver)} />
        <Stat label="Focused" value={hoursLabel(snapshot.minutesLogged)} />
        <Stat label="Planned" value={hoursLabel(snapshot.plannedMinutes)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard title="What happened" items={snapshot.wins} empty="Complete something this week." />
        <ListCard title="What slipped" items={snapshot.slips} empty="Nothing postponed or overdue." />
      </div>

      {snapshot.adjustments.length > 0 && (
        <section className="card p-4">
          <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Suggested adjustments</h3>
          <ul className="mt-2 space-y-1.5">
            {snapshot.adjustments.map((line) => (
              <li key={line} className="text-[13px] leading-relaxed text-[var(--tf-text-secondary)]">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Your notes</h3>
        <Field label="What went well?" value={wentWell} onChange={setWentWell} />
        <Field label="What should improve?" value={improve} onChange={setImprove} />
        <Field label="Prioritize next week" value={nextPriorities} onChange={setNextPriorities} />
        <button type="button" className="btn btn-primary" onClick={save}>
          {existing ? 'Update this week' : 'Save this week'}
        </button>
      </section>

      {reviews.length === 0 ? (
        <EmptyState
          icon="calendarClock"
          title="No saved reviews yet"
          description="Answer the three questions and save. You can reopen past weeks anytime."
        />
      ) : (
        <section className="card p-4">
          <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Past reviews</h3>
          <ul className="mt-2 space-y-1">
            {reviews.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] ${
                    selected?.id === r.id ? 'bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'hover:bg-[var(--tf-hover)]'
                  }`}
                  onClick={() => setSelectedId(r.id)}
                >
                  <span>Week of {r.weekStart}</span>
                  <span className="text-[12px] text-[var(--tf-text-muted)]">{r.completed} finished</span>
                </button>
              </li>
            ))}
          </ul>
          {selected && (
            <div className="mt-3 space-y-2 border-t border-[var(--tf-border)] pt-3 text-[13px] text-[var(--tf-text-secondary)]">
              <p>{selected.summary}</p>
              {selected.wentWell && <p>Went well: {selected.wentWell}</p>}
              {selected.improve && <p>Improve: {selected.improve}</p>}
              {selected.nextPriorities && <p>Next: {selected.nextPriorities}</p>}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-3 py-2">
      <p className="text-[11px] font-medium text-[var(--tf-text-muted)]">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-[var(--tf-text)]">{value}</p>
    </div>
  )
}

function ListCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section className="card p-4">
      <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px] text-[var(--tf-text-faint)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item} className="text-[13px] text-[var(--tf-text-secondary)]">
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--tf-text-muted)]">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1 min-h-[72px]"
        rows={3}
      />
    </label>
  )
}
