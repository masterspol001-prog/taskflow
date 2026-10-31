import { useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmState {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  state,
  onClose,
}: {
  state: ConfirmState | null
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await state?.onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={state?.title ?? ''}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={confirm} disabled={busy}>
            {busy ? 'Working…' : state?.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="text-sm text-[var(--tf-text-secondary)]">{state?.message}</div>
    </Modal>
  )
}
