import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react'

interface BaseProps {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & BaseProps
>(({ label, hint, error, leftIcon, className = '', ...rest }, ref) => {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <div className="relative">
        {leftIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tf-text-muted)]">{leftIcon}</span>}
        <input
          ref={ref}
          className={`input ${leftIcon ? 'pl-9' : ''} ${className}`}
          aria-invalid={!!error}
          {...rest}
        />
      </div>
      {hint && !error && <span className="text-xs text-[var(--tf-text-muted)]">{hint}</span>}
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
    </div>
  )
})
Input.displayName = 'Input'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & BaseProps
>(({ label, hint, error, className = '', ...rest }, ref) => {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <textarea ref={ref} className={`input ${className}`} aria-invalid={!!error} {...rest} />
      {hint && !error && <span className="text-xs text-[var(--tf-text-muted)]">{hint}</span>}
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
    </div>
  )
})
Textarea.displayName = 'Textarea'

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & BaseProps
>(({ label, hint, error, children, className = '', ...rest }, ref) => {
  return (
    <div className="field">
      {label && <span className="field-label">{label}</span>}
      <select ref={ref} className={`input ${className}`} aria-invalid={!!error} {...rest}>
        {children}
      </select>
      {hint && !error && <span className="text-xs text-[var(--tf-text-muted)]">{hint}</span>}
      {error && <span className="text-xs font-medium text-red-500">{error}</span>}
    </div>
  )
})
Select.displayName = 'Select'

export function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  id?: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-[var(--tf-accent)]' : 'bg-[var(--tf-surface-3)]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--tf-text-muted)]">{hint}</span>}
    </div>
  )
}
