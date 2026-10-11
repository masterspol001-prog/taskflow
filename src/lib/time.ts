/** Time formatting helpers (HH:mm -> 12h or 24h per settings). */
import { useStore } from '@/store/useStore'
import type { TimeFormat } from '@/lib/types'

export function formatTime24(hhmm: string): string {
  return hhmm
}

export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${period}`
}

export function formatTime(hhmm: string | null | undefined, fmt?: TimeFormat): string {
  if (!hhmm) return ''
  const f = fmt ?? useStore.getState().settings.timeFormat
  return f === '12h' ? formatTime12(hhmm) : formatTime24(hhmm)
}

/** Compact human label for an estimate in minutes: 25 -> "25m", 90 -> "1.5h". */
export function estimateLabel(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return 'no estimate'
  if (mins < 60) return `${mins}m`
  const h = mins / 60
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1).replace(/\.0$/, '')}h`
}

export function taskDuration(task: { estimate?: number | null }, fallback = 30): number {
  const n = task.estimate
  if (typeof n === 'number' && n > 0) return Math.min(240, Math.max(5, n))
  return fallback
}
