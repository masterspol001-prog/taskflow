import type { Settings } from '@/lib/types'
import { validateLicenseKey } from '@/lib/license'

export const TRIAL_DAYS = 7

export const FREE_LIMITS = {
  activeTasks: 40,
  projects: 3,
} as const

export const PLAN_PRICES = {
  monthly: { inr: '₹499', usd: '$9', per: '/month' },
  annual: { inr: '₹299', usd: '$7', per: '/month, billed yearly' },
  lifetime: { inr: '₹4,990', usd: '$59', per: 'one-time' },
} as const

export function licenseValid(s: Settings): boolean {
  return validateLicenseKey(s.licenseKey ?? '').ok
}

export function isTrialing(s: Settings, now = Date.now()): boolean {
  return !!s.trialEndsAt && now < s.trialEndsAt && !licenseValid(s)
}

export function trialDaysLeft(s: Settings, now = Date.now()): number {
  if (!s.trialEndsAt) return 0
  return Math.max(0, Math.ceil((s.trialEndsAt - now) / 86_400_000))
}

export function isPro(s: Settings, now = Date.now()): boolean {
  if (licenseValid(s)) return true
  if (s.trialEndsAt && now < s.trialEndsAt) return true
  return false
}

export function activeTaskCount(tasks: { archived: boolean }[]): number {
  return tasks.filter((t) => !t.archived).length
}

export function canAddTask(s: Settings, tasks: { archived: boolean }[]): boolean {
  if (isPro(s)) return true
  return activeTaskCount(tasks) < FREE_LIMITS.activeTasks
}

export function canAddProject(s: Settings, projects: { archived: boolean }[]): boolean {
  if (isPro(s)) return true
  return projects.filter((p) => !p.archived).length < FREE_LIMITS.projects
}

export function checkoutUrl(
  s: Settings,
  interval: 'monthly' | 'annual' | 'lifetime'
): string {
  const fromSettings = s.checkout?.[interval]?.trim() ?? ''
  if (fromSettings) return fromSettings
  const env =
    interval === 'monthly'
      ? import.meta.env.VITE_CHECKOUT_MONTHLY_URL
      : interval === 'annual'
      ? import.meta.env.VITE_CHECKOUT_ANNUAL_URL
      : import.meta.env.VITE_CHECKOUT_LIFETIME_URL
  return typeof env === 'string' ? env.trim() : ''
}

export function expiredTrialPatch(s: Settings, now = Date.now()): Partial<Settings> | null {
  if (licenseValid(s)) {
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
  if (licenseValid(s)) return false
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
