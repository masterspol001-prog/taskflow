import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { isTaskOverdue } from '@/lib/stats'

export function RescheduleWatcher() {
  const hydrated = useStore((s) => s.hydrated)
  const ran = useRef(false)

  useEffect(() => {
    if (!hydrated || ran.current) return
    ran.current = true
    const overdue = useStore.getState().tasks.filter((t) => isTaskOverdue(t))
    if (overdue.length === 0) return
    const n = overdue.length
    useStore.getState().toast({
      title: `${n} overdue ${n === 1 ? 'task needs' : 'tasks need'} a decision`,
      message: 'Recover them without dumping everything on today.',
      kind: 'info',
      actionLabel: 'Recover',
      onAction: () => useUIStore.getState().navigate('dashboard'),
    })
  }, [hydrated])

  return null
}
