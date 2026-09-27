import { describe, it, expect } from 'vitest'
import {
  FREE_LIMITS,
  canAddProject,
  canAddTask,
  checkoutUrl,
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
    const tasks = Array.from({ length: FREE_LIMITS.activeTasks }, (_, i) => ({ archived: false, id: String(i) }))
    expect(canAddTask(s, tasks)).toBe(false)
    expect(canAddTask(s, tasks.slice(0, -1))).toBe(true)
    expect(canAddTask(s, [...tasks.slice(0, -1), { archived: true }])).toBe(true)

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

  it('prefers settings checkout URLs over empty env', () => {
    const s = {
      ...defaultSettings(),
      checkout: { monthly: ' https://buy.monthly ', annual: '', lifetime: '' },
    }
    expect(checkoutUrl(s, 'monthly')).toBe('https://buy.monthly')
    expect(checkoutUrl(s, 'annual')).toBe('')
  })
})
