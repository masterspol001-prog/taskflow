import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { ToastMsg } from '@/store/useStore'

const kindIcon = {
  success: <CheckCircle2 size={18} className="text-emerald-500" aria-hidden="true" />,
  error: <AlertCircle size={18} className="text-red-500" aria-hidden="true" />,
  info: <Info size={18} className="text-[var(--tf-accent-text)]" aria-hidden="true" />,
}

function ToastView({ toast }: { toast: ToastMsg }) {
  const dismissToast = useStore((s) => s.dismissToast)
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-[var(--tf-border)] bg-[var(--tf-surface)] p-3.5 shadow-modal backdrop-blur-xl animate-toast-in"
    >
      <div className="mt-0.5">{kindIcon[toast.kind]}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--tf-text)]">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-[13px] text-[var(--tf-text-secondary)]">{toast.message}</p>}
      </div>
      <button className="icon-btn -mr-1 -mt-1" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
        <X size={15} />
      </button>
    </div>
  )
}

export function ToastHost() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:bottom-6">
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} />
      ))}
    </div>
  )
}
