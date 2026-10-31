import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { ACHIEVEMENTS, levelFromXp } from '@/lib/progress'

export function LevelUpModal() {
  const lastReward = useStore((s) => s.lastReward)
  const progress = useStore((s) => s.progress)
  const reduceMotion = useStore((s) => s.settings.reduceMotion)
  const clearReward = useStore((s) => s.clearReward)
  const notifyPrefs = useStore((s) => s.settings.notifyPrefs)

  const show = !!lastReward && lastReward.leveledUp
  const info = levelFromXp(progress.xp)

  useEffect(() => {
    if (!show) return
    const t = window.setTimeout(() => clearReward(), 4200)
    return () => window.clearTimeout(t)
  }, [show, clearReward])

  if (!show || !lastReward) return null

  const achievement = lastReward.newAchievements[0]
    ? ACHIEVEMENTS.find((a) => a.id === lastReward.newAchievements[0])
    : null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Level up">
      <div className="absolute inset-0 bg-[var(--tf-overlay)] animate-fade-in backdrop-blur-sm" onClick={clearReward} />
      {lastReward.confetti && !reduceMotion && notifyPrefs?.achievements !== false && <ConfettiBurst />}
      <div className="card-rich relative z-10 w-full max-w-sm p-6 text-center animate-scale-in">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--tf-text-muted)]">Level up</p>
        <p className="display mt-2 text-[32px] font-semibold text-[var(--tf-text)]">Level {lastReward.nextLevel}</p>
        <p className="mt-1 text-sm text-[var(--tf-text-secondary)]">
          {info.title}. Your consistency is improving.
        </p>
        <p className="mt-3 text-[13px] tabular-nums text-[var(--tf-text-muted)]">
          {lastReward.prevLevel} → {lastReward.nextLevel}
          {lastReward.xpAwarded > 0 ? ` · +${lastReward.xpAwarded} XP` : ''}
        </p>
        {achievement && (
          <p className="mt-2 text-[13px] font-medium text-[var(--tf-accent-text)]">{achievement.title}</p>
        )}
        <button className="btn btn-primary mt-5 w-full" onClick={clearReward}>
          Continue
        </button>
      </div>
    </div>
  )
}

function ConfettiBurst() {
  const bits = Array.from({ length: 18 }, (_, i) => i)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {bits.map((i) => (
        <span
          key={i}
          className="confetti-bit absolute top-1/3 left-1/2 h-2 w-2 rounded-sm"
          style={{
            background: i % 3 === 0 ? 'var(--tf-accent)' : i % 3 === 1 ? '#e8b86d' : '#f4efe6',
            transform: `translate(-50%, -50%) rotate(${i * 20}deg)`,
            animationDelay: `${i * 18}ms`,
            ['--dx' as string]: `${(i % 2 === 0 ? 1 : -1) * (40 + (i * 13) % 120)}px`,
            ['--dy' as string]: `${80 + (i * 17) % 140}px`,
          }}
        />
      ))}
    </div>
  )
}
