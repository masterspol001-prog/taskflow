import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Sparkles, Sun, Moon, Zap, Inbox, Lock, Target, Repeat } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { Button } from '@/components/ui/Button'
import { ACCENT_OPTIONS, APP_NAME, DEFAULT_ACCENT, PERSONAS, personaMeta } from '@/lib/constants'
import { Icon } from '@/components/ui/Icon'
import type { AccentId, PersonaId, ThemeMode } from '@/lib/types'

const MAX = 4

export function OnboardingModal() {
  const open = useUIStore((s) => s.onboardingOpen)
  const setOpen = useUIStore((s) => s.setOnboarding)
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const completeOnboarding = useStore((s) => s.completeOnboarding)
  const navigate = useUIStore((s) => s.navigate)
  const [step, setStep] = useState(0)
  const [name, setName] = useState(settings.name || '')

  if (!open) return null

  const displayName = name.trim() || settings.name || 'there'
  const persona = settings.persona

  const pickPersona = (id: PersonaId) => updateSettings({ persona: id })

  const finish = () => {
    updateSettings({ name: name.trim() || settings.name || 'Friend' })
    completeOnboarding()
    setOpen(false)
    navigate('today')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Welcome to TaskFlow">
      <div className="absolute inset-0 bg-[var(--tf-overlay)] backdrop-blur-md animate-fade-in" aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--tf-border)] bg-[var(--tf-surface)] shadow-modal animate-scale-in">
        {/* progress */}
        <div className="flex gap-1.5 px-6 pt-5" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-[var(--tf-accent)]' : 'bg-[var(--tf-surface-3)]'}`} />
          ))}
        </div>

        <div className="overflow-y-auto px-6 py-6">
          {step === 0 && (
            <WelcomeStep displayName={displayName} onNext={() => setStep(1)} />
          )}
          {step === 1 && (
            <NameStep
              name={name}
              onChange={setName}
              onBack={() => setStep(0)}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <PersonaStep
              persona={persona}
              onPick={pickPersona}
              onSkip={() => pickPersona('life')}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <LookStep
              theme={settings.theme}
              accent={settings.accent}
              onTheme={(t) => updateSettings({ theme: t })}
              onAccent={(a) => updateSettings({ accent: a })}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && <TourStep displayName={displayName} persona={persona} onBack={() => setStep(3)} onFinish={finish} />}
        </div>
      </div>
    </div>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[300px] flex-col">{children}</div>
}

function WelcomeStep({ displayName, onNext }: { displayName: string; onNext: () => void }) {
  const features = [
    { IconCmp: Zap, text: 'Quick-add in plain English — “report tomorrow 5pm #work p3”' },
    { IconCmp: Target, text: 'A Dashboard with streaks, scores and weekly rhythm' },
    { IconCmp: Repeat, text: 'Recurring tasks, reminders and a full Focus mode' },
    { IconCmp: Lock, text: 'Local-first & private — your data stays on this device' },
  ]
  return (
    <Frame>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--tf-accent-light)] to-[var(--tf-accent-deep)] text-white glow-lg">
        <Sparkles size={22} />
      </div>
      <h2 className="display mt-4 text-[26px] font-semibold tracking-tight text-[var(--tf-text)]">
        Hey {displayName === 'there' ? 'there' : displayName} — welcome to {APP_NAME}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--tf-text-secondary)]">
        A calm, fast way to capture tasks, focus on what matters, and feel the momentum of a good week.
      </p>
      <ul className="mt-5 space-y-2.5 text-[13.5px] text-[var(--tf-text-secondary)]">
        {features.map(({ IconCmp, text }) => (
          <li key={text} className="flex items-start gap-2.5">
            <IconCmp size={16} className="mt-0.5 shrink-0 text-[var(--tf-accent-text)]" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex justify-end pt-6">
        <Button variant="primary" onClick={onNext}>
          Get started <ArrowRight size={15} className="ml-1" />
        </Button>
      </div>
    </Frame>
  )
}

function NameStep({ name, onChange, onBack, onNext }: { name: string; onChange: (v: string) => void; onBack: () => void; onNext: () => void }) {
  return (
    <Frame>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">
        <Zap size={22} />
      </div>
      <h2 className="display mt-4 text-[22px] font-semibold tracking-tight text-[var(--tf-text)]">What should we call you?</h2>
      <p className="mt-1.5 text-[14px] text-[var(--tf-text-secondary)]">Used for the greeting on your dashboard.</p>
      <input
        autoFocus
        value={name}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onNext()}
        placeholder="Your name"
        className="input mt-4"
        aria-label="Your name"
      />
      <div className="mt-auto flex items-center justify-between pt-6">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} className="mr-1" /> Back</Button>
        <Button variant="primary" onClick={onNext}>Continue <ArrowRight size={15} className="ml-1" /></Button>
      </div>
    </Frame>
  )
}

