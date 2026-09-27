import { useEffect, useRef, useState, type ReactNode } from 'react'

/** Lightweight headless-style popover to avoid extra deps; used for menus. */
export function Popover({
  trigger,
  children,
  align = 'start',
  width = 'auto',
}: {
  trigger: (open: boolean) => ReactNode
  children: (close: () => void) => ReactNode
  align?: 'start' | 'end'
  width?: number | string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div className="relative inline-block" ref={rootRef}>
      <div onClick={() => setOpen((v) => !v)}>{trigger(open)}</div>
      {open && (
        <div
          className={`absolute z-30 mt-1.5 min-w-44 overflow-hidden rounded-xl border border-[var(--tf-border)] bg-[var(--tf-elevated)] p-1 shadow-pop animate-scale-in ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  onClick,
  children,
  danger,
  icon,
  disabled,
}: {
  onClick?: () => void
  children: ReactNode
  danger?: boolean
  icon?: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors disabled:opacity-40 ${
        danger
          ? 'text-red-500 hover:bg-red-500/10'
          : 'text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]'
      }`}
    >
      {icon && <span className="flex w-4 justify-center">{icon}</span>}
      {children}
    </button>
  )
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-[var(--tf-border)]" />
}

export function MenuHeader({ children }: { children: ReactNode }) {
  return <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--tf-text-faint)]">{children}</div>
}
