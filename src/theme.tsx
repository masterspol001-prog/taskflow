import React, { useEffect, type ReactNode } from 'react'
import { useStore } from '@/store/useStore'
import type { AccentId } from '@/lib/types'
import { DEFAULT_ACCENT } from '@/lib/constants'

/** Resolve the effective theme ('light' | 'dark') from a setting value. */
export function resolveTheme(mode: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (mode !== 'system') return mode
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function isAccentId(value: unknown): value is AccentId {
  return ['violet', 'indigo', 'blue', 'emerald', 'teal', 'rose'].includes(value as string)
}

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  const bg = theme === 'dark' ? '#0e0d0b' : '#f3f0ea'
  meta.setAttribute('content', bg)
}

function applyAccent(accent: AccentId | undefined) {
  const root = document.documentElement
  const resolved = isAccentId(accent) ? accent : DEFAULT_ACCENT
  root.setAttribute('data-accent', resolved)
}

/** Syncs the data-theme / data-accent attributes to the persisted settings. */
export function ThemeSyncer() {
  const theme = useStore((s) => s.settings.theme)
  const accent = useStore((s) => s.settings.accent)

  useEffect(() => {
    applyTheme(resolveTheme(theme))
    applyAccent(accent)
  }, [theme, accent])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  return null
}

/** Reads the persisted store before React paints to avoid a theme flash. */
export function applyInitialTheme() {
  try {
    const raw = localStorage.getItem('taskflow-store')
    if (!raw) return
    const parsed = JSON.parse(raw) as {
      state?: { settings?: { theme?: 'light' | 'dark' | 'system'; accent?: AccentId } }
    }
    const { theme, accent } = parsed?.state?.settings ?? {}
    if (theme) applyTheme(resolveTheme(theme))
    applyAccent(accent)
  } catch {
    // ignore corrupt storage; ThemeSyncer will fix it after mount
  }
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  const [hasError, setHasError] = React.useState(false)
  useEffect(() => {
    if (hasError) return
  }, [hasError])
  if (hasError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--tf-canvas)] px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <h1 className="mt-4 text-lg font-bold text-[var(--tf-text)]">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-[var(--tf-text-muted)]">Your data is safe. Please reload the page — if this keeps happening, export a backup from Settings.</p>
        <button className="btn btn-secondary mt-5" onClick={() => window.location.reload()}>Reload app</button>
      </div>
    )
  }
  return <ErrorCatcher onError={() => setHasError(true)}>{children}</ErrorCatcher>
}

class ErrorCatcher extends React.Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}