function PersonaStep({
  persona,
  onPick,
  onSkip,
  onBack,
  onNext,
}: {
  persona: PersonaId | null
  onPick: (id: PersonaId) => void
  onSkip: () => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <Frame>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">
        <Icon name="sparkles" size={22} />
      </div>
      <h2 className="display mt-4 text-[22px] font-semibold tracking-tight text-[var(--tf-text)]">What kind of weeks do you run?</h2>
      <p className="mt-1.5 text-[14px] text-[var(--tf-text-secondary)]">
        Pick the closest match — {APP_NAME} will shape your starter projects, tasks and wording around it. You can change this later.
      </p>

      <div className="mt-5 grid gap-2">
        {PERSONAS.map((p) => {
          const active = persona === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              aria-pressed={active}
              className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                active
                  ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] shadow-[0_0_0_3px_var(--tf-ring)]'
                  : 'border-[var(--tf-border)] bg-[var(--tf-surface-2)] hover:border-[var(--tf-border-strong)]'
              }`}
            >
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  active ? 'bg-[var(--tf-accent)] text-white' : 'bg-[var(--tf-surface-3)] text-[var(--tf-text-secondary)]'
                }`}
              >
                <Icon name={p.icon} size={18} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--tf-text)]">
                  {p.label}
                  {active && <Check size={14} className="text-[var(--tf-accent-text)]" />}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--tf-text-secondary)]">{p.blurb}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-auto flex items-center justify-between pt-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} className="mr-1" /> Back</Button>
          {!persona && (
            <button type="button" onClick={onSkip} className="text-[12px] font-medium text-[var(--tf-text-faint)] underline-offset-2 hover:text-[var(--tf-text-secondary)] hover:underline">
              Skip for now
            </button>
          )}
        </div>
        <Button variant="primary" disabled={!persona} onClick={onNext}>
          Continue <ArrowRight size={15} className="ml-1" />
        </Button>
      </div>
    </Frame>
  )
}

function LookStep({
  theme,
  accent,
  onTheme,
  onAccent,
  onBack,
  onNext,
}: {
  theme: ThemeMode
  accent: AccentId
  onTheme: (t: ThemeMode) => void
  onAccent: (a: AccentId) => void
  onBack: () => void
  onNext: () => void
}) {
  const options = [
    { id: 'light' as const, label: 'Light', IconCmp: Sun },
    { id: 'dark' as const, label: 'Dark', IconCmp: Moon },
    { id: 'system' as const, label: 'System', IconCmp: () => <span className="text-[15px] font-bold leading-none">A</span> },
  ]
  const currentAccent = accent ?? DEFAULT_ACCENT
  return (
    <Frame>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--tf-accent-light)] to-[var(--tf-accent-deep)] text-white glow-lg">
        <Sparkles size={22} />
      </div>
      <h2 className="display mt-4 text-[22px] font-semibold tracking-tight text-[var(--tf-text)]">Make it yours</h2>
      <p className="mt-1.5 text-[14px] text-[var(--tf-text-secondary)]">This is the color that will follow you around {APP_NAME}. Change it anytime in Settings.</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {options.map(({ id, label, IconCmp }) => (
          <button
            key={id}
            onClick={() => onTheme(id)}
            aria-pressed={theme === id}
            className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-3.5 text-[13px] font-semibold transition-all ${
              theme === id
                ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)] shadow-[0_0_0_3px_var(--tf-ring)]'
                : 'border-[var(--tf-border)] bg-[var(--tf-surface-2)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-strong)]'
            }`}
          >
            <IconCmp size={20} />
            {label}
            {theme === id && <Check size={13} className="text-[var(--tf-accent-text)]" />}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[12px] font-semibold text-[var(--tf-text-secondary)]">Accent color</p>
        <div className="flex flex-wrap items-center gap-2.5">
          {ACCENT_OPTIONS.map((a) => {
            const active = currentAccent === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onAccent(a.id)}
                aria-pressed={active}
                aria-label={`${a.label} accent`}
                title={a.label}
                className={`flex h-10 items-center gap-2 rounded-xl border px-2.5 transition-all ${
                  active ? 'border-[var(--tf-accent)] shadow-[0_0_0_3px_var(--tf-ring)]' : 'border-[var(--tf-border)] hover:border-[var(--tf-border-strong)]'
                }`}
                style={{ background: active ? 'var(--tf-accent-soft)' : 'transparent' }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: a.hex }}>
                  {active && <Check size={13} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-6">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} className="mr-1" /> Back</Button>
        <Button variant="primary" onClick={onNext}>Continue <ArrowRight size={15} className="ml-1" /></Button>
      </div>
    </Frame>
  )
}

function TourStep({ displayName, persona, onBack, onFinish }: { displayName: string; persona: PersonaId | null; onBack: () => void; onFinish: () => void }) {
  const meta = personaMeta(persona)
  return (
    <Frame>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text)]">
        <Inbox size={22} />
      </div>
      <h2 className="display mt-4 text-[22px] font-semibold tracking-tight text-[var(--tf-text)]">
        You're all set{displayName && displayName !== 'there' ? `, ${displayName}` : ''}
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[var(--tf-text-secondary)]">
        {meta
          ? <>We built a starter set for <b>{meta.label.toLowerCase()}</b> — projects, tasks and a healthy dashboard — so you can explore right away.</>
          : 'We added a balanced sample workspace so you can explore right away.'}
      </p>
      <ul className="mt-4 space-y-2 text-[13px] text-[var(--tf-text-secondary)]">
        <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[var(--tf-accent-text)]" /> Your <b>7-day Pro trial</b> is already on — Goals, Routines, analytics and AI.</li>
        <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[var(--tf-accent-text)]" /> Check <b>Today</b> for what's due.</li>
        <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[var(--tf-accent-text)]" /> Press <b>⌘K</b> anywhere to Quick Add.</li>
        <li className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-[var(--tf-accent-text)]" /> Delete sample data anytime from <b>Settings → Data</b>.</li>
      </ul>
      <div className="mt-auto flex items-center justify-between pt-6">
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} className="mr-1" /> Back</Button>
        <Button variant="primary" onClick={onFinish}>
          Start using {APP_NAME} <ArrowRight size={15} className="ml-1" />
        </Button>
      </div>
    </Frame>
  )
}
