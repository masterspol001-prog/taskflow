export interface ShortcutDef {
  keys: string[]
  label: string
  hint?: string
}

export const APP_SHORTCUTS: ShortcutDef[] = [
  { keys: ['⌘', 'K'], label: 'Quick add', hint: 'Natural-language task creation, right from the keyboard.' },
  { keys: ['/'], label: 'Search & commands', hint: 'Plan my day, Start focus, Ask AI, Create goal.' },
  { keys: ['N'], label: 'New task', hint: 'When not typing in a field.' },
  { keys: ['F'], label: 'Focus mode', hint: 'Start a Pomodoro, countdown or stopwatch.' },
  { keys: ['T'], label: 'Today' },
  { keys: ['U'], label: 'Upcoming' },
  { keys: ['I'], label: 'Inbox' },
  { keys: ['G'], label: 'Goals' },
  { keys: ['C'], label: 'Calendar' },
  { keys: ['D'], label: 'Insights' },
  { keys: ['?'], label: 'This cheat sheet' },
  { keys: ['Esc'], label: 'Close anything', hint: 'Dialogs, search and quick add.' },
  { keys: ['Space'], label: 'Complete a task', hint: 'Tab to any task checkbox, then press Space.' },
]
