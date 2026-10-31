import type { Priority, Task } from '@/lib/types'
import { PRIORITIES } from '@/lib/constants'
import { Flag } from 'lucide-react'

export function PriorityBadge({ priority, showLabel = false }: { priority: Priority; showLabel?: boolean }) {
  const p = PRIORITIES[priority]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ color: p.color, background: p.bg }}
    >
      <Flag size={10} fill="currentColor" />
      {showLabel && p.label}
    </span>
  )
}

export function priorityLabel(p: Priority): string {
  return PRIORITIES[p]?.label ?? 'Medium'
}

export function sortTaskUrgency(a: Task, b: Task): number {
  return b.priority - a.priority
}
