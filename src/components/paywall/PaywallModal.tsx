import { useState } from 'react'
import { Check, Copy, Crown, Sparkles, KeyRound } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import {
  PLAN_AMOUNTS_INR,
  PLAN_PRICES,
  isLicenseLapsed,
  isTrialing,
  licenseDaysLeft,
  planLabel,
  trialDaysLeft,
} from '@/lib/pro'
import type { BillingInterval } from '@/lib/types'

const PLANS: { id: BillingInterval; name: string; highlight?: boolean; perks: string[] }[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    highlight: true,
    perks: ['Goals that drive Today', 'Routines & weekly review', 'Plan my day'],
  },
  {
    id: 'annual',
    name: 'Annual',
    perks: ['Everything in Monthly', 'Save 40% vs monthly', 'Best for staying subscribed'],
  },
]

export function PaywallModal() {
  const open = useUIStore((s) => s.paywallOpen)
  const setPaywall = useUIStore((s) => s.setPaywall)
  const settings = useStore((s) => s.settings)
  const startTrial = useStore((s) => s.startTrial)
  const redeemLicense = useStore((s) => s.redeemLicense)
  const openCheckout = useStore((s) => s.openCheckout)
  const confirmPayment = useStore((s) => s.confirmPayment)
  const toast = useStore((s) => s.toast)
  const [active, setActive] = useState<BillingInterval>('monthly')
  const [license, setLicense] = useState('')
  const [busy, setBusy] = useState(false)
  const [awaitingPayment, setAwaitingPayment] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [paidConfirm, setPaidConfirm] = useState(false)
  const [showLifetime, setShowLifetime] = useState(false)

  const trialing = isTrialing(settings)
  const licensed = !!settings.licenseKey && !isLicenseLapsed(settings)
  const lapsed = isLicenseLapsed(settings)
  const days = trialDaysLeft(settings)
  const renewDays = licenseDaysLeft(settings)

  const buy = (interval: BillingInterval = active) => {
    const res = openCheckout(interval)
    if (!res.ok) {
      toast({ title: 'Checkout unavailable', message: res.error, kind: 'info' })
      return
    }
    setActive(interval)
    setPaidAmount(String(PLAN_AMOUNTS_INR[interval]))
    setPaidConfirm(false)
    setAwaitingPayment(true)
  }

  const confirmPaid = () => {
    if (!paidConfirm) {
      toast({ title: 'Confirm you paid', message: 'Check the box after Razorpay shows Paid.', kind: 'info' })
      return
    }
    setBusy(true)
    const res = confirmPayment(paidAmount)
    setBusy(false)
    if (res.ok) {
      setPaidAmount('')
      setAwaitingPayment(false)
      setPaidConfirm(false)
    } else {
      toast({ title: 'Payment not matched', message: res.error, kind: 'error' })
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

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(settings.licenseKey)
      toast({ title: 'License copied', kind: 'success' })
    } catch {
      toast({ title: 'Copy failed', message: 'Select the key and copy it yourself.', kind: 'info' })
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
            {licensed
              ? `${planLabel(settings.licenseInterval)} Pro`
              : lapsed
                ? 'Renew Pro to keep going'
                : trialing
                  ? 'Pro trial active'
                  : 'Turn today into a system'}
          </h3>
          <p className="mt-1 text-sm text-[var(--tf-text-muted)]">
            {licensed
              ? settings.licenseInterval === 'lifetime'
                ? 'Goals, routines, and Plan my day stay unlocked on this device.'
                : renewDays > 0
                  ? `${renewDays} day${renewDays === 1 ? '' : 's'} left in this ${planLabel(settings.licenseInterval).toLowerCase()} term. Renew before it lapses.`
                  : 'Your plan is active on this device.'
              : lapsed
                ? 'Your term ended. Pay the same amount on Razorpay, then confirm here to keep Pro.'
                : trialing
                  ? `${days} day${days === 1 ? '' : 's'} left. Subscribe for $10/month to keep Goals and Plan my day.`
                  : 'Free is 40 tasks and 3 projects. Pro is $10/month — Goals, Routines, and a planned day.'}
          </p>
        </div>

        {licensed ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--tf-border)] p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">License on this device</p>
              <p className="break-all font-mono text-[12px] text-[var(--tf-text)]">{settings.licenseKey}</p>
              <button className="btn btn-ghost btn-sm mt-2" onClick={copyKey}>
                <Copy size={13} /> Copy key
              </button>
            </div>
            {settings.licenseInterval !== 'lifetime' && (
              <button className="btn btn-primary w-full" onClick={() => buy(settings.licenseInterval ?? 'monthly')}>
                Renew {planLabel(settings.licenseInterval)} · {PLAN_PRICES[settings.licenseInterval ?? 'monthly'].inr}
              </button>
            )}
            <button className="btn btn-secondary w-full" onClick={() => setPaywall(false)}>
              <Check size={15} /> Continue
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
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
                        START HERE
                      </span>
                    )}
                    <p className="text-sm font-semibold text-[var(--tf-text)]">{p.name}</p>
                    <p className="mt-0.5 text-lg font-bold text-[var(--tf-text)]">
                      {price.inr}
                      <span className="text-xs font-normal text-[var(--tf-text-muted)]"> {price.per}</span>
                    </p>
                    {p.id === 'annual' && (
                      <p className="text-[11px] text-[var(--tf-text-muted)]">$6/month equivalent</p>
                    )}
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

            {awaitingPayment ? (
              <div className="space-y-2 rounded-2xl border border-[var(--tf-accent)]/40 bg-[var(--tf-accent)]/5 p-3">
                <p className="text-sm font-semibold text-[var(--tf-text)]">Paid on Razorpay?</p>
                <p className="text-xs text-[var(--tf-text-muted)]">
                  Type exactly ${PLAN_PRICES[active].usd} on checkout. Then confirm here to unlock {PLANS.find((p) => p.id === active)?.name ?? 'Pro'} on this device.
                </p>
                <label className="flex items-start gap-2 text-[12.5px] text-[var(--tf-text-secondary)]">
                  <input type="checkbox" checked={paidConfirm} onChange={(e) => setPaidConfirm(e.target.checked)} className="mt-0.5" />
                  I paid this amount on Razorpay
                </label>
                <div className="flex gap-2">
                  <input
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={String(PLAN_AMOUNTS_INR[active])}
                    inputMode="numeric"
                    className="input min-w-0 flex-1 font-mono text-sm"
                    aria-label="Amount paid in USD"
                    onKeyDown={(e) => e.key === 'Enter' && confirmPaid()}
                  />
                  <button className="btn btn-primary btn-sm" onClick={confirmPaid} disabled={busy || !paidAmount.trim() || !paidConfirm}>
                    Unlock
                  </button>
                </div>
                <button className="btn btn-ghost w-full text-xs text-[var(--tf-text-muted)]" onClick={() => setAwaitingPayment(false)}>
                  Back to plans
                </button>
              </div>
            ) : (
              <>
                <button className="btn btn-primary w-full" onClick={() => buy()}>
                  Subscribe {active === 'annual' ? 'annually' : 'monthly'} · {PLAN_PRICES[active].inr}
                </button>
                <p className="text-center text-xs text-[var(--tf-text-muted)]">
                  Razorpay opens in a new tab. Pay {PLAN_PRICES[active].inr}, then come back and confirm.
                </p>
              </>
            )}

            {!settings.trialUsed && (
              <button className="btn btn-secondary w-full" onClick={trial}>
                <Sparkles size={15} /> Start 7-day free trial
              </button>
            )}

            <div className="rounded-2xl border border-[var(--tf-border)] p-3">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--tf-text-muted)]">
                <KeyRound size={12} /> Already have a license?
              </label>
              <div className="flex gap-2">
                <input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="TF-MO-XXXXXXXX-XXXX"
                  className="input min-w-0 flex-1 font-mono text-xs"
                  aria-label="License key"
                  onKeyDown={(e) => e.key === 'Enter' && redeem()}
                />
                <button className="btn btn-secondary btn-sm" onClick={redeem} disabled={busy || !license.trim()}>
                  Redeem
                </button>
              </div>
            </div>

            {showLifetime ? (
              <button className="btn btn-ghost w-full text-sm text-[var(--tf-text-muted)]" onClick={() => buy('lifetime')}>
                Pay once · Lifetime {PLAN_PRICES.lifetime.inr}
              </button>
            ) : (
              <button className="btn btn-ghost w-full text-xs text-[var(--tf-text-faint)]" onClick={() => setShowLifetime(true)}>
                Looking for lifetime?
              </button>
            )}

            <button className="btn btn-ghost w-full text-sm text-[var(--tf-text-muted)]" onClick={() => setPaywall(false)}>
              {trialing ? 'Continue trial' : 'Stay on Free · 40 tasks, 3 projects'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
