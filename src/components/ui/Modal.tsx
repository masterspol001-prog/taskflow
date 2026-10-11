import { useEffect, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Center dialog, or right-side drawer on sm+ / bottom sheet on mobile. Default 'center'. */
  variant?: 'center' | 'drawer'
  /** Render an overlay-click-to-close barrier. Default true. */
  closable?: boolean
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, footer, size = 'md', variant = 'center', closable = true }: ModalProps) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose()
    },
    [onClose, closable]
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onKey])

  if (!open) return null

  const isDrawer = variant === 'drawer'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center ${isDrawer ? 'sm:justify-end sm:items-stretch' : 'sm:items-center sm:p-4'}`}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div
        className="absolute inset-0 bg-[var(--tf-overlay)] animate-fade-in backdrop-blur-[6px]"
        onClick={() => closable && onClose()}
        aria-hidden="true"
      />
      <div
        className={`relative flex w-full flex-col overflow-hidden bg-[var(--tf-surface)] shadow-modal ${
          isDrawer
            ? 'max-h-[92vh] rounded-t-[1.6rem] animate-slide-up sm:max-h-none sm:rounded-none sm:rounded-l-[1.6rem] sm:animate-slide-in-right sm:max-w-md'
            : `max-h-[92vh] animate-slide-up rounded-t-[1.6rem] sm:rounded-[1.6rem] ${sizeClass[size]}`
        }`}
      >
        {(title || closable) && (
          <div className="flex items-center justify-between gap-4 border-b border-[var(--tf-border)] px-5 py-3.5">
            <h2 className="text-[15px] font-semibold text-[var(--tf-text)]">{title}</h2>
            {closable && (
              <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--tf-border)] bg-[var(--tf-surface-2)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
