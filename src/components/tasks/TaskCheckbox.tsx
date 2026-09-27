import { Check } from 'lucide-react'
import type { Priority } from '@/lib/types'

export function TaskCheckbox({
  completed,
  priority = 2,
  onToggle,
  size = 'md',
  label,
}: {
  completed: boolean
  priority?: Priority
  onToggle: () => void
  size?: 'sm' | 'md'
  label: string
}) {
  const borderColor = completed ? undefined : { 1: '#8a8ea3', 2: '#9aa3b8', 3: '#f59e0b', 4: '#e5484d' }[priority]
  const sizeCls = size === 'md' ? 'h-[21px] w-[21px]' : 'h-4 w-4'

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={completed}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`relative ${sizeCls} flex shrink-0 items-center justify-center rounded-[8px] border-2 transition-all duration-200 ease-smooth ${
        completed
          ? 'border-transparent bg-[var(--tf-accent)]'
          : 'border-current bg-transparent hover:scale-110'
      }`}
      style={!completed ? { color: borderColor, borderColor: 'currentColor' } : undefined}
    >
      <Check
        size={size === 'md' ? 13 : 11}
        strokeWidth={3.5}
        className={`text-white transition-transform duration-200 ease-smooth ${completed ? 'scale-100 animate-pop-in' : 'scale-0'}`}
      />
    </button>
  )
}
