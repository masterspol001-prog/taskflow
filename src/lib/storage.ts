import type { StateStorage } from 'zustand/middleware'

/**
 * A Storage-compatible facade that never throws.
 *
 * Local-first apps assume `localStorage` is always available, but it is not:
 * third-party iframes, strict privacy modes and Safari private browsing can all
 * throw a SecurityError on access. When that happens the app must still boot
 * (degrading to an in-memory session) instead of hanging on the loading screen.
 */
function memoryStorage(): StateStorage {
  const mem = new Map<string, string>()
  return {
    getItem: (name) => (mem.has(name) ? mem.get(name)! : null),
    setItem: (name, value) => {
      mem.set(name, value)
    },
    removeItem: (name) => {
      mem.delete(name)
    },
  }
}

function proxyStorage(ls: Storage, fallback: StateStorage): StateStorage {
  return {
    getItem: (name) => {
      try {
        return ls.getItem(name)
      } catch {
        return fallback.getItem(name)
      }
    },
    setItem: (name, value) => {
      try {
        ls.setItem(name, value)
      } catch {
        fallback.setItem(name, value)
      }
    },
    removeItem: (name) => {
      try {
        ls.removeItem(name)
      } catch {
        fallback.removeItem(name)
      }
    },
  }
}

let cached: StateStorage | null = null

/** Resolve a storage backend that is guaranteed to work, even when localStorage is blocked. */
export function safeStateStorage(): StateStorage {
  if (cached) return cached
  const fallback = memoryStorage()
  if (typeof window === 'undefined') {
    cached = fallback
    return cached
  }
  try {
    const ls = window.localStorage
    const probe = '__taskflow_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    cached = proxyStorage(ls, fallback)
  } catch {
    cached = fallback
  }
  return cached
}

/** True when the browser lets us persist data between sessions. */
export function storageAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const ls = window.localStorage
    const probe = '__taskflow_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return true
  } catch {
    return false
  }
}
