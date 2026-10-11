import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'

export function RescheduleWatcher() {
  const hydrated = useStore((s) => s.hydrated)
  const ran = useRef(false)

  useEffect(() => {
    if (!hydrated || ran.current) return
    ran.current = true
    const n = useStore.getState().rescheduleMissed()
    if (n > 0) {
      useStore.getState().toast({
        title: 'Slots rolled forward',
        message: `${n} missed ${n === 1 ? 'block' : 'blocks'} moved to the next free time.`,
        kind: 'info',
      })
    }
  }, [hydrated])

  return null
}
