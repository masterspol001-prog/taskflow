import { useState } from 'react'
import { Check, Crown, Sparkles, KeyRound } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { PLAN_PRICES, checkoutUrl, isTrialing, trialDaysLeft } from '@/lib/pro'
import type { BillingInterval } from '@/lib/types'

const PLANS: { id: BillingInterval; name: string; highlight?: boolean; perks: string[] }[] = [
  {
    id: 'monthly',
    name: 'Pro Monthly',
    perks: ['Goals & routines', 'Calendar analytics', 'AI day planning'],
  },
  {
    id: 'annual',
    name: 'Pro Annual',
    highlight: true,
    perks: ['Everything in Monthly', '2 months free', 'Priority support'],
  },
  {
    id: 'lifetime',
    name: 'Pro Lifetime',
    perks: ['Pay once', 'All future updates', 'Best for power users'],
  },
]

export function PaywallModal() {
  const open = useUIStore((s) => s.paywallOpen)
  const setPaywall = useUIStore((s) => s.setPaywall)
  const settings = useStore((s) => s.settings)
  const startTrial = useStore((s) => s.startTrial)
  const redeemLicense = useStore((s) => s.redeemLicense)
  const openCheckout = useStore((s) => s.openCheckout)
  const toast = useStore((s) => s.toast)
  const [active, setActive] = useState<BillingInterval>('annual')
  const [license, setLicense] = useState('')
  const [busy, setBusy] = useState(false)

  const trialing = isTrialing(settings)
  const licensed = !!settings.licenseKey
  const days = trialDaysLeft(settings)
  const buyUrl = checkoutUrl(settings, active)

  const buy = () => {
    const res = openCheckout(active)
    if (!res.ok) {
      toast({
        title: 'Checkout not configured',
        message: res.error ?? 'Add a Lemon Squeezy or Stripe link in Settings.',
        kind: 'info',
      })
    }
  }

  const trial = () => {
    const res = startTrial()
    if (res.ok) setPaywall(false)
    else toast({ title: 'Trial unavailable', message: res.error, kind: 'info' })
  }

  const redeem = () => {
    setBusy(true)
    const res = redeemLicense(license)
    setBusy(false)
    if (res.ok) {
      setLicense('')
      setPaywall(false)
    } else {
      toast({ title: 'Invalid license', message: res.error, kind: 'error' })
    }
  }

  return (
    <Modal open={open} onClose={() => setPaywall(false)} title={undefined} size="md">
      <div className="space-y-4">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--tf-accent)] to-[#f472b6] text-white shadow-lg">
            <Crown size={22} />
          </span>
          <h3 className="display mt-3 text-[26px] font-semibold tracking-tight text-[var(--tf-text)]">
            {licensed ? 'You are on Pro' : trialing ? 'Pro trial active' : 'Go Pro'}
          </h3>
          <p className="mt-1 text-sm text-[var(--tf-text-muted)]">
            {licensed
              ? 'Goals, routines, analytics and AI planning are unlocked on this device.'
              : trialing
              ? `${days} day${days === 1 ? '' : 's'} left. Buy a license to keep Pro after the trial.`
              : 'Goals, routines, analytics and AI planning — try free for 7 days, then buy a license.'}
          </p>
        </div>

        {licensed ? (
          <button className="btn btn-secondary w-full" onClick={() => setPaywall(false)}>
            <Check size={15} /> You're all set
          </button>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              {PLANS.map((p) => {
                const price = PLAN_PRICES[p.id]
                return (
                  <button
                    key={p.id}
                    onClick={() => setActive(p.id)}
                    className={`relative rounded-2xl border p-3.5 text-left transition-all ${
                      active === p.id
                        ? 'border-[var(--tf-accent)] bg-[var(--tf-accent)]/5'
                        : 'border-[var(--tf-border)] hover:border-[var(--tf-border-strong)]'
                    }`}
                  >
                    {p.highlight && (
                      <span className="absolute -top-2 right-2 rounded-full bg-[var(--tf-accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                        BEST VALUE
                      </span>
                    )}
                    <p className="text-sm font-semibold text-[var(--tf-text)]">{p.name}</p>
                    <p className="mt-0.5 text-lg font-bold text-[var(--tf-text)]">
                      {price.inr}
                      <span className="text-xs font-normal text-[var(--tf-text-muted)]"> {price.per}</span>
                    </p>
                    <ul className="mt-2 space-y-1">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex items-center gap-1.5 text-xs text-[var(--tf-text-secondary)]">
                          <Check size={12} className="text-[var(--tf-accent)]" /> {perk}
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </div>

            <button className="btn btn-primary w-full" onClick={buy}>
              Buy {PLANS.find((p) => p.id === active)?.name}
            </button>
            {!buyUrl && (
              <p className="text-center text-xs text-[var(--tf-text-muted)]">
                Add your Lemon Squeezy or Stripe checkout URL in Settings to sell Pro.
              </p>
            )}

            {!settings.trialUsed && (
              <button className="btn btn-secondary w-full" onClick={trial}>
                <Sparkles size={15} /> Start 7-day free trial
              </button>
            )}

            <div className="rounded-2xl border border-[var(--tf-border)] p-3">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--tf-text-muted)]">
                <KeyRound size={12} /> Already bought? Redeem license
              </label>
              <div className="flex gap-2">
                <input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="TF-YR-XXXXXXXX-XXXX"
                  className="input min-w-0 flex-1 font-mono text-xs"
                  aria-label="License key"
                  onKeyDown={(e) => e.key === 'Enter' && redeem()}
                />
                <button className="btn btn-secondary btn-sm" onClick={redeem} disabled={busy || !license.trim()}>
                  Redeem
                </button>
              </div>
            </div>

            <button className="btn btn-ghost w-full text-sm text-[var(--tf-text-muted)]" onClick={() => setPaywall(false)}>
              {trialing ? 'Continue trial' : 'No thanks, stay on Free'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
