import { useEffect, useCallback, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'center' | 'drawer'
  closable?: boolean
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, children, footer, size = 'md', variant = 'center', closable = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<HTMLElement | null>(null)
  const titleId = 'tf-modal-title'
  const labelled = typeof title === 'string' && title.length > 0

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled'))
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onClose, closable]
  )

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const id = window.setTimeout(() => {
      const root = panelRef.current
      if (!root) return
      const target = root.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      lastFocus.current?.focus()
    }
  }, [open, onKey])

  if (!open) return null

  const isDrawer = variant === 'drawer'

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center ${isDrawer ? 'sm:justify-end sm:items-stretch' : 'sm:items-center sm:p-4'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelled ? titleId : undefined}
      aria-label={labelled ? undefined : 'Dialog'}
    >
      <div
        className="absolute inset-0 bg-[var(--tf-overlay)] animate-fade-in backdrop-blur-[6px]"
        onClick={() => closable && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`relative flex w-full flex-col overflow-hidden bg-[var(--tf-surface)] shadow-modal ${
          isDrawer
            ? 'max-h-[92vh] rounded-t-[1.6rem] animate-slide-up sm:max-h-none sm:rounded-none sm:rounded-l-[1.6rem] sm:animate-slide-in-right sm:max-w-md'
            : `max-h-[92vh] animate-slide-up rounded-t-[1.6rem] sm:rounded-[1.6rem] ${sizeClass[size]}`
        }`}
      >
        {(title || closable) && (
          <div className="flex items-center justify-between gap-4 border-b border-[var(--tf-border)] px-5 py-3.5">
            <h2 id={titleId} className="text-[15px] font-semibold text-[var(--tf-text)]">{title}</h2>
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
