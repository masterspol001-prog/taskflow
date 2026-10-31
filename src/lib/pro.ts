import type { BillingInterval, Settings } from '@/lib/types'
import { decodeLicensePayload } from '@/lib/license'

export const TRIAL_DAYS = 7

export const FREE_LIMITS = {
  activeTasks: 40,
  projects: 3,
} as const

/** Public USD pricing. */
export const PLAN_PRICES = {
  monthly: { price: '$10', per: ' / 32 days' },
  annual: { price: '$72', per: ' / 366 days' },
  lifetime: { price: '$149', per: ' one-time' },
} as const

/** USD charged for each plan. Kept for display + analytics, not for unlocking. */
export const PLAN_AMOUNTS_USD = {
  monthly: 10,
  annual: 72,
  lifetime: 149,
} as const

/** Default term length handed to the issuer tooling. The signed key carries the real expiry. */
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

export const EMPTY_CHECKOUT = {
  monthly: '',
  annual: '',
  lifetime: '',
} as const

function envCheckout(interval: BillingInterval): string {
  const env =
    interval === 'monthly'
      ? import.meta.env.VITE_CHECKOUT_MONTHLY_URL
      : interval === 'annual'
        ? import.meta.env.VITE_CHECKOUT_ANNUAL_URL
        : import.meta.env.VITE_CHECKOUT_LIFETIME_URL
  return typeof env === 'string' ? env.trim() : ''
}

/** https only. Blocks javascript: and relative attacker URLs. */
export function isSafeCheckoutUrl(raw: string | null | undefined): boolean {
  const value = String(raw ?? '').trim()
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function payloadOf(s: Settings) {
  return decodeLicensePayload(s.licenseKey)
}

/**
 * A license is valid when a signed key was verified on this device and has not expired.
 * Unsigned decode is never enough for Pro.
 */
export function licenseValid(s: Settings, now = Date.now()): boolean {
  if (!s.licenseVerified) return false
  const p = payloadOf(s)
  if (!p) return false
  if (p.exp != null && now >= p.exp) return false
  return true
}

export function isLicenseLapsed(s: Settings, now = Date.now()): boolean {
  const p = payloadOf(s)
  return !!p && p.exp != null && now >= p.exp
}

export function isTrialing(s: Settings, now = Date.now()): boolean {
  return !!s.trialEndsAt && now < s.trialEndsAt && !licenseValid(s, now)
}

export function trialDaysLeft(s: Settings, now = Date.now()): number {
  if (!s.trialEndsAt) return 0
  return Math.max(0, Math.ceil((s.trialEndsAt - now) / 86_400_000))
}

export function licenseDaysLeft(s: Settings, now = Date.now()): number {
  const p = payloadOf(s)
  if (!p || p.exp == null) return 0
  return Math.max(0, Math.ceil((p.exp - now) / 86_400_000))
}

/**
 * Temporary: every feature is included and Free caps are off.
 * Flip to false to restore Pro paywall, checkout, and limits.
 * License redeem / verify / revoke stay in the codebase.
 */
export const FEATURES_UNLOCKED = true

/** Honest entitlement: verified license or unexpired trial. Used when pay returns. */
export function entitledPro(s: Settings, now = Date.now()): boolean {
  if (licenseValid(s, now)) return true
  if (s.trialEndsAt && now < s.trialEndsAt) return true
  return false
}

export function isPro(s: Settings, now = Date.now()): boolean {
  if (FEATURES_UNLOCKED) return true
  return entitledPro(s, now)
}

export function activeTaskCount(tasks: { archived: boolean; completed?: boolean }[]): number {
  return tasks.filter((t) => !t.archived && !t.completed).length
}

export function canAddTask(s: Settings, tasks: { archived: boolean; completed?: boolean }[]): boolean {
  if (FEATURES_UNLOCKED || isPro(s)) return true
  return activeTaskCount(tasks) < FREE_LIMITS.activeTasks
}

export function canAddProject(s: Settings, projects: { archived: boolean }[]): boolean {
  if (FEATURES_UNLOCKED || isPro(s)) return true
  return projects.filter((p) => !p.archived).length < FREE_LIMITS.projects
}

export function canAddGoal(s: Settings): boolean {
  if (FEATURES_UNLOCKED) return true
  return isPro(s)
}

export function checkoutUrl(s: Settings, interval: BillingInterval): string {
  const fromSettings = s.checkout?.[interval]?.trim() ?? ''
  if (isSafeCheckoutUrl(fromSettings)) return fromSettings
  const fromEnv = envCheckout(interval)
  if (isSafeCheckoutUrl(fromEnv)) return fromEnv
  return ''
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

/** Dev-server only. Restarts the real 7-day trial so Pro can be tested without a signed key. */
export function isDevUnlock(mode = import.meta.env.MODE): boolean {
  return mode === 'development'
}

export function devUnlockPatch(s: Settings, now = Date.now(), mode = import.meta.env.MODE): Partial<Settings> | null {
  if (!isDevUnlock(mode)) return null
  if (licenseValid(s, now)) return null
  if (s.trialEndsAt && now < s.trialEndsAt && s.plan === 'pro') return null
  return trialSettingsPatch(now)
}

export function planLabel(interval: BillingInterval | null | undefined): string {
  if (interval === 'annual') return 'Annual'
  if (interval === 'lifetime') return 'Lifetime'
  if (interval === 'monthly') return 'Monthly'
  return 'Pro'
}

export function termCopy(interval: BillingInterval | null | undefined): string {
  if (interval === 'lifetime') return 'Lifetime on this device. No expiry.'
  if (interval === 'annual') return '366-day prepaid license on this device. Not a subscription.'
  return '32-day prepaid license on this device. Not a subscription.'
}
