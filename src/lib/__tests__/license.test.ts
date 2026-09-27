import { describe, it, expect } from 'vitest'
import { generateLicense, validateLicenseKey } from '../license'

describe('license keys', () => {
  it('generates and validates monthly, annual, and lifetime keys', () => {
    for (const interval of ['monthly', 'annual', 'lifetime'] as const) {
      const key = generateLicense(interval, 'seed1234')
      const parsed = validateLicenseKey(key)
      expect(parsed.ok).toBe(true)
      if (parsed.ok) expect(parsed.interval).toBe(interval)
    }
  })

  it('rejects truncated, mistyped, and empty keys', () => {
    expect(validateLicenseKey('').ok).toBe(false)
    expect(validateLicenseKey('TF-YR-SEED1234-0000').ok).toBe(false)
    expect(validateLicenseKey('not-a-key').ok).toBe(false)
    const good = generateLicense('annual', 'abcd1234')
    expect(validateLicenseKey(good.slice(0, -1)).ok).toBe(false)
  })

  it('is case-insensitive', () => {
    const key = generateLicense('lifetime', 'life0001')
    expect(validateLicenseKey(key.toLowerCase()).ok).toBe(true)
  })
})
