import { useMemo, useState } from 'react'
import type { HeatDay } from '@/lib/viz'
import { padHeatmap } from '@/lib/viz'

function heatColor(i: 0 | 1 | 2 | 3 | 4): string {
  return ['var(--tf-surface-3)', 'rgb(var(--tf-accent-rgb) / 0.22)', 'rgb(var(--tf-accent-rgb) / 0.42)', 'rgb(var(--tf-accent-rgb) / 0.68)', 'var(--tf-accent)'][i]
}

export function ActivityHeatmap({
  days,
  weekStartMonday = true,
  title = 'Activity heatmap',
  hint = 'Last 12 weeks',
}: {
  days: HeatDay[]
  weekStartMonday?: boolean
  title?: string
  hint?: string
}) {
  const [tip, setTip] = useState<string | null>(null)
  const cells = useMemo(() => padHeatmap(days, weekStartMonday), [days, weekStartMonday])
  const hasAny = days.some((d) => d.count > 0)
  const weekdays = weekStartMonday ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const cols = Math.max(1, Math.ceil(cells.length / 7))

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">{title}</h3>
        <span className="text-[11px] text-[var(--tf-text-faint)]">{hint}</span>
      </div>
      {!hasAny ? (
        <p className="py-6 text-center text-[13px] text-[var(--tf-text-faint)]">Complete a task to light up the heatmap.</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <div className="flex flex-col justify-between py-[1px] text-[9px] text-[var(--tf-text-faint)]" aria-hidden="true">
            {weekdays.map((d, i) => (
              <span key={d} className={i % 2 === 1 ? 'opacity-0' : ''}>
                {d}
              </span>
            ))}
          </div>
          <div
            className="grid min-w-0 flex-1 grid-flow-col grid-rows-7 gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(10px, 1fr))` }}
            role="img"
            aria-label="Task and focus activity over the last 12 weeks"
          >
            {cells.map((d) =>
              d.empty ? (
                <span key={d.date} className="aspect-square rounded-[3px] bg-transparent" aria-hidden="true" />
              ) : (
                <button
                  key={d.date}
                  type="button"
                  aria-label={`${d.date}: ${d.count} ${d.count === 1 ? 'activity' : 'activities'}`}
                  onMouseEnter={() => setTip(`${d.date} · ${d.count}`)}
                  onFocus={() => setTip(`${d.date} · ${d.count}`)}
                  onMouseLeave={() => setTip(null)}
                  onBlur={() => setTip(null)}
                  className="aspect-square rounded-[3px] outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-[var(--tf-ring)]"
                  style={{ background: heatColor(d.intensity) }}
                />
              )
            )}
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--tf-text-faint)]">
        <span>{tip ?? 'Completions and focus sessions'}</span>
        <span className="flex items-center gap-1">
          Less
          {([0, 1, 2, 3, 4] as const).map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: heatColor(i) }} />
          ))}
          More
        </span>
      </div>
    </section>
  )
}
