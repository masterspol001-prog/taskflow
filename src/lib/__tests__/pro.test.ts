import { describe, it, expect } from 'vitest'
import {
  FEATURES_UNLOCKED,
  FREE_LIMITS,
  canAddGoal,
  canAddProject,
  canAddTask,
  checkoutUrl,
  devUnlockPatch,
  entitledPro,
  isLicenseLapsed,
  isSafeCheckoutUrl,
  licenseDaysLeft,
  expiredTrialPatch,
  isPro,
  isTrialing,
  shouldAutoStartTrial,
  trialDaysLeft,
  trialSettingsPatch,
} from '../pro'
import type { LicensePayload } from '../license'
import { defaultSettings } from '../sampleData'
import type { BillingInterval } from '@/lib/types'

const encoder = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Structurally valid license token for entitlement-level tests. The synchronous
 * entitlement helpers read claims without re-checking the signature (that happens
 * at redeem/hydrate), so a placeholder signature is fine here.
 */
function licenseToken(plan: BillingInterval, exp: number | null): string {
  const payload: LicensePayload = { v: 1, plan, sub: 'test@example.com', iat: Date.now(), exp, id: 'TEST2345TEST' }
  return `TF1.${b64url(encoder.encode(JSON.stringify(payload)))}.${b64url(new Uint8Array(64))}`
}

describe('pro entitlements', () => {
  it('temporarily unlocks every feature while FEATURES_UNLOCKED is on', () => {
    expect(FEATURES_UNLOCKED).toBe(true)
    const s = defaultSettings()
    expect(isPro(s)).toBe(true)
    expect(entitledPro(s)).toBe(false)
    const tasks = Array.from({ length: FREE_LIMITS.activeTasks }, (_, i) => ({ archived: false, completed: false, id: String(i) }))
    expect(canAddTask(s, tasks)).toBe(true)
    const projects = Array.from({ length: FREE_LIMITS.projects }, () => ({ archived: false }))
    expect(canAddProject(s, projects)).toBe(true)
    expect(canAddGoal(s)).toBe(true)
  })

  it('treats a verified license as entitled Pro', () => {
    const s = {
      ...defaultSettings(),
      licenseKey: licenseToken('annual', Date.now() + 86_400_000),
      licenseInterval: 'annual' as const,
      licenseVerified: true,
    }
    expect(entitledPro(s)).toBe(true)
    expect(isPro(s)).toBe(true)
    expect(isTrialing(s)).toBe(false)
  })

  it('does not treat an unsigned decoded key as entitled Pro', () => {
    const s = {
      ...defaultSettings(),
      licenseKey: licenseToken('annual', Date.now() + 86_400_000),
      licenseInterval: 'annual' as const,
      licenseVerified: false,
    }
    expect(entitledPro(s)).toBe(false)
  })

  it('treats an unexpired trial as entitled Pro', () => {
    const s = { ...defaultSettings(), trialEndsAt: Date.now() + 86_400_000, trialUsed: true, plan: 'pro' as const }
    expect(entitledPro(s)).toBe(true)
    expect(isPro(s)).toBe(true)
    expect(isTrialing(s)).toBe(true)
    expect(trialDaysLeft(s)).toBeGreaterThan(0)
  })

  it('drops entitled Pro after the trial expires without a license', () => {
    const s = { ...defaultSettings(), trialEndsAt: Date.now() - 1000, trialUsed: true, plan: 'pro' as const }
    expect(entitledPro(s)).toBe(false)
    expect(expiredTrialPatch(s)).toEqual({ plan: 'free' })
  })

  it('keeps Free cap constants for when pay returns', () => {
    expect(FREE_LIMITS.activeTasks).toBe(40)
    expect(FREE_LIMITS.projects).toBe(3)
  })

  it('auto-starts trial for new free users, not licensed or used trials', () => {
    expect(shouldAutoStartTrial(defaultSettings())).toBe(true)
    expect(shouldAutoStartTrial({ ...defaultSettings(), trialUsed: true })).toBe(false)
    expect(shouldAutoStartTrial({
      ...defaultSettings(),
      licenseKey: licenseToken('annual', null),
      licenseVerified: true,
    })).toBe(false)
    const patch = trialSettingsPatch(1_700_000_000_000)
    expect(patch.plan).toBe('pro')
    expect(patch.trialUsed).toBe(true)
    expect(patch.trialEndsAt).toBe(1_700_000_000_000 + 7 * 86_400_000)
  })

  it('expires monthly licenses and leaves lifetime open', () => {
    const now = 1_700_000_000_000
    const live = {
      ...defaultSettings(),
      licenseKey: licenseToken('monthly', now + 86_400_000),
      licenseInterval: 'monthly' as const,
      licenseVerified: true,
    }
    expect(entitledPro(live, now)).toBe(true)
    expect(isPro(live, now)).toBe(true)
    expect(isLicenseLapsed(live, now)).toBe(false)
    expect(licenseDaysLeft(live, now)).toBe(1)
    const lapsed = { ...live, plan: 'pro' as const, licenseKey: licenseToken('monthly', now - 1000) }
    expect(entitledPro(lapsed, now)).toBe(false)
    expect(isLicenseLapsed(lapsed, now)).toBe(true)
    expect(expiredTrialPatch(lapsed, now)).toEqual({ plan: 'free' })
    const lifetime = {
      ...defaultSettings(),
      licenseKey: licenseToken('lifetime', null),
      licenseInterval: 'lifetime' as const,
      licenseVerified: true,
    }
    expect(entitledPro(lifetime, now)).toBe(true)
    expect(isPro(lifetime, now)).toBe(true)
    expect(isLicenseLapsed(lifetime, now)).toBe(false)
    expect(licenseDaysLeft(lifetime, now)).toBe(0)
  })

  it('restarts the real 7-day trial only in development, never over a live license', () => {
    const now = 1_700_000_000_000
    const free = { ...defaultSettings(), trialUsed: true, trialEndsAt: now - 1000, plan: 'free' as const }
    expect(devUnlockPatch(free, now, 'test')).toBeNull()
    expect(devUnlockPatch(free, now, 'production')).toBeNull()
    const restarted = devUnlockPatch(free, now, 'development')
    expect(restarted).toEqual(trialSettingsPatch(now))
    const liveTrial = { ...defaultSettings(), trialUsed: true, trialEndsAt: now + 86_400_000, plan: 'pro' as const }
    expect(devUnlockPatch(liveTrial, now, 'development')).toBeNull()
    const licensed = {
      ...defaultSettings(),
      licenseKey: licenseToken('lifetime', null),
      licenseInterval: 'lifetime' as const,
      licenseVerified: true,
    }
    expect(devUnlockPatch(licensed, now, 'development')).toBeNull()
  })

  it('accepts only https checkout URLs and fails closed', () => {
    const s = {
      ...defaultSettings(),
      checkout: { monthly: ' https://buy.monthly ', annual: 'http://insecure.example', lifetime: 'javascript:alert(1)' },
    }
    expect(checkoutUrl(s, 'monthly')).toBe('https://buy.monthly')
    expect(checkoutUrl(s, 'annual')).toBe('')
    expect(checkoutUrl(s, 'lifetime')).toBe('')
    expect(checkoutUrl(defaultSettings(), 'lifetime')).toBe('')
    expect(isSafeCheckoutUrl('https://pay.example/x')).toBe(true)
    expect(isSafeCheckoutUrl('http://pay.example/x')).toBe(false)
    expect(isSafeCheckoutUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeCheckoutUrl('')).toBe(false)
  })
})
