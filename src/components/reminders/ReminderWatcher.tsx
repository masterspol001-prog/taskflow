import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { localISODate, notify, alreadyNotified, markNotified } from '@/lib/notify'
import { briefingText, tasksThatFitNow } from '@/lib/agent'
import { computeGoalHealth } from '@/lib/goals'
import { diffInDays } from '@/lib/dates'
import type { Goal } from '@/lib/types'

const CHECK_MS = 30000

export function ReminderWatcher() {
  const enabled = useStore((s) => s.settings.notificationsEnabled)
  const leadMin = useStore((s) => s.settings.reminderLeadMinutes)
  const tasks = useStore((s) => s.tasks)
  const goals = useStore((s) => s.goals)
  const energy = useStore((s) => s.settings.energy ?? 'medium')
  const running = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const check = () => {
      if (running.current) return
      running.current = true
      try {
        checkNow(tasks, goals, leadMin, energy)
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
  }, [enabled, tasks, goals, leadMin, energy])

  return null
}

function checkNow(
  tasks: ReturnType<typeof useStore.getState>['tasks'],
  goals: Goal[],
  leadMin: number,
  energy: 'high' | 'medium' | 'low'
) {
  const now = new Date()
  const today = localISODate(now)
  const hour = now.getHours()
  if (hour >= 6 && hour < 11) {
    const briefKey = `briefing:${today}`
    if (!alreadyNotified(briefKey)) {
      const brief = briefingText(tasks, energy)
      notify(brief.title, brief.body, 'taskflow-briefing')
      markNotified(briefKey)
    }
  }
  if (hour >= 11 && hour < 17) {
    const fitKey = `fitnow:${today}:${hour}`
    if (!alreadyNotified(fitKey)) {
      const fit = tasksThatFitNow(tasks, 45, now)
      if (fit.tasks.length > 0) {
        notify('Free slot', fit.message, 'taskflow-fitnow')
        markNotified(fitKey)
      }
    }
  }
  checkGoals(goals, tasks, now, today)

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

function checkGoals(goals: Goal[], tasks: ReturnType<typeof useStore.getState>['tasks'], now: Date, today: string) {
  for (const g of goals) {
    if (g.notifications === false) continue

    if (g.status === 'completed' && g.completedAt) {
      const doneKey = `goal-done:${g.id}:${g.completedAt}`
      if (!alreadyNotified(doneKey)) {
        notify('Goal completed', `“${g.title}” is done. Beautiful work.`, 'taskflow-goal')
        markNotified(doneKey)
      }
      continue
    }
    if (g.status === 'archived' || g.status === 'paused') continue

    // Milestone approaching (within 3 days).
    for (const m of g.milestones ?? []) {
      if (m.done || !m.dueDate) continue
      const days = diffInDays(today, m.dueDate)
      if (days >= 0 && days <= 3) {
        const msKey = `goal-ms:${m.id}:${m.dueDate}`
        if (!alreadyNotified(msKey)) {
          notify(`Milestone approaching: ${m.title}`, `${g.title} · ${days === 0 ? 'due today' : `due in ${days} day${days === 1 ? '' : 's'}`}.`, 'taskflow-goal')
          markNotified(msKey)
        }
      }
    }

    // Falling behind — one nudge per day.
    if (computeGoalHealth(g, tasks, now) === 'at_risk') {
      const riskKey = `goal-risk:${g.id}:${today}`
      if (!alreadyNotified(riskKey)) {
        notify(`“${g.title}” needs attention`, 'A small step today keeps it alive.', 'taskflow-goal')
        markNotified(riskKey)
      }
    }
  }
}
