import { KanbanBoard } from '@/components/tasks/KanbanBoard'

export function BoardView() {
  return (
    <div className="space-y-4">
      <header>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Board</h2>
        <p className="text-[13px] text-[var(--tf-text-muted)]">
          Drag open tasks between Overdue, Today, This week, and Later. Dates update on this device.
        </p>
      </header>
      <KanbanBoard />
    </div>
  )
}
