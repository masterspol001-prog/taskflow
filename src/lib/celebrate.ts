const DONE = ['Done.', 'That is the one.', 'Closed.', 'Nice.', 'Forward.']

export function doneLine(): string {
  return DONE[Math.floor(Math.random() * DONE.length)] ?? 'Done.'
}
