import type { Goal, Note, Priority, Project, Task } from '@/lib/types'
import { addDaysISO, todayISO } from '@/lib/dates'
import { isWaitingOn } from '@/lib/dayflow'
import { isTaskOverdue } from '@/lib/stats'
import { computeGoalHealth } from '@/lib/goals'

export type RiskKind = 'overdue' | 'deadline' | 'blocked' | 'stale' | 'goal' | 'conflict'

export interface RiskItem {
  id: string
  kind: RiskKind
  title: string
  why: string
  next: string
  taskId?: string
  projectId?: string
  goalId?: string
}

export interface WorkflowStep {
  title: string
  priority: Priority
  dueOffset: number
  estimate?: number
  dependsOnIndex?: number
}

export interface WorkflowTemplate {
  id: string
  name: string
  blurb: string
  projectName: string
  color: string
  icon: string
  sections: string[]
  steps: WorkflowStep[]
}

export interface WhatIfResult {
  delayDays: number
  moved: { id: string; title: string; from: string; to: string }[]
  blockers: { id: string; title: string }[]
  critical: { id: string; title: string; dueDate: string }[]
  summary: string
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000

export function emptyNote(partial: Partial<Note> & { title: string }): Note {
  const now = Date.now()
  return {
    id: partial.id ?? `note-${now}`,
    title: partial.title,
    body: partial.body ?? '',
    projectId: partial.projectId ?? null,
    pinned: partial.pinned ?? false,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  }
}

export function projectHealthOf(project: Project, tasks: Task[], now = new Date()): 'healthy' | 'watch' | 'at-risk' {
  const open = tasks.filter((t) => t.projectId === project.id && !t.archived && !t.completed)
  const overdue = open.filter((t) => isTaskOverdue(t, now)).length
  const stale = open.filter((t) => now.getTime() - t.updatedAt > STALE_MS).length
  if (overdue >= 3 || stale >= 4) return 'at-risk'
  if (overdue > 0 || stale > 0) return 'watch'
  return 'healthy'
}

export function buildRiskRadar(tasks: Task[], projects: Project[], goals: Goal[], now = new Date()): RiskItem[] {
  const today = todayISO()
  const soon = addDaysISO(today, 3)
  const items: RiskItem[] = []

  for (const t of tasks) {
    if (t.archived || t.completed) continue
    if (isTaskOverdue(t, now)) {
      items.push({
        id: `overdue-${t.id}`,
        kind: 'overdue',
        title: t.title,
        why: t.dueDate ? `Due ${t.dueDate}` : 'Past due',
        next: 'Open it, snooze it, or finish it today.',
        taskId: t.id,
        projectId: t.projectId ?? undefined,
      })
    } else if (t.dueDate && t.dueDate > today && t.dueDate <= soon) {
      items.push({
        id: `soon-${t.id}`,
        kind: 'deadline',
        title: t.title,
        why: `Due ${t.dueDate}`,
        next: 'Protect time on Today, or move the date honestly.',
        taskId: t.id,
        projectId: t.projectId ?? undefined,
      })
    }
    if (isWaitingOn(t) || (t.dependsOn ?? []).length > 0) {
      items.push({
        id: `blocked-${t.id}`,
        kind: 'blocked',
        title: t.title,
        why: t.waitingOn ? `Waiting on ${t.waitingOn}` : 'Has unfinished dependencies',
        next: 'Clear the blocker, or park it on Waiting.',
        taskId: t.id,
        projectId: t.projectId ?? undefined,
      })
    }
    if (now.getTime() - t.updatedAt > STALE_MS) {
      items.push({
        id: `stale-${t.id}`,
        kind: 'stale',
        title: t.title,
        why: 'No activity in 7+ days',
        next: 'Do the next step, or archive it.',
        taskId: t.id,
        projectId: t.projectId ?? undefined,
      })
    }
  }

  for (const g of goals) {
    if (g.status === 'archived' || g.status === 'completed' || g.status === 'paused') continue
    const health = computeGoalHealth(g, tasks, now)
    if (health === 'at_risk' || health === 'attention') {
      items.push({
        id: `goal-${g.id}`,
        kind: 'goal',
        title: g.title,
        why: health === 'at_risk' ? 'Goal is at risk from linked work' : 'Goal needs attention',
        next: 'Add a next action on Today.',
        goalId: g.id,
      })
    }
  }

  const dated = tasks.filter((t) => !t.archived && !t.completed && t.dueDate && t.dueTime)
  for (let i = 0; i < dated.length; i++) {
    for (let j = i + 1; j < dated.length; j++) {
      if (dated[i].dueDate === dated[j].dueDate && dated[i].dueTime === dated[j].dueTime) {
        items.push({
          id: `conflict-${dated[i].id}-${dated[j].id}`,
          kind: 'conflict',
          title: `${dated[i].title} vs ${dated[j].title}`,
          why: `Both timed ${dated[i].dueDate} ${dated[i].dueTime}`,
          next: 'Shift one, or drop the weaker commitment.',
          taskId: dated[i].id,
        })
      }
    }
  }

  const rank: Record<RiskKind, number> = { overdue: 0, conflict: 1, blocked: 2, goal: 3, deadline: 4, stale: 5 }
  return items.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 24)
}

