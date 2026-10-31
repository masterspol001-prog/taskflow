import { useMemo, useState } from 'react'
import { Flame, Zap, Award, Timer } from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  ACHIEVEMENTS,
  activityCalendar,
  computeRuleStreak,
  levelFromXp,
  todayCompletionPct,
} from '@/lib/progress'
import { computeBestStreak } from '@/lib/stats'
import { todayISO } from '@/lib/dates'
import { ProgressRing } from '@/components/ui/ProgressRing'

export function RewardsView() {
  const tasks = useStore((s) => s.tasks)
  const progress = useStore((s) => s.progress)
  const settings = useStore((s) => s.settings)
  const level = useMemo(() => levelFromXp(progress.xp), [progress.xp])
  const streak = useMemo(
    () => computeRuleStreak(tasks, settings.streakRule ?? 'any-task', progress.freezeUsedDates),
    [tasks, settings.streakRule, progress.freezeUsedDates]
  )
  const best = useMemo(() => Math.max(computeBestStreak(tasks), progress.records.longestStreak), [tasks, progress.records.longestStreak])
  const days = useMemo(() => activityCalendar(tasks, progress.sessions, 84), [tasks, progress.sessions])
  const unlocked = useMemo(() => new Set(progress.achievements.map((a) => a.id)), [progress.achievements])
  const rec = progress.records
  const todayPct = todayCompletionPct(tasks, todayISO())

  return (
    <div className="space-y-4">
      <div>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Rewards</h2>
        <p className="text-sm text-[var(--tf-text-muted)]">Real progress from work you actually finished.</p>
      </div>

      <div className="card-rich flex flex-col items-center gap-5 p-6 sm:flex-row">
        <ProgressRing value={level.pct} size={108} stroke={9}>
          <div className="text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">Lvl</div>
            <div className="display text-[26px] font-semibold leading-none text-[var(--tf-text)]">{level.level}</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="display text-[22px] font-semibold text-[var(--tf-text)]">
            Level {level.level} — {level.title}
          </p>
          <p className="mt-1 text-[13px] tabular-nums text-[var(--tf-text-secondary)]">
            {level.xpIntoLevel.toLocaleString()} / {level.xpForLevel.toLocaleString()} XP
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--tf-surface-3)]">
            <div className="xp-bar h-full rounded-full bg-gradient-to-r from-[var(--tf-accent-light)] to-[var(--tf-accent-deep)]" style={{ width: `${level.pct}%` }} />
          </div>
          <p className="mt-2 text-[12px] text-[var(--tf-text-faint)]">{progress.xp.toLocaleString()} XP lifetime · never lost</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon={<Flame size={16} className="text-orange-500" />} label="Streak" value={`${streak}d`} sub={`Best ${best}d`} />
        <MiniStat icon={<Zap size={16} className="text-[var(--tf-accent-text)]" />} label="Today" value={`${todayPct}%`} sub="Plan complete" />
        <MiniStat icon={<Timer size={16} className="text-sky-500" />} label="Focus" value={`${rec.mostFocusMinutesInDay}m`} sub="Best day" />
        <MiniStat icon={<Award size={16} className="text-amber-500" />} label="Freezes" value={String(progress.streakFreezes)} sub="Earned by consistency" />
      </div>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">Streak calendar</h3>
          <span className="text-[11px] text-[var(--tf-text-faint)]">Last 12 weeks</span>
        </div>
        <Heatmap days={days} />
        <p className="mt-3 text-[12px] text-[var(--tf-text-muted)]">
          Streaks follow your rule in Settings. Missing a day is not punished — a freeze can cover one gap after a week of consistency.
        </p>
      </section>

      <section className="card p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-[var(--tf-text)]">Personal bests</h3>
        {rec.mostTasksInDay === 0 && progress.xp === 0 ? (
          <p className="py-4 text-center text-[13px] text-[var(--tf-text-faint)]">Complete a few tasks and your records will appear here.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <RecordRow label="Most tasks in a day" value={rec.mostTasksInDay} hint={rec.mostTasksInDayDate} />
            <RecordRow label="Longest streak" value={`${rec.longestStreak}d`} />
            <RecordRow label="Most focus minutes" value={`${rec.mostFocusMinutesInDay}m`} hint={rec.mostFocusMinutesDate} />
            <RecordRow label="Priority tasks in a day" value={rec.mostPriorityInDay} />
            <RecordRow label="Best completion" value={`${rec.bestCompletionPct}%`} />
            <RecordRow label="Most productive week" value={rec.mostProductiveWeek} />
          </div>
        )}
      </section>

      <section className="card p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-[var(--tf-text)]">Achievements</h3>
        {progress.achievements.length === 0 && (
          <p className="mb-3 text-[13px] text-[var(--tf-text-muted)]">Your first achievement is one completed task away.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((a) => {
            const on = unlocked.has(a.id)
            return (
              <div
                key={a.id}
                className={`rounded-xl border px-3.5 py-3 ${
                  on ? 'border-[var(--tf-accent)]/25 bg-[var(--tf-accent-soft)]' : 'border-[var(--tf-border)] bg-[var(--tf-surface-2)] opacity-70'
                }`}
              >
                <p className="text-[13px] font-semibold text-[var(--tf-text)]">
                  {on ? 'Unlocked' : 'Locked'} · {a.title}
                </p>
                <p className="mt-0.5 text-[12px] text-[var(--tf-text-muted)]">{a.description}</p>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function MiniStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="card flex flex-col gap-1 p-3.5">
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">
        {label}
        {icon}
      </div>
      <div className="text-[22px] font-bold tabular-nums text-[var(--tf-text)]">{value}</div>
      <div className="text-[11px] text-[var(--tf-text-faint)]">{sub}</div>
    </div>
  )
}

function RecordRow({ label, value, hint }: { label: string; value: number | string; hint?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 rounded-lg bg-[var(--tf-surface-2)] px-3 py-2">
      <span className="text-[12.5px] text-[var(--tf-text-secondary)]">{label}</span>
      <span className="text-[13px] font-semibold tabular-nums text-[var(--tf-text)]">
        {value}
        {hint ? <span className="ml-1 text-[11px] font-medium text-[var(--tf-text-faint)]">{hint}</span> : null}
      </span>
    </div>
  )
}

function Heatmap({ days }: { days: { date: string; count: number; intensity: 0 | 1 | 2 | 3 | 4 }[] }) {
  const [tip, setTip] = useState<string | null>(null)
  const cols = 12
  const cells = days
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.ceil(cells.length / 7)}, minmax(0, 1fr))` }}>
        {cells.map((d) => (
          <button
            key={d.date}
            type="button"
            aria-label={`${d.date}: ${d.count} completed`}
            onMouseEnter={() => setTip(`${d.date} · ${d.count}`)}
            onMouseLeave={() => setTip(null)}
            className="aspect-square rounded-[3px]"
            style={{ background: heatColor(d.intensity) }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--tf-text-faint)]">
        <span>{tip ?? `${cols} weeks`}</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: heatColor(i as 0 | 1 | 2 | 3 | 4) }} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}

function heatColor(i: 0 | 1 | 2 | 3 | 4): string {
  return ['var(--tf-surface-3)', 'rgb(var(--tf-accent-rgb) / 0.22)', 'rgb(var(--tf-accent-rgb) / 0.42)', 'rgb(var(--tf-accent-rgb) / 0.68)', 'var(--tf-accent)'][i]
}
