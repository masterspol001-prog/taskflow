import { Lock, Sparkles, Zap } from 'lucide-react'
import { useUIStore } from '@/store/useUIStore'

export function ProPrompt({ feature }: { feature: string }) {
  const setPaywall = useUIStore((s) => s.setPaywall)
  return (
    <div className="card relative overflow-hidden p-8 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--tf-accent)_0%,transparent_45%)] opacity-20" />
      <div className="relative mx-auto flex max-w-sm flex-col items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--tf-accent)] to-[#f472b6] text-white shadow-lg">
          <Lock size={20} />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--tf-accent)]">TaskFlow Pro</p>
          <h3 className="display mt-1 text-[24px] font-semibold tracking-tight text-[var(--tf-text)]">{feature} is a Pro feature</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--tf-text-muted)]">
            Go beyond daily task lists with {feature.toLowerCase()}, routine scheduling, and AI planning.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button className="btn btn-primary flex-1" onClick={() => setPaywall(true)}>
            <Sparkles size={15} /> Unlock with Pro
          </button>
          <button className="btn btn-ghost flex-1" onClick={() => setPaywall(true)}>
            <Zap size={15} /> See plans
          </button>
        </div>
      </div>
    </div>
  )
}
