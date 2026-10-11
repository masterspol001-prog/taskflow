import { Lock, Sparkles } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { PLAN_PRICES } from '@/lib/pro'

export function ProPrompt({ feature }: { feature: string }) {
  const setPaywall = useUIStore((s) => s.setPaywall)
  const startTrial = useStore((s) => s.startTrial)
  const trialUsed = useStore((s) => s.settings.trialUsed)
  const toast = useStore((s) => s.toast)

  const tryTrial = () => {
    const res = startTrial()
    if (!res.ok) {
      toast({ title: 'Trial unavailable', message: res.error, kind: 'info' })
      setPaywall(true)
    }
  }

  return (
    <div className="card relative overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--tf-accent)_0%,transparent_45%)] opacity-20" />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--tf-accent)] to-[#f472b6] text-white shadow-lg">
          <Lock size={20} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-accent)]">TaskFlow Pro · {PLAN_PRICES.monthly.inr}/month</p>
          <h3 className="display mt-1 text-[24px] font-semibold tracking-tight text-[var(--tf-text)]">{feature} is how strategy becomes today</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--tf-text-muted)]">
            Link a goal to a task, then let Today pick the next move. {feature} plus Routines and Plan my day — {PLAN_PRICES.monthly.inr}/month after a 7-day trial.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          {trialUsed ? (
            <button className="btn btn-primary flex-1" onClick={() => setPaywall(true)}>
              <Sparkles size={15} /> Subscribe {PLAN_PRICES.monthly.inr}/mo
            </button>
          ) : (
            <button className="btn btn-primary flex-1" onClick={tryTrial}>
              <Sparkles size={15} /> Start 7-day trial
            </button>
          )}
          <button className="btn btn-secondary flex-1" onClick={() => setPaywall(true)}>
            See $10/mo
          </button>
        </div>
      </div>
    </div>
  )
}
