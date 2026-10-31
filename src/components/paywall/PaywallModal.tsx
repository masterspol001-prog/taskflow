import { useState } from 'react'
import { Check, Copy, Crown, Sparkles, KeyRound, ExternalLink, ShieldCheck } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import {
  PLAN_PRICES,
  isLicenseLapsed,
  isTrialing,
  licenseDaysLeft,
  planLabel,
  trialDaysLeft,
} from '@/lib/pro'
import { decodeLicensePayload } from '@/lib/license'
import type { BillingInterval } from '@/lib/types'

const PLANS: { id: BillingInterval; name: string; highlight?: boolean; perks: string[] }[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    highlight: true,
    perks: ['32-day prepaid license', 'Goals, Routines, Plan, Review', 'On-device ranking — not AI'],
  },
  {
    id: 'annual',
    name: 'Annual',
    perks: ['366-day prepaid license', 'Save 40% vs monthly', 'Same Pro features'],
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
  const [active, setActive] = useState<BillingInterval>('monthly')
  const [license, setLicense] = useState('')
  const [busy, setBusy] = useState(false)
  const [awaitingKey, setAwaitingKey] = useState(false)
  const [showLifetime, setShowLifetime] = useState(false)

  const trialing = isTrialing(settings)
  const licensed = !!settings.licenseKey && !isLicenseLapsed(settings)
  const lapsed = isLicenseLapsed(settings)
  const days = trialDaysLeft(settings)
  const renewDays = licenseDaysLeft(settings)
  const payload = decodeLicensePayload(settings.licenseKey)

  const buy = (interval: BillingInterval = active) => {
    const res = openCheckout(interval)
    if (!res.ok) {
      toast({ title: 'Checkout unavailable', message: res.error, kind: 'info' })
      return
    }
    setActive(interval)
    setAwaitingKey(true)
  }

  const trial = () => {
    const res = startTrial()
    if (res.ok) setPaywall(false)
    else toast({ title: 'Trial unavailable', message: res.error, kind: 'info' })
  }

  const redeem = async () => {
    setBusy(true)
    const res = await redeemLicense(license)
    setBusy(false)
    if (res.ok) {
      setLicense('')
      setAwaitingKey(false)
      setPaywall(false)
    } else {
      toast({ title: 'Could not activate', message: res.error, kind: 'error' })
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
        <Modal open={open} onClose={() => setPaywall(false)} title="TaskFlow Pro" size="md">
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
                  ? `${renewDays} day${renewDays === 1 ? '' : 's'} left in this ${planLabel(settings.licenseInterval).toLowerCase()} term.`
                  : 'Your plan is active on this device.'
              : lapsed
                ? 'Your term ended. Buy again below and activate the new key to keep Pro.'
                : trialing
                  ? `${days} day${days === 1 ? '' : 's'} left. Buy a ${PLAN_PRICES.monthly.price} 32-day license to keep Goals, Plan, and Review.`
                  : `Free is 40 tasks and 3 projects. Pro is a prepaid license — ${PLAN_PRICES.monthly.price} / 32 days. Not a subscription.`}
          </p>
        </div>

        {licensed ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-[var(--tf-border)] p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">
                License · {settings.licenseInterval === 'lifetime' ? 'Lifetime' : planLabel(settings.licenseInterval)}
              </p>
              <p className="text-[12.5px] text-[var(--tf-text)]">
                Key ID <span className="font-mono">{payload?.id ?? '—'}</span>
                {payload?.sub ? <> · {payload.sub}</> : null}
              </p>
              {settings.licenseInterval !== 'lifetime' && payload?.exp ? (
                <p className="text-[12px] text-[var(--tf-text-muted)]">Expires {new Date(payload.exp).toLocaleDateString()} · buy again and paste a new key</p>
              ) : null}
              <button className="btn btn-ghost btn-sm mt-2" onClick={copyKey}>
                <Copy size={13} /> Copy full key
              </button>
            </div>
            {settings.licenseInterval !== 'lifetime' && (
              <button className="btn btn-primary w-full" onClick={() => buy(settings.licenseInterval ?? 'monthly')}>
                <ExternalLink size={14} /> Renew {planLabel(settings.licenseInterval)} · {PLAN_PRICES[settings.licenseInterval ?? 'monthly'].price}
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
                      {price.price}
                      <span className="text-xs font-normal text-[var(--tf-text-muted)]"> {price.per}</span>
                    </p>
                    {p.id === 'annual' && <p className="text-[11px] text-[var(--tf-text-muted)]">$6/month equivalent</p>}
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

              <button className="btn btn-primary w-full" onClick={() => buy()}>
              <ExternalLink size={15} /> Buy {active === 'annual' ? '366-day' : '32-day'} license · {PLAN_PRICES[active].price}
            </button>
            {awaitingKey && (
              <p className="rounded-xl border border-[var(--tf-accent)]/40 bg-[var(--tf-accent)]/5 p-2.5 text-center text-xs text-[var(--tf-text-secondary)]">
                Checkout opened in a new tab. After the seller confirms payment, you receive a TF1.… key (manual until webhooks are wired). Paste it below to activate on this device.
              </p>
            )}

            {!settings.trialUsed && (
              <button className="btn btn-secondary w-full" onClick={trial}>
                <Sparkles size={15} /> Start 7-day free trial
              </button>
            )}

            <div className="rounded-2xl border border-[var(--tf-border)] p-3">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--tf-text-muted)]">
                <KeyRound size={12} /> Activate a license key
              </label>
              <div className="flex gap-2">
                <input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  placeholder="TF1.…"
                  className="input min-w-0 flex-1 font-mono text-xs"
                  aria-label="License key"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void redeem()
                  }}
                />
                <button className="btn btn-secondary btn-sm" onClick={() => void redeem()} disabled={busy || !license.trim()}>
                  {busy ? 'Activating…' : 'Activate'}
                </button>
              </div>
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-[var(--tf-text-faint)]">
                <ShieldCheck size={12} className="mt-0.5 shrink-0" />
                Prepaid key, signed by the seller, verified on this device. Tasks stay in this browser. See Privacy and Refund.
              </p>
            </div>

            {showLifetime ? (
              <button className="btn btn-ghost w-full text-sm text-[var(--tf-text-muted)]" onClick={() => buy('lifetime')}>
                Pay once · Lifetime {PLAN_PRICES.lifetime.price}
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