export function whatIfDelay(tasks: Task[], projectId: string, delayDays: number, nowISO = todayISO()): WhatIfResult {
  const pool = tasks.filter((t) => !t.archived && t.projectId === projectId)
  const moved = pool
    .filter((t) => !t.completed && t.dueDate)
    .map((t) => {
      const to = addDaysISO(t.dueDate!, delayDays)
      return { id: t.id, title: t.title, from: t.dueDate!, to }
    })
  const blockers = pool.filter((t) => !t.completed && (isWaitingOn(t) || (t.dependsOn ?? []).length > 0)).map((t) => ({ id: t.id, title: t.title }))
  const critical = pool
    .filter((t) => !t.completed && t.dueDate && (t.important || t.priority >= 3))
    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate! }))
  const after = moved.filter((m) => m.to > nowISO).length
  const summary =
    delayDays === 0
      ? `${pool.filter((t) => !t.completed).length} open. Hypothetical only — nothing is saved until you apply.`
      : `${moved.length} dated ${moved.length === 1 ? 'task' : 'tasks'} would move ${delayDays} day${delayDays === 1 ? '' : 's'}. ${after} would still be in the future.`
  return { delayDays, moved, blockers, critical, summary }
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'launch',
    name: 'Product launch',
    blurb: 'Ship a small launch without pretending it is a program of record.',
    projectName: 'Launch',
    color: '#3b82f6',
    icon: 'rocket',
    sections: ['Prep', 'Ship', 'Follow-up'],
    steps: [
      { title: 'Write the one-sentence promise', priority: 4, dueOffset: 0, estimate: 30 },
      { title: 'List must-ship vs later', priority: 3, dueOffset: 1, estimate: 45, dependsOnIndex: 0 },
      { title: 'Build the smallest demo', priority: 4, dueOffset: 4, estimate: 120, dependsOnIndex: 1 },
      { title: 'Ask three people to try it', priority: 3, dueOffset: 6, estimate: 40 },
      { title: 'Publish and note what broke', priority: 4, dueOffset: 8, estimate: 60 },
    ],
  },
  {
    id: 'content',
    name: 'Content production',
    blurb: 'One piece, from idea to published, with a review step.',
    projectName: 'Content',
    color: '#8e5cf7',
    icon: 'camera',
    sections: ['Draft', 'Edit', 'Publish'],
    steps: [
      { title: 'Capture the idea in one line', priority: 2, dueOffset: 0, estimate: 15 },
      { title: 'Write a messy first draft', priority: 3, dueOffset: 1, estimate: 90 },
      { title: 'Cut it in half', priority: 3, dueOffset: 2, estimate: 40, dependsOnIndex: 1 },
      { title: 'Publish and log the date', priority: 3, dueOffset: 3, estimate: 20 },
    ],
  },
  {
    id: 'job',
    name: 'Job application',
    blurb: 'A single application, not a fake CRM.',
    projectName: 'Applications',
    color: '#0d9488',
    icon: 'briefcase',
    sections: ['Research', 'Apply', 'Follow-up'],
    steps: [
      { title: 'Read the role and note 3 fits', priority: 3, dueOffset: 0, estimate: 30 },
      { title: 'Tailor resume bullets', priority: 4, dueOffset: 1, estimate: 60 },
      { title: 'Write a short cover note', priority: 3, dueOffset: 1, estimate: 40 },
      { title: 'Submit and set a follow-up', priority: 4, dueOffset: 2, estimate: 20 },
    ],
  },
  {
    id: 'study',
    name: 'Study plan',
    blurb: 'One topic, spaced across a week.',
    projectName: 'Study',
    color: '#2f9e6e',
    icon: 'graduationCap',
    sections: ['Learn', 'Practice'],
    steps: [
      { title: 'Skim the chapter and list unknowns', priority: 2, dueOffset: 0, estimate: 25 },
      { title: 'Work 10 practice problems', priority: 3, dueOffset: 1, estimate: 45 },
      { title: 'Teach it out loud for 5 minutes', priority: 2, dueOffset: 3, estimate: 15 },
      { title: 'Quiz yourself without notes', priority: 3, dueOffset: 6, estimate: 30 },
    ],
  },
  {
    id: 'personal',
    name: 'Personal project',
    blurb: 'A small life project with a finish line.',
    projectName: 'Personal project',
    color: '#f97316',
    icon: 'heart',
    sections: ['Decide', 'Do', 'Close'],
    steps: [
      { title: 'Write why this matters this month', priority: 2, dueOffset: 0, estimate: 15 },
      { title: 'Do the first 25-minute block', priority: 3, dueOffset: 0, estimate: 25 },
      { title: 'Book the next session', priority: 2, dueOffset: 2, estimate: 10 },
      { title: 'Ship a version you can show someone', priority: 3, dueOffset: 7, estimate: 60 },
    ],
  },
]
