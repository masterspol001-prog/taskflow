import { useEffect } from 'react'
import { useUIStore } from '@/store/useUIStore'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function GlobalShortcuts() {
  const setQuickAdd = useUIStore((s) => s.setQuickAdd)
  const setSearch = useUIStore((s) => s.setSearch)
  const setShortcuts = useUIStore((s) => s.setShortcuts)
  const setFocus = useUIStore((s) => s.setFocus)
  const openNewTask = useUIStore((s) => s.openNewTask)
  const closeTaskModal = useUIStore((s) => s.closeTaskModal)
  const setAi = useUIStore((s) => s.setAi)
  const setPaywall = useUIStore((s) => s.setPaywall)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const ui = useUIStore.getState()

      if (e.key === 'Escape') {
        if (ui.quickAddOpen) { e.preventDefault(); setQuickAdd(false); return }
        if (ui.searchOpen) { e.preventDefault(); setSearch(false); return }
        if (ui.shortcutsOpen) { e.preventDefault(); setShortcuts(false); return }
        if (ui.focusOpen) { e.preventDefault(); setFocus(false); return }
        if (ui.aiOpen) { e.preventDefault(); setAi(false); return }
        if (ui.paywallOpen) { e.preventDefault(); setPaywall(false); return }
        if (ui.taskModal.open) { e.preventDefault(); closeTaskModal(); return }
        return
      }

      if (mod && (e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setQuickAdd(!ui.quickAddOpen)
        return
      }

      if (mod || e.altKey) return
      if (isTypingTarget(e.target)) return

      switch (e.key) {
        case '/':
          e.preventDefault()
          setSearch(true)
          break
        case 'n':
        case 'N':
          e.preventDefault()
          openNewTask()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          setFocus(true)
          break
        case 't':
        case 'T':
          e.preventDefault()
          ui.navigate('today')
          break
        case 'u':
        case 'U':
          e.preventDefault()
          ui.navigate('upcoming')
          break
        case 'i':
        case 'I':
          e.preventDefault()
          ui.navigate('inbox')
          break
        case 'g':
        case 'G':
          e.preventDefault()
          ui.navigate('goals')
          break
        case 'c':
        case 'C':
          e.preventDefault()
          ui.navigate('calendar')
          break
        case 'd':
        case 'D':
          e.preventDefault()
          ui.navigate('dashboard')
          break
        case '?':
          e.preventDefault()
          setShortcuts(true)
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setQuickAdd, setSearch, setShortcuts, setFocus, openNewTask, closeTaskModal, setAi, setPaywall])

  return null
}
