export interface ShortcutDef {
  keys: string[]
  label: string
  hint?: string
}

export const APP_SHORTCUTS: ShortcutDef[] = [
  { keys: ['⌘', 'K'], label: 'Quick add', hint: 'Natural-language task creation, right from the keyboard.' },
  { keys: ['/'], label: 'Search & filter', hint: 'Combine keywords with project, priority and due filters.' },
  { keys: ['N'], label: 'New task', hint: 'When not typing in a field.' },
  { keys: ['F'], label: 'Focus mode', hint: 'Start a Pomodoro, countdown or stopwatch.' },
  { keys: ['?'], label: 'This cheat sheet' },
  { keys: ['Esc'], label: 'Close anything', hint: 'Dialogs, search and quick add.' },
  { keys: ['Space'], label: 'Complete a task', hint: 'Tab to any task checkbox, then press Space.' },
]
