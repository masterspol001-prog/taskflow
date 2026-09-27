import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  outline: 'btn-outline',
}

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
  icon: 'icon-btn',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', block, className = '', type = 'button', children, ...rest }, ref) => {
    const cls = [
      'btn',
      variantClass[variant],
      size === 'icon' ? sizeClass.icon : sizeClass[size],
      block ? 'w-full' : '',
      className,
    ].join(' ')
    return (
      <button ref={ref} type={type} className={cls} {...rest}>
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

/** Circular loading spinner */
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

/** Keycap used in shortcut hints */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[var(--tf-border-strong)] bg-[var(--tf-surface-2)] px-1 font-sans text-[10px] font-semibold text-[var(--tf-text-secondary)] shadow-[0_1px_0_var(--tf-border-strong)]">
      {children}
    </kbd>
  )
}
