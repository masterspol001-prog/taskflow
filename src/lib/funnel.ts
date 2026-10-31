// Local-only conversion funnel. Nothing leaves the device; this exists so the
// seller can see where people drop off (paywall -> checkout -> redeem) from
// Settings, and export it. No PII: only event names, timestamps, and plan labels.

export type FunnelEvent =
  | 'paywall_open'
  | 'checkout_open'
  | 'trial_start'
  | 'trial_blocked'
  | 'license_redeem_ok'
  | 'license_redeem_fail'
  | 'upgrade_prompt'

export interface FunnelEntry {
  name: FunnelEvent
  at: number
  meta?: Record<string, string | number | null>
}

const STORAGE_KEY = 'taskflow-funnel-v1'
const MAX_ENTRIES = 300

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function trackFunnel(name: FunnelEvent, meta?: FunnelEntry['meta']): void {
  const store = safeStorage()
  if (!store) return
  try {
    const raw = store.getItem(STORAGE_KEY)
    const list: FunnelEntry[] = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return
    list.push({ name, at: Date.now(), ...(meta ? { meta } : {}) })
    store.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_ENTRIES)))
  } catch {
    // Funnel tracking must never break the app.
  }
}

export function readFunnel(): FunnelEntry[] {
  const store = safeStorage()
  if (!store) return []
  try {
    const raw = store.getItem(STORAGE_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as FunnelEntry[]) : []
  } catch {
    return []
  }
}

export function clearFunnel(): void {
  safeStorage()?.removeItem(STORAGE_KEY)
}

export function funnelSummary(): Record<FunnelEvent, number> {
  const base: Record<FunnelEvent, number> = {
    paywall_open: 0,
    checkout_open: 0,
    trial_start: 0,
    trial_blocked: 0,
    license_redeem_ok: 0,
    license_redeem_fail: 0,
    upgrade_prompt: 0,
  }
  for (const entry of readFunnel()) {
    if (entry.name in base) base[entry.name] += 1
  }
  return base
}
