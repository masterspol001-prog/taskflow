import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { localISODate, notify, alreadyNotified, markNotified } from '@/lib/notify'

const CHECK_MS = 30000

export function ReminderWatcher() {
  const enabled = useStore((s) => s.settings.notificationsEnabled)
  const leadMin = useStore((s) => s.settings.reminderLeadMinutes)
  const tasks = useStore((s) => s.tasks)
  const running = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const check = () => {
      if (running.current) return
      running.current = true
      try {
        checkNow(tasks, leadMin)
      } finally {
        running.current = false
      }
    }
    const id = window.setInterval(check, CHECK_MS)
    window.addEventListener('focus', check)
    const boot = window.setTimeout(check, 1500)
    return () => {
      window.clearInterval(id)
      window.clearTimeout(boot)
      window.removeEventListener('focus', check)
    }
  }, [enabled, tasks, leadMin])

  return null
}

function checkNow(tasks: ReturnType<typeof useStore.getState>['tasks'], leadMin: number) {
  const now = new Date()
  const today = localISODate(now)
  const open = tasks.filter((t) => !t.archived && !t.completed && t.dueDate === today && t.dueTime)

  for (const t of open) {
    const dueTime = t.dueTime
    if (!dueTime) continue
    const [h, m] = dueTime.split(':').map(Number)
    const due = new Date()
    due.setHours(h, m, 0, 0)
    const diffMin = (due.getTime() - now.getTime()) / 60000

    // Lead reminder (exactly at lead time, one-minute tolerance, never spam).
    if (leadMin > 0 && diffMin <= leadMin && diffMin > leadMin - 1.2) {
      const leadKey = `${t.id}:lead:${t.dueDate}:${dueTime}:${leadMin}`
      if (!alreadyNotified(leadKey)) {
        notify(`Upcoming: ${t.title}`, `Due at ${dueTime} (in ${Math.max(1, Math.round(diffMin))} min).`, 'taskflow-reminder')
        markNotified(leadKey)
      }
    }

    // Due-now reminder (window around the due moment).
    if (diffMin <= 0 && diffMin > -1.2) {
      const dueKey = `${t.id}:due:${t.dueDate}:${dueTime}`
      if (!alreadyNotified(dueKey)) {
        notify(`Due now: ${t.title}`, `It was scheduled for ${dueTime}.`, 'taskflow-reminder')
        markNotified(dueKey)
      }
    }
  }
}
