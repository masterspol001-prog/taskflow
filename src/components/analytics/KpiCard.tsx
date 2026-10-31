import type { ReactNode } from 'react'

export function KpiCard({
  icon,
  label,
  value,
  suffix,
  sub,
  onClick,
  accent,
}: {
  icon: ReactNode
  label: string
  value: number | string
  suffix?: string
  sub: string
  onClick?: () => void
  accent?: boolean
}) {
  const Comp: React.ElementType = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`card flex flex-col gap-1.5 p-4 text-left transition-shadow ${onClick ? 'hover:shadow-pop' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-text-muted)]">{label}</span>
        {icon}
      </div>
      <div className={`text-[26px] font-bold leading-none tracking-tight tabular-nums ${accent ? 'text-[var(--tf-accent-text-strong)]' : 'text-[var(--tf-text)]'}`}>
        {value}
        {suffix ? <span className="ml-1 text-[13px] font-medium text-[var(--tf-text-muted)]">{suffix}</span> : null}
      </div>
      <span className="text-[11.5px] text-[var(--tf-text-faint)]">{sub}</span>
    </Comp>
  )
}
