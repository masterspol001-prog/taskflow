import { useUIStore } from '@/store/useUIStore'
import { Modal } from '@/components/ui/Modal'
import { Kbd } from '@/components/ui/Button'
import { APP_SHORTCUTS } from '@/lib/shortcuts'

export function ShortcutsModal() {
  const open = useUIStore((s) => s.shortcutsOpen)
  const setOpen = useUIStore((s) => s.setShortcuts)

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" size="md">
      <div className="grid gap-1">
        {APP_SHORTCUTS.map((s) => (
          <div key={s.keys.join('+')} className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--tf-hover)]">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-[var(--tf-text)]">{s.label}</p>
              {s.hint && <p className="text-[12px] text-[var(--tf-text-faint)]">{s.hint}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              {s.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 rounded-xl border border-dashed border-[var(--tf-border-strong)] bg-[var(--tf-surface-2)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)]">
        Tip: in Quick Add you can type things like <b>“Finish report tomorrow at 5pm #work p3”</b> and TaskFlow parses the date, time, project and
        priority automatically.
      </p>
    </Modal>
  )
}
