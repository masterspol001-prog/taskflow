import { useEffect } from 'react'
import { useUIStore } from '@/store/useUIStore'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function GlobalShortcuts() {
  const setQuickAdd = useUIStore((s) => s.setQuickAdd)
  const quickAddOpen = useUIStore((s) => s.quickAddOpen)
  const setSearch = useUIStore((s) => s.setSearch)
  const setShortcuts = useUIStore((s) => s.setShortcuts)
  const setFocus = useUIStore((s) => s.setFocus)
  const openNewTask = useUIStore((s) => s.openNewTask)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && (e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setQuickAdd(!quickAddOpen)
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
        case '?':
          e.preventDefault()
          setShortcuts(true)
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setQuickAdd, quickAddOpen, setSearch, setShortcuts, setFocus, openNewTask])

  return null
}
