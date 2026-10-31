import type { ReactNode } from 'react'

export function ChartCard({
  title,
  hint,
  empty,
  hasData,
  children,
  action,
  height = 220,
}: {
  title: string
  hint?: string
  empty: string
  hasData: boolean
  children: ReactNode
  action?: ReactNode
  height?: number
}) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-[var(--tf-text)]">{title}</h3>
        {hint ? <span className="ml-auto text-[11px] text-[var(--tf-text-faint)]">{hint}</span> : null}
        {action}
      </div>
      {hasData ? (
        <div className="min-h-[180px] w-full min-w-0" style={{ height }} role="img" aria-label={title}>
          {children}
        </div>
      ) : (
        <p className="py-8 text-center text-[13px] text-[var(--tf-text-faint)]">{empty}</p>
      )}
    </section>
  )
}
