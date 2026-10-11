import { describe, it, expect } from 'vitest'
import {
  FREE_LIMITS,
  canAddProject,
  canAddTask,
  checkoutUrl,
  isLicenseLapsed,
  licenseDaysLeft,
  licenseExpiresAt,
  matchPlanByAmount,
  parsePaidAmountInr,
  PLAN_AMOUNTS_INR,
  RAZORPAY_PAY_URL,
  expiredTrialPatch,
  isPro,
  isTrialing,
  shouldAutoStartTrial,
  trialDaysLeft,
  trialSettingsPatch,
} from '../pro'
import { generateLicense } from '../license'
import { defaultSettings } from '../sampleData'

describe('pro entitlements', () => {
  it('treats a valid license as Pro', () => {
    const s = { ...defaultSettings(), licenseKey: generateLicense('annual', 'prokey01') }
    expect(isPro(s)).toBe(true)
    expect(isTrialing(s)).toBe(false)
  })

  it('treats an unexpired trial as Pro', () => {
    const s = { ...defaultSettings(), trialEndsAt: Date.now() + 86_400_000, trialUsed: true, plan: 'pro' as const }
    expect(isPro(s)).toBe(true)
    expect(isTrialing(s)).toBe(true)
    expect(trialDaysLeft(s)).toBeGreaterThan(0)
  })

  it('drops Pro after the trial expires without a license', () => {
    const s = { ...defaultSettings(), trialEndsAt: Date.now() - 1000, trialUsed: true, plan: 'pro' as const }
    expect(isPro(s)).toBe(false)
    expect(expiredTrialPatch(s)).toEqual({ plan: 'free' })
  })

  it('enforces free task and project caps', () => {
    const s = defaultSettings()
    const tasks = Array.from({ length: FREE_LIMITS.activeTasks }, (_, i) => ({ archived: false, completed: false, id: String(i) }))
    expect(canAddTask(s, tasks)).toBe(false)
    expect(canAddTask(s, tasks.slice(0, -1))).toBe(true)
    expect(canAddTask(s, [...tasks.slice(0, -1), { archived: true, completed: false }])).toBe(true)
    expect(canAddTask(s, [...tasks.slice(0, -1), { archived: false, completed: true }])).toBe(true)

    const projects = Array.from({ length: FREE_LIMITS.projects }, () => ({ archived: false }))
    expect(canAddProject(s, projects)).toBe(false)
    const licensed = { ...s, licenseKey: generateLicense('monthly', 'capfree1') }
    expect(canAddTask(licensed, tasks)).toBe(true)
    expect(canAddProject(licensed, projects)).toBe(true)
  })

  it('auto-starts trial for new free users, not licensed or used trials', () => {
    expect(shouldAutoStartTrial(defaultSettings())).toBe(true)
    expect(shouldAutoStartTrial({ ...defaultSettings(), trialUsed: true })).toBe(false)
    expect(shouldAutoStartTrial({ ...defaultSettings(), licenseKey: generateLicense('annual', 'autokey1') })).toBe(false)
    const patch = trialSettingsPatch(1_700_000_000_000)
    expect(patch.plan).toBe('pro')
    expect(patch.trialUsed).toBe(true)
    expect(patch.trialEndsAt).toBe(1_700_000_000_000 + 7 * 86_400_000)
  })

  it('parses paid USD and matches the plan amount', () => {
    expect(parsePaidAmountInr('$10')).toBe(10)
    expect(parsePaidAmountInr('72')).toBe(72)
    expect(parsePaidAmountInr('USD 149')).toBe(149)
    expect(parsePaidAmountInr('')).toBeNull()
    expect(parsePaidAmountInr('abc')).toBeNull()
    expect(matchPlanByAmount(PLAN_AMOUNTS_INR.monthly)).toBe('monthly')
    expect(matchPlanByAmount(PLAN_AMOUNTS_INR.annual)).toBe('annual')
    expect(matchPlanByAmount(299)).toBeNull()
    expect(matchPlanByAmount(PLAN_AMOUNTS_INR.lifetime)).toBe('lifetime')
    expect(matchPlanByAmount(100)).toBeNull()
  })

  it('expires monthly licenses and leaves lifetime open', () => {
    const now = 1_700_000_000_000
    expect(licenseExpiresAt('lifetime', now)).toBeNull()
    const monthlyEnd = licenseExpiresAt('monthly', now)
    expect(monthlyEnd).toBe(now + 32 * 86_400_000)
    const key = generateLicense('monthly', 'lapse001')
    const live = { ...defaultSettings(), licenseKey: key, licenseInterval: 'monthly' as const, licenseExpiresAt: now + 86_400_000 }
    expect(isPro(live, now)).toBe(true)
    expect(isLicenseLapsed(live, now)).toBe(false)
    expect(licenseDaysLeft(live, now)).toBe(1)
    const lapsed = { ...live, plan: 'pro' as const, licenseExpiresAt: now - 1000 }
    expect(isPro(lapsed, now)).toBe(false)
    expect(isLicenseLapsed(lapsed, now)).toBe(true)
    expect(expiredTrialPatch(lapsed, now)).toEqual({ plan: 'free' })
  })

  it('prefers settings checkout URLs, then Razorpay', () => {
    const s = {
      ...defaultSettings(),
      checkout: { monthly: ' https://buy.monthly ', annual: '', lifetime: '' },
    }
    expect(checkoutUrl(s, 'monthly')).toBe('https://buy.monthly')
    expect(checkoutUrl(s, 'annual')).toBe(RAZORPAY_PAY_URL)
    expect(checkoutUrl(defaultSettings(), 'lifetime')).toBe(RAZORPAY_PAY_URL)
  })
})
