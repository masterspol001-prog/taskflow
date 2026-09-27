import { type ReactNode } from 'react'
import { Icon } from './Icon'

interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-10' : 'py-16'}`}>
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">
        <Icon name={icon} size={26} strokeWidth={1.55} />
      </div>
      <h3 className="display mt-5 text-[22px] font-semibold tracking-tight text-[var(--tf-text)]">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--tf-text-muted)]">{description}</p>}
      {action && <div className="mt-5 w-full max-w-sm">{action}</div>}
    </div>
  )
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card h-16 p-4">
          <div className="skeleton h-3 w-2/3" />
          <div className="skeleton mt-3 h-2 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', onRetry }: { title?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
        <Icon name="alertTriangle" size={26} />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-[var(--tf-text)]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--tf-text-muted)]">
        Your data is safe. Try again, and if the problem persists you can export your tasks from Settings.
      </p>
      {onRetry && (
        <button className="btn btn-secondary btn-sm mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
