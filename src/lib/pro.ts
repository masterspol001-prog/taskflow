import type { BillingInterval, Settings } from '@/lib/types'
import { validateLicenseKey } from '@/lib/license'

export const TRIAL_DAYS = 7

export const FREE_LIMITS = {
  activeTasks: 40,
  projects: 3,
} as const

export const PLAN_PRICES = {
  monthly: { inr: '$10', usd: '$10', per: '/month' },
  annual: { inr: '$72', usd: '$72', per: '/year' },
  lifetime: { inr: '$149', usd: '$149', per: 'one-time' },
} as const

/** USD charged for each plan. Annual is $10 × 12 with 40% off. */
export const PLAN_AMOUNTS_INR = {
  monthly: 10,
  annual: 72,
  lifetime: 149,
} as const

/** Honor-system term length. Monthly billed every 32 days so a late confirm does not immediately lapse. */
export const LICENSE_DAYS: Record<BillingInterval, number> = {
  monthly: 32,
  annual: 366,
  lifetime: 0,
}

export const PLAN_RANK: Record<BillingInterval, number> = {
  monthly: 1,
  annual: 2,
  lifetime: 3,
}

export function parsePaidAmountInr(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/\$/g, '')
    .replace(/usd/gi, '')
    .replace(/₹/g, '')
    .replace(/rs\.?/gi, '')
    .replace(/inr/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

export function matchPlanByAmount(amount: number): BillingInterval | null {
  if (amount === PLAN_AMOUNTS_INR.monthly) return 'monthly'
  if (amount === PLAN_AMOUNTS_INR.annual) return 'annual'
  if (amount === PLAN_AMOUNTS_INR.lifetime) return 'lifetime'
  return null
}

export function licenseExpiresAt(interval: BillingInterval, now = Date.now()): number | null {
  if (interval === 'lifetime') return null
  return now + LICENSE_DAYS[interval] * 86_400_000
}

export const RAZORPAY_PAY_URL = 'https://razorpay.me/@prathameshpraveenkulkarni'

export const DEFAULT_CHECKOUT = {
  monthly: RAZORPAY_PAY_URL,
  annual: RAZORPAY_PAY_URL,
  lifetime: RAZORPAY_PAY_URL,
} as const

export function licenseValid(s: Settings, now = Date.now()): boolean {
  if (!validateLicenseKey(s.licenseKey ?? '').ok) return false
  if (s.licenseInterval === 'lifetime') return true
  if (s.licenseExpiresAt && now >= s.licenseExpiresAt) return false
  return true
}

export function isLicenseLapsed(s: Settings, now = Date.now()): boolean {
  return !!s.licenseKey && validateLicenseKey(s.licenseKey).ok && !!s.licenseExpiresAt && now >= s.licenseExpiresAt
}

export function isTrialing(s: Settings, now = Date.now()): boolean {
  return !!s.trialEndsAt && now < s.trialEndsAt && !licenseValid(s, now)
}

export function trialDaysLeft(s: Settings, now = Date.now()): number {
  if (!s.trialEndsAt) return 0
  return Math.max(0, Math.ceil((s.trialEndsAt - now) / 86_400_000))
}

export function licenseDaysLeft(s: Settings, now = Date.now()): number {
  if (!s.licenseExpiresAt) return 0
  return Math.max(0, Math.ceil((s.licenseExpiresAt - now) / 86_400_000))
}

export function isPro(s: Settings, now = Date.now()): boolean {
  if (licenseValid(s, now)) return true
  if (s.trialEndsAt && now < s.trialEndsAt) return true
  return false
}

export function activeTaskCount(tasks: { archived: boolean; completed?: boolean }[]): number {
  return tasks.filter((t) => !t.archived && !t.completed).length
}

export function canAddTask(s: Settings, tasks: { archived: boolean; completed?: boolean }[]): boolean {
  if (isPro(s)) return true
  return activeTaskCount(tasks) < FREE_LIMITS.activeTasks
}

export function canAddProject(s: Settings, projects: { archived: boolean }[]): boolean {
  if (isPro(s)) return true
  return projects.filter((p) => !p.archived).length < FREE_LIMITS.projects
}

export function checkoutUrl(s: Settings, interval: BillingInterval): string {
  const fromSettings = s.checkout?.[interval]?.trim() ?? ''
  if (fromSettings) return fromSettings
  const env =
    interval === 'monthly'
      ? import.meta.env.VITE_CHECKOUT_MONTHLY_URL
      : interval === 'annual'
        ? import.meta.env.VITE_CHECKOUT_ANNUAL_URL
        : import.meta.env.VITE_CHECKOUT_LIFETIME_URL
  if (typeof env === 'string' && env.trim()) return env.trim()
  return RAZORPAY_PAY_URL
}

export function expiredTrialPatch(s: Settings, now = Date.now()): Partial<Settings> | null {
  if (licenseValid(s, now)) {
    if (s.plan !== 'pro') return { plan: 'pro' }
    return null
  }
  if (s.trialEndsAt && now < s.trialEndsAt) {
    if (s.plan !== 'pro') return { plan: 'pro' }
    return null
  }
  if (s.plan === 'pro') return { plan: 'free' }
  return null
}

export function shouldAutoStartTrial(s: Settings, now = Date.now()): boolean {
  if (licenseValid(s, now)) return false
  if (s.trialUsed) return false
  if (s.trialEndsAt && now < s.trialEndsAt) return false
  return true
}

export function trialSettingsPatch(now = Date.now()): Pick<Settings, 'plan' | 'trialEndsAt' | 'trialUsed'> {
  return {
    plan: 'pro',
    trialEndsAt: now + TRIAL_DAYS * 86_400_000,
    trialUsed: true,
  }
}

export function planLabel(interval: BillingInterval | null | undefined): string {
  if (interval === 'annual') return 'Annual'
  if (interval === 'lifetime') return 'Lifetime'
  if (interval === 'monthly') return 'Monthly'
  return 'Pro'
}
