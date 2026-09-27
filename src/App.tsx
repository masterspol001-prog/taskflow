import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { ViewRouter } from '@/components/views/ViewRouter'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header, BottomNav } from '@/components/layout/Header'
import { TaskEditorModal } from '@/components/tasks/TaskEditorModal'
import { QuickAddModal } from '@/components/tasks/QuickAddModal'
import { ProjectModal } from '@/components/projects/ProjectModal'
import { SearchOverlay } from '@/components/search/SearchOverlay'
import { ShortcutsModal } from '@/components/shortcuts/ShortcutsModal'
import { GlobalShortcuts } from '@/components/shortcuts/GlobalShortcuts'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { FocusOverlay } from '@/components/focus/FocusOverlay'
import { AiOverlay } from '@/components/ai/AiOverlay'
import { PaywallModal } from '@/components/paywall/PaywallModal'
import { ReminderWatcher } from '@/components/reminders/ReminderWatcher'
import { ThemeSyncer } from '@/theme'
import { ToastHost } from '@/components/ui/ToastHost'

export default function App() {
  const hydrated = useStore((s) => s.hydrated)
  const onboarded = useStore((s) => s.settings.onboarded)
  const setOnboarding = useUIStore((s) => s.setOnboarding)
  const route = useUIStore((s) => s.route)
  const navigate = useUIStore((s) => s.navigate)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [initialViewApplied, setInitialViewApplied] = useState(false)

  // Open onboarding once the store is hydrated and the user hasn't finished it.
  useEffect(() => {
    if (hydrated && !onboarded) {
      setOnboarding(true)
    }
  }, [hydrated, onboarded, setOnboarding])

  // Apply the user's default view once, on first load.
  useEffect(() => {
    if (!hydrated || initialViewApplied) return
    setInitialViewApplied(true)
    navigate(useStore.getState().settings.defaultView)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, initialViewApplied])

  if (!hydrated) {
    return (
      <div className="accent-wash flex min-h-screen items-center justify-center">
        <div className="relative z-10 text-center">
          <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--tf-accent-light)] to-[var(--tf-accent-deep)] text-white glow-lg">
            <span className="text-xl font-black">✓</span>
          </div>
          <p className="display mt-4 text-[15px] font-medium text-[var(--tf-text-muted)]">Loading your workspace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="accent-wash min-h-screen text-[var(--tf-text)]">
      <ThemeSyncer />
      <GlobalShortcuts />
      <ReminderWatcher />

      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] border-r border-[var(--tf-border)] bg-[var(--tf-sidebar)] backdrop-blur-xl lg:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-[var(--tf-overlay)] animate-fade-in backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[88vw] overflow-y-auto bg-[var(--tf-sidebar)] shadow-modal backdrop-blur-xl animate-slide-down">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="relative z-[1] flex min-h-screen flex-col lg:pl-[17.5rem]">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 pb-28 lg:pb-12" key={`${route.view}:${route.projectId ?? ''}:${route.section ?? ''}`}>
          <ViewRouter />
        </main>
      </div>

      {/* Bottom navigation (mobile) */}
      <BottomNav />

      {/* Overlays */}
      <TaskEditorModal />
      <ProjectModal />
      <QuickAddModal />
      <SearchOverlay />
      <ShortcutsModal />
      <OnboardingModal />
      <FocusOverlay />
      <AiOverlay />
      <PaywallModal />
      <ToastHost />
    </div>
  )
}
