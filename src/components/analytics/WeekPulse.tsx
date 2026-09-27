import { useMemo } from 'react'
import { BarChart3, Brain, Flame, Lock, Trophy } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { dayPulse, completionStreak, productiveHours } from '@/lib/analytics'
import { isPro } from '@/lib/pro'
import type { Task } from '@/lib/types'

export function WeekPulse({ tasks }: { tasks: Task[] }) {
  const settings = useStore((s) => s.settings)
  const plan = isPro(settings)

  if (!plan) return <WeekPulseTeaser />

  return <WeekPulseFull tasks={tasks} />
}

function WeekPulseFull({ tasks }: { tasks: Task[] }) {
  const pulse = useMemo(() => dayPulse(tasks, 7), [tasks])
  const streak = useMemo(() => completionStreak(tasks), [tasks])
  const topHour = useMemo(() => {
    const hrs = productiveHours(tasks)
    if (hrs.length === 0) return null
    return hrs.reduce((a, b) => (b.count > a.count ? b : a))
  }, [tasks])
  const total = pulse.reduce((s, d) => s + d.count, 0)
  const best = Math.max(1, ...pulse.map((d) => d.count))
  const maxBar = 64

  const hourLabel = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hr = h % 12 === 0 ? 12 : h % 12
    return `${hr}${ampm}`
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="display flex items-center gap-2 text-[18px] font-semibold text-[var(--tf-text)]">
          <BarChart3 size={15} className="text-[var(--tf-accent)]" /> Weekly pulse
        </h3>
        <div className="flex items-center gap-3 text-xs text-[var(--tf-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <Trophy size={13} className="text-[var(--tf-accent)]" /> {total} done this week
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame size={13} className="text-orange-500" /> {streak}-day streak
          </span>
        </div>
      </div>

      <div className="flex h-20 items-end justify-between gap-2">
        {pulse.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className={`text-[10px] font-semibold tabular-nums ${d.count ? 'text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text-faint)]'}`}>
              {d.count || ''}
            </span>
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-[var(--tf-accent-deep)] to-[var(--tf-accent-light)] transition-all duration-500"
              style={{ height: `${Math.max(4, (d.count / best) * maxBar)}px`, opacity: d.count ? 1 : 0.12 }}
              title={`${d.date}: ${d.count} completed`}
            />
            <span className={`text-[10px] ${d.date === pulse[pulse.length - 1].date ? 'font-bold text-[var(--tf-accent-text)]' : 'text-[var(--tf-text-faint)]'}`}>
              {d.label}
            </span>
          </div>
        ))}
      </div>

      {topHour && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--tf-surface-2)] p-2.5 text-xs text-[var(--tf-text-secondary)]">
          <Brain size={13} className="mt-0.5 shrink-0 text-[var(--tf-accent)]" />
          <span>
            Insight: you tend to complete the most around <b className="text-[var(--tf-text)]">{hourLabel(topHour.hour)}</b>. Try
            protecting that window for your hardest tasks.
          </span>
        </p>
      )}
    </div>
  )
}

function WeekPulseTeaser() {
  const setPaywall = useUIStore((s) => s.setPaywall)
  return (
    <button
      onClick={() => setPaywall(true)}
      className="card card-hover flex w-full items-center gap-3 p-4 text-left"
      aria-label="Unlock weekly analytics with TaskFlow Pro"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--tf-accent)] to-[#f472b6] text-white">
        <Lock size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--tf-text)]">Weekly pulse is a Pro feature</span>
        <span className="block text-xs text-[var(--tf-text-muted)]">See your completion trend and keep your streak alive.</span>
      </span>
      <span className="text-xs font-semibold text-[var(--tf-accent-text)]">Unlock</span>
    </button>
  )
}
