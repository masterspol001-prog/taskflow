import type { PersonaId } from './types'

/** A project definition for starter content. `key` becomes the stable project id. */
export interface ProjectSpec {
  key: string
  name: string
  color: string
  icon: string
  description: string
  sections?: string[]
}

export interface SubtaskSeed {
  t: string
  d?: boolean
}

/** Seed descriptor consumed by the sample-data builder. */
export interface SeedTask {
  title: string
  notes?: string
  projectKey?: string
  section?: string
  priority?: 1 | 2 | 3 | 4
  dueOffset?: number
  dueTime?: string
  important?: boolean
  completed?: boolean
  completedOffset?: number
  tags?: string[]
  recurrence?: { freq: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval: number }
  subtasks?: SubtaskSeed[]
}

export interface PersonaPreset {
  projects: ProjectSpec[]
  seeds: SeedTask[]
  /** Recently completed items to bring the dashboard & streaks alive. */
  extras: SeedTask[]
}

const every = { freq: 'daily', interval: 1 } as const
const weekly = { freq: 'weekly', interval: 1 } as const

export const PERSONA_PRESETS: Record<PersonaId, PersonaPreset> = {
  work: {
    projects: [
      { key: 'work', name: 'Work', color: '#3b82f6', icon: 'briefcase', description: 'Client work, meetings and deadlines', sections: ['Active', 'Planning'] },
      { key: 'clients', name: 'Clients', color: '#8e5cf7', icon: 'user', description: 'Accounts, pitches and follow-ups' },
      { key: 'meetings', name: 'Team rhythm', color: '#0ea5e9', icon: 'calendar', description: 'Standups, reviews and offsites' },
      { key: 'growth', name: 'Growth', color: '#2f9e6e', icon: 'book', description: 'Courses, reading and skills' },
    ],
    seeds: [
      { title: 'Finish quarterly report', projectKey: 'work', priority: 4, dueOffset: 0, dueTime: '17:00', section: 'Active', tags: ['follow-up'], important: true, subtasks: [{ t: 'Collect sales data', d: true }, { t: 'Draft narrative', d: true }, { t: 'Build charts' }, { t: 'Review with manager' }] },
      { title: 'Prepare client presentation deck', projectKey: 'work', priority: 3, dueOffset: 1, dueTime: '10:00', section: 'Active', notes: 'Include updated growth numbers and case studies.' },
      { title: 'Review pull requests', projectKey: 'work', priority: 2, dueOffset: 0, section: 'Active', tags: ['deep-work'], completed: true, completedOffset: 0 },
      { title: 'Reply to vendor contract emails', projectKey: 'work', priority: 3, dueOffset: -1, section: 'Active', tags: ['waiting'] },
      { title: 'Draft Q3 OKRs', projectKey: 'work', priority: 2, dueOffset: 6, section: 'Planning', tags: ['ideas'] },
      { title: 'New business pitch deck', projectKey: 'clients', priority: 3, dueOffset: 2, notes: 'Lead with the ROI section.' },
      { title: 'Send invoice to Acme', projectKey: 'clients', priority: 4, dueOffset: -1, important: true, tags: ['waiting'] },
      { title: 'Follow up on design feedback', projectKey: 'clients', priority: 2, dueOffset: 1 },
      { title: 'Weekly team standup', projectKey: 'meetings', priority: 2, dueOffset: 0, dueTime: '09:30' },
      { title: '1:1 with design team', projectKey: 'meetings', priority: 2, dueOffset: 2, dueTime: '15:00' },
      { title: 'Book flight for offsite', projectKey: 'meetings', priority: 4, dueOffset: 4, notes: 'Compare early-morning options.', tags: ['errand'] },
      { title: 'Prepare conference talk outline', projectKey: 'growth', priority: 3, dueOffset: 5, tags: ['ideas'] },
      { title: 'Finish AI course module', projectKey: 'growth', priority: 2, dueOffset: 3, tags: ['deep-work'] },
      { title: 'Plan team offsite agenda', priority: 2, dueOffset: 2 },
      { title: 'Send thank-you note to Alex', priority: 1, dueOffset: 0, completed: true, completedOffset: 0 },
      { title: 'Organize desk drawers', priority: 1, notes: 'Declutter cables and stationery.', tags: ['quick'] },
      { title: 'Update LinkedIn summary', priority: 1, dueOffset: 9, tags: ['ideas'] },
    ],
    extras: [
      { title: 'Morning standup notes', projectKey: 'work', completed: true, completedOffset: 0 },
      { title: 'Email review', projectKey: 'work', completed: true, completedOffset: -1 },
      { title: 'Update portfolio site', projectKey: 'clients', completed: true, completedOffset: -2, priority: 3 },
      { title: 'Code review follow-ups', projectKey: 'work', completed: true, completedOffset: -3 },
      { title: 'Read 10 pages of a book', projectKey: 'growth', completed: true, completedOffset: -2 },
    ],
  },

  student: {
    projects: [
      { key: 'coursework', name: 'Coursework', color: '#2563eb', icon: 'book', description: 'Lectures, reading and problem sets', sections: ['Reading', 'Assignments', 'Exams'] },
      { key: 'capstone', name: 'Capstone', color: '#8e5cf7', icon: 'graduationCap', description: 'Final project and thesis work' },
      { key: 'campus', name: 'Campus life', color: '#e7549e', icon: 'user', description: 'Clubs, events and people' },
      { key: 'fitness', name: 'Health & fitness', color: '#2f9e6e', icon: 'dumbbell', description: 'Training, meals and rest' },
    ],
    seeds: [
      { title: 'Finish essay — "Interwar economic policy"', projectKey: 'capstone', priority: 4, dueOffset: 0, dueTime: '23:59', important: true, subtasks: [{ t: 'Research primary sources', d: true }, { t: 'Draft thesis outline', d: true }, { t: 'Write body sections' }, { t: 'Proofread & cite' }] },
      { title: 'Do problem set 7', projectKey: 'coursework', priority: 3, dueOffset: 0, dueTime: '20:00', section: 'Assignments' },
      { title: 'Read chapter 4 — behavioral economics', projectKey: 'coursework', priority: 2, dueOffset: 0, section: 'Reading', tags: ['deep-work'] },
      { title: 'Outline lab report', projectKey: 'coursework', priority: 2, dueOffset: 1, section: 'Assignments' },
      { title: 'Book office hours with professor', projectKey: 'coursework', priority: 2, dueOffset: 2, section: 'Exams', tags: ['waiting'] },
      { title: 'Review lecture slides', projectKey: 'coursework', priority: 1, dueOffset: 3, section: 'Reading' },
      { title: 'Reserve study room for group', projectKey: 'coursework', priority: 2, dueOffset: 4, section: 'Assignments', tags: ['waiting'] },
      { title: 'Revise capstone methodology chapter', projectKey: 'capstone', priority: 3, dueOffset: 2, notes: 'Tighten the data-collection section.' },
      { title: 'Weekly tutoring session', projectKey: 'campus', priority: 2, dueOffset: 1 },
      { title: 'Submit design club membership form', projectKey: 'campus', priority: 1, dueOffset: 5, tags: ['quick'] },
      { title: 'Sign up for volunteer shift', projectKey: 'campus', priority: 2, dueOffset: 6 },
      { title: 'Gym — legs day', projectKey: 'fitness', priority: 3, dueOffset: 0, dueTime: '07:00' },
      { title: 'Morning stretch', projectKey: 'fitness', priority: 1, dueOffset: 0, recurrence: every },
      { title: 'Meal prep for the week', projectKey: 'fitness', priority: 2, dueOffset: 0, tags: ['quick'] },
      { title: 'Apply to summer internship', priority: 3, dueOffset: 7, important: true, tags: ['follow-up'] },
      { title: 'Email professor about extension', priority: 2, dueOffset: 1 },
      { title: 'Call home', priority: 1, dueOffset: 0, dueTime: '18:00' },
    ],
    extras: [
      { title: 'Review lecture notes', projectKey: 'coursework', completed: true, completedOffset: 0 },
      { title: 'Daily flashcards — psych 101', projectKey: 'coursework', completed: true, completedOffset: -1 },
      { title: 'Practice quiz attempt', projectKey: 'coursework', completed: true, completedOffset: -2 },
      { title: 'Light gym session', projectKey: 'fitness', completed: true, completedOffset: -3 },
      { title: 'Update capstone journal', projectKey: 'capstone', completed: true, completedOffset: -1 },
    ],
  },

  creator: {
    projects: [
      { key: 'content', name: 'Content', color: '#e11d48', icon: 'camera', description: 'Videos, newsletters and posts', sections: ['Drafting', 'Published'] },
      { key: 'client', name: 'Client work', color: '#2563eb', icon: 'briefcase', description: 'Paid projects and gigs', sections: ['Active'] },
      { key: 'brand', name: 'Brand & growth', color: '#8e5cf7', icon: 'sparkles', description: 'Audience, collabs and pitches' },
      { key: 'finance', name: 'Finances', color: '#d9a514', icon: 'creditCard', description: 'Invoicing, taxes and budget' },
    ],
    seeds: [
      { title: 'Edit this week’s video', projectKey: 'content', priority: 4, dueOffset: 0, dueTime: '18:00', section: 'Drafting', important: true, subtasks: [{ t: 'Import & log footage', d: true }, { t: 'Rough cut' }, { t: 'Color grade' }, { t: 'Captions' }, { t: 'Design thumbnail' }] },
      { title: 'Script next video', projectKey: 'content', priority: 3, dueOffset: 2, section: 'Drafting', tags: ['ideas'] },
      { title: 'Publish newsletter #12', projectKey: 'content', priority: 3, dueOffset: 0, section: 'Published', tags: ['deep-work'] },
      { title: 'Batch-create three short clips', projectKey: 'content', priority: 2, dueOffset: 3, section: 'Drafting' },
      { title: 'Reply to collab DM', projectKey: 'content', priority: 2, dueOffset: 0, section: 'Published', tags: ['waiting'] },
      { title: 'Draft client proposal', projectKey: 'client', priority: 4, dueOffset: 1, section: 'Active' },
      { title: 'Deliver landing page copy', projectKey: 'client', priority: 3, dueOffset: 4, section: 'Active', tags: ['follow-up'] },
      { title: 'Record voiceover', projectKey: 'client', priority: 2, dueOffset: 2, section: 'Active' },
      { title: 'Monthly invoice round-up', projectKey: 'finance', priority: 4, dueOffset: -1, important: true },
      { title: 'Tidy expense spreadsheet', projectKey: 'finance', priority: 2, dueOffset: 5 },
      { title: 'Send pitch to two podcasts', projectKey: 'brand', priority: 3, dueOffset: 6, important: true, tags: ['follow-up'] },
      { title: 'Plan content calendar for next month', projectKey: 'brand', priority: 2, dueOffset: 7, tags: ['ideas'] },
      { title: 'Back up camera footage', priority: 1, tags: ['quick'] },
      { title: 'Book studio time', priority: 2, dueOffset: 2, tags: ['errand'] },
      { title: 'Reach out to three collaborators', priority: 2, dueOffset: 4, tags: ['follow-up'] },
    ],
    extras: [
      { title: 'Film b-roll', projectKey: 'content', completed: true, completedOffset: 0 },
      { title: 'Write newsletter outline', projectKey: 'content', completed: true, completedOffset: -1 },
      { title: 'Social media audit', projectKey: 'brand', completed: true, completedOffset: -2 },
      { title: 'Update website portfolio', projectKey: 'client', completed: true, completedOffset: -2, priority: 3 },
      { title: 'Pay vendor invoice', projectKey: 'finance', completed: true, completedOffset: -3 },
    ],
  },

  life: {
    projects: [
      { key: 'home', name: 'Home', color: '#2f9e6e', icon: 'home', description: 'Chores, upkeep and projects' },
      { key: 'people', name: 'Family & friends', color: '#e7549e', icon: 'heart', description: 'People, plans and occasions' },
      { key: 'health', name: 'Health & wellness', color: '#0d9488', icon: 'dumbbell', description: 'Movement, food and rest' },
      { key: 'finance', name: 'Finances', color: '#d9a514', icon: 'creditCard', description: 'Bills, budget and savings' },
      { key: 'errands', name: 'Errands', color: '#3b82f6', icon: 'shoppingCart', description: 'Shopping and to-dos out of the house' },
    ],
    seeds: [
      { title: 'Pay electricity bill', projectKey: 'finance', priority: 4, dueOffset: 0, important: true, tags: ['blocked'] },
      { title: 'Pay credit card statement', projectKey: 'finance', priority: 3, dueOffset: -1, tags: ['follow-up'] },
      { title: 'Budget review for the month', projectKey: 'finance', priority: 2, dueOffset: 5, tags: ['deep-work'] },
      { title: 'Book dentist appointment', projectKey: 'health', priority: 3, dueOffset: 3, tags: ['waiting'] },
      { title: 'Meal prep for the week', projectKey: 'health', priority: 2, dueOffset: 0, tags: ['quick'], subtasks: [{ t: 'Pick recipes', d: true }, { t: 'Grocery list' }, { t: 'Cook batches' }] },
      { title: 'Morning walk', projectKey: 'health', priority: 1, dueOffset: 0, recurrence: every },
      { title: 'Renew gym membership', projectKey: 'health', priority: 2, dueOffset: 8, tags: ['errand'] },
      { title: 'Call mom', projectKey: 'people', priority: 2, dueOffset: 0, dueTime: '19:00' },
      { title: 'Plan date night for Friday', projectKey: 'people', priority: 3, dueOffset: 2 },
      { title: 'Order birthday gift', projectKey: 'people', priority: 3, dueOffset: 6, tags: ['errand'] },
      { title: 'Take out recycling', projectKey: 'home', priority: 1, dueOffset: 1 },
      { title: 'Water the plants', projectKey: 'home', priority: 1, dueOffset: 0, recurrence: weekly },
      { title: 'Fix leaky kitchen faucet', projectKey: 'home', priority: 2, dueOffset: 4, tags: ['waiting'] },
      { title: 'Buy groceries', projectKey: 'errands', priority: 3, dueOffset: 0, tags: ['errand'], subtasks: [{ t: 'Fruit & vegetables' }, { t: 'Dairy' }, { t: 'Bread' }] },
      { title: 'Return package at post office', projectKey: 'errands', priority: 2, dueOffset: 1, tags: ['errand'] },
      { title: 'Refill printer ink', projectKey: 'errands', priority: 1, dueOffset: 3 },
      { title: 'Organize desk drawers', priority: 1, notes: 'Declutter cables and stationery.', tags: ['quick'] },
      { title: 'Read for 20 minutes', priority: 1, dueOffset: 0 },
      { title: 'Sort photos into albums', priority: 1, dueOffset: 10, tags: ['ideas'] },
    ],
    extras: [
      { title: 'Laundry', projectKey: 'home', completed: true, completedOffset: -1 },
      { title: 'Meditation 10 minutes', projectKey: 'health', completed: true, completedOffset: -1 },
      { title: 'Stretch break', projectKey: 'health', completed: true, completedOffset: 0 },
      { title: 'Cook batch dinner', projectKey: 'health', completed: true, completedOffset: -2 },
      { title: 'Grocery top-up', projectKey: 'errands', completed: true, completedOffset: -3 },
      { title: 'Video call with sibling', projectKey: 'people', completed: true, completedOffset: -2 },
    ],
  },
}
