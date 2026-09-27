export type BillingInterval = 'monthly' | 'annual' | 'lifetime'

const SALT = 'taskflow-pro-v1'

function fnv(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

const TAG: Record<BillingInterval, string> = {
  monthly: 'MO',
  annual: 'YR',
  lifetime: 'LT',
}

const FROM_TAG: Record<string, BillingInterval> = {
  MO: 'monthly',
  YR: 'annual',
  LT: 'lifetime',
}

/** Issue a key after a Lemon Squeezy / Stripe sale. Run locally; do not expose in the UI. */
export function generateLicense(interval: BillingInterval, seed = Math.random().toString(36).slice(2, 10)): string {
  const body = `${TAG[interval]}-${seed.toUpperCase().replace(/[^A-Z0-9]/g, '').padEnd(8, 'X').slice(0, 8)}`
  return `TF-${body}-${fnv(body + SALT).slice(0, 4)}`
}

export function validateLicenseKey(raw: string): { ok: true; interval: BillingInterval } | { ok: false } {
  const key = raw.trim().toUpperCase()
  const m = /^TF-(MO|YR|LT)-([A-Z0-9]{8})-([A-F0-9]{4})$/.exec(key)
  if (!m) return { ok: false }
  const body = `${m[1]}-${m[2]}`
  if (fnv(body + SALT).slice(0, 4) !== m[3]) return { ok: false }
  return { ok: true, interval: FROM_TAG[m[1]] }
}
