import { useRef, useState } from 'react'
import { Palette, Bell, Database, User, Keyboard, Download, Upload, Trash2, RefreshCcw, Check, Moon, Sun, Crown, Sparkles, KeyRound } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { PRIORITIES, VIEW_META, ACCENT_OPTIONS, DEFAULT_ACCENT, PERSONAS } from '@/lib/constants'
import { Field, Input, Select, Switch } from '@/components/ui/inputs'
import { Button, Kbd } from '@/components/ui/Button'
import { isPro, isTrialing, trialDaysLeft } from '@/lib/pro'
import type { Settings as SettingsType, ViewId } from '@/lib/types'

const sectionCls = 'card p-5'
const headingCls = 'mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--tf-text-muted)]'

export function SettingsView() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const exportJSON = useStore((s) => s.exportJSON)
  const exportCSV = useStore((s) => s.exportCSV)
  const importJSON = useStore((s) => s.importJSON)
  const clearAll = useStore((s) => s.clearAll)
  const seed = useStore((s) => s.seed)
  const toast = useStore((s) => s.toast)
  const setShortcuts = useUIStore((s) => s.setShortcuts)
  const setPaywall = useUIStore((s) => s.setPaywall)
  const redeemLicense = useStore((s) => s.redeemLicense)
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [licenseDraft, setLicenseDraft] = useState('')
  const checkout = settings.checkout ?? { monthly: '', annual: '', lifetime: '' }
  const pro = isPro(settings)
  const trialing = isTrialing(settings)
  const daysLeft = trialDaysLeft(settings)

  const onImport = async (file: File) => {
    try {
      const text = await file.text()
      const res = importJSON(text)
      if (res.ok) toast({ title: 'Data imported', message: 'Your tasks and projects were restored.', kind: 'success' })
      else toast({ title: 'Import failed', message: res.error ?? 'Unrecognized file format.', kind: 'error' })
    } catch {
      toast({ title: 'Import failed', message: 'Could not read that file.', kind: 'error' })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Settings</h2>
        <p className="text-sm text-[var(--tf-text-muted)]">Make TaskFlow yours. Changes are saved automatically on this device.</p>
      </div>

      {/* Plan & Billing */}
      <section className={sectionCls} aria-label="Plan">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${pro ? 'bg-gradient-to-br from-[var(--tf-accent)] to-[#f472b6] text-white' : 'bg-[var(--tf-surface-3)] text-[var(--tf-text-muted)]'}`}>
            <Crown size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--tf-text)]">
              {settings.licenseKey ? 'TaskFlow Pro' : trialing ? 'TaskFlow Pro trial' : 'TaskFlow Free'}
              {pro && (
                <span className="rounded-full bg-[var(--tf-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--tf-accent-text)]">
                  {trialing ? `${daysLeft}d left` : 'Active'}
                </span>
              )}
            </p>
            <p className="text-xs text-[var(--tf-text-muted)]">
              {settings.licenseKey
                ? `Licensed${settings.licenseInterval ? ` · ${settings.licenseInterval}` : ''}. Goals, routines, analytics and AI are unlocked.`
                : trialing
                ? 'Trial unlocks Pro features. Buy a license before it expires to keep them.'
                : 'Free includes 40 active tasks and 3 projects. Upgrade for goals, routines, analytics and AI.'}
            </p>
          </div>
          {!settings.licenseKey && (
            <button className="btn btn-primary btn-sm" onClick={() => setPaywall(true)}>
              <Sparkles size={14} /> {trialing ? 'Buy Pro' : 'Upgrade'}
            </button>
          )}
        </div>

        {!settings.licenseKey && (
          <div className="mt-4 border-t border-[var(--tf-border)] pt-4">
            <Field label="License key" hint="Paste the key emailed after Lemon Squeezy or Stripe checkout.">
              <div className="flex gap-2">
                <Input
                  value={licenseDraft}
                  onChange={(e) => setLicenseDraft(e.target.value)}
                  placeholder="TF-YR-XXXXXXXX-XXXX"
                  aria-label="License key"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const res = redeemLicense(licenseDraft)
                    if (res.ok) setLicenseDraft('')
                    else toast({ title: 'Invalid license', message: res.error, kind: 'error' })
                  }}
                >
                  <KeyRound size={14} className="mr-1" /> Redeem
                </Button>
              </div>
            </Field>
          </div>
        )}

        <div className="mt-4 grid gap-3 border-t border-[var(--tf-border)] pt-4 sm:grid-cols-3">
          <Field label="Monthly checkout URL">
            <Input
              value={checkout.monthly}
              onChange={(e) => updateSettings({ checkout: { ...checkout, monthly: e.target.value } })}
              placeholder="https://..."
              aria-label="Monthly checkout URL"
            />
          </Field>
          <Field label="Annual checkout URL">
            <Input
              value={checkout.annual}
              onChange={(e) => updateSettings({ checkout: { ...checkout, annual: e.target.value } })}
              placeholder="https://..."
              aria-label="Annual checkout URL"
            />
          </Field>
          <Field label="Lifetime checkout URL">
            <Input
              value={checkout.lifetime}
              onChange={(e) => updateSettings({ checkout: { ...checkout, lifetime: e.target.value } })}
              placeholder="https://..."
              aria-label="Lifetime checkout URL"
            />
          </Field>
        </div>
      </section>

      {/* Profile */}
      <section className={sectionCls} aria-label="Profile">
        <h3 className={headingCls}><User size={14} /> Profile</h3>
        <Field label="Display name" hint="Shown in the header greeting and welcome screens.">
          <Input value={settings.name} onChange={(e) => updateSettings({ name: e.target.value })} placeholder="Your name" maxLength={40} />
        </Field>
        <div className="mt-4">
          <Field label="What you use TaskFlow for" hint="Tailors starter content and future insights to your life. Doesn't touch your existing tasks.">
            <Select value={settings.persona ?? 'generic'} onChange={(e) => updateSettings({ persona: (e.target.value === 'generic' ? null : e.target.value) as SettingsType['persona'] })}>
              <option value="generic">A bit of everything</option>
              {PERSONAS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* Appearance */}
      <section className={sectionCls} aria-label="Appearance">
        <h3 className={headingCls}><Palette size={14} /> Appearance</h3>
        <Field label="Theme" hint="Applies instantly across the whole app.">
          <div className="flex gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <ThemeOption key={t} mode={t} active={settings.theme === t} onSelect={() => updateSettings({ theme: t })} />
            ))}
          </div>
        </Field>

        <div className="mt-4">
          <Field label="Accent color" hint="Your accent — the personality that follows you across buttons, highlights and charts.">
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENT_OPTIONS.map((a) => {
                const active = (settings.accent ?? DEFAULT_ACCENT) === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => updateSettings({ accent: a.id })}
                    aria-pressed={active}
                    aria-label={`${a.label} accent`}
                    title={a.label}
                    className={`flex h-10 items-center gap-2 rounded-xl border px-2.5 transition-all ${
                      active
                        ? 'border-[var(--tf-accent)] shadow-[0_0_0_3px_var(--tf-ring)]'
                        : 'border-[var(--tf-border)] hover:border-[var(--tf-border-strong)]'
                    }`}
                    style={{ background: active ? 'var(--tf-accent-soft)' : 'transparent' }}
                  >
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                      style={{ background: a.hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
                    >
                      {active && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--tf-text-secondary)]">{a.label}</span>
                  </button>
                )
              })}
            </div>
          </Field>
        </div>

        <div className="mt-4">
          <SwitchRow label="Reduce motion" desc="Turn off most animations and transitions." checked={!!settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
        </div>
      </section>

      {/* Preferences */}
      <section className={sectionCls} aria-label="Preferences">
        <h3 className={headingCls}><Keyboard size={14} /> Preferences</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default priority for new tasks">
            <Select value={String(settings.defaultPriority)} onChange={(e) => updateSettings({ defaultPriority: Number(e.target.value) as 1 | 2 | 3 | 4 })}>
              {([1, 2, 3, 4] as const).map((p) => (
                <option key={p} value={p}>{PRIORITIES[p].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Start of week">
            <Select value={settings.weekStartMonday ? 'monday' : 'sunday'} onChange={(e) => updateSettings({ weekStartMonday: e.target.value === 'monday' })}>
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </Select>
          </Field>
          <Field label="Time format">
            <Select value={settings.timeFormat} onChange={(e) => updateSettings({ timeFormat: e.target.value as SettingsType['timeFormat'] })}>
              <option value="12h">12-hour (3:00 PM)</option>
              <option value="24h">24-hour (15:00)</option>
            </Select>
          </Field>
          <Field label="Default view" hint="Where TaskFlow opens first.">
            <Select value={settings.defaultView} onChange={(e) => updateSettings({ defaultView: e.target.value as ViewId })}>
              {(Object.keys(VIEW_META) as ViewId[]).map((v) => (
                <option key={v} value={v}>{VIEW_META[v].label}</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* AI assistant */}
      <section className={sectionCls} aria-label="AI assistant">
        <h3 className={headingCls}><Sparkles size={14} /> AI assistant</h3>
        {!pro ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1 text-sm text-[var(--tf-text-muted)]">
              Connect your own OpenAI-compatible model for AI day planning. Available on Pro.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={() => setPaywall(true)}>Unlock with Pro</button>
          </div>
        ) : (
          <AiConfigForm />
        )}
      </section>

      {/* Reminders */}
      <section className={sectionCls} aria-label="Notifications">
        <h3 className={headingCls}><Bell size={14} /> Reminders</h3>
        <div className="space-y-3">
          <SwitchRow
            label="Due reminders"
            desc="Get a browser notification when a task falls due — one per task, never spam."
            checked={settings.notificationsEnabled}
            onChange={(v) => {
              if (v) {
                updateSettings({ notificationsEnabled: true })
                requestNotifyPermission(toast, () => updateSettings({ notificationsEnabled: true }))
              } else {
                updateSettings({ notificationsEnabled: false })
                toast({ title: 'Reminders disabled', kind: 'info' })
              }
            }}
          />
          <Field label={`Remind ${settings.reminderLeadMinutes} minutes before the due time`} hint={reminderHint(settings.reminderLeadMinutes)}>
            <input
              type="range"
              min={0}
              max={120}
              step={5}
              value={settings.reminderLeadMinutes}
              onChange={(e) => updateSettings({ reminderLeadMinutes: Number(e.target.value) })}
              className="w-full accent-[var(--tf-accent)]"
              aria-label="Reminder lead time in minutes"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => requestNotifyPermission(toast, () => {})}>
              Check notification permission
            </Button>
          </div>
          <p className="text-[12px] text-[var(--tf-text-faint)]">
            Reminders fire while this tab is open. When granted, notifications never repeat for the same task.
          </p>
        </div>
      </section>

      {/* Shortcuts */}
      <section className={sectionCls} aria-label="Keyboard shortcuts">
        <h3 className={headingCls}><Keyboard size={14} /> Keyboard shortcuts</h3>
        <div className="grid gap-1.5 text-[13px] text-[var(--tf-text-secondary)] sm:grid-cols-2">
          <Shortcut keys={['⌘', 'K']} action="Quick add (natural language)" />
          <Shortcut keys={['/']} action="Search & filter tasks" />
          <Shortcut keys={['N']} action="New task" />
          <Shortcut keys={['Space']} action="Complete focused task" />
          <Shortcut keys={['F']} action="Start a focus session" />
          <Shortcut keys={['Esc']} action="Close dialogs / clear focus" />
        </div>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setShortcuts(true)}>
          View interactive cheat sheet
        </Button>
      </section>

      {/* Data */}
      <section className={sectionCls} aria-label="Data management">
        <h3 className={headingCls}><Database size={14} /> Data management</h3>
        <p className="mb-3 text-[13px] text-[var(--tf-text-secondary)]">
          TaskFlow is local-first: your data lives in this browser. Export a backup anytime — the JSON file is portable and includes everything.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={exportJSON}><Download size={14} className="mr-1.5" /> Export JSON backup</Button>
          <Button variant="secondary" size="sm" onClick={exportCSV}><Download size={14} className="mr-1.5" /> Export CSV</Button>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} className="mr-1.5" /> Import JSON</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} aria-label="Import JSON file" />
        </div>

        <div className="mt-5 space-y-2 border-t border-[var(--tf-border)] pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => { seed(); toast({ title: 'Sample data loaded', message: 'Sample data was added on top of your tasks.', kind: 'success' }) }}>
              <RefreshCcw size={14} className="mr-1.5" /> Reload sample data
            </Button>
          </div>
          {!confirmClear ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
              <Trash2 size={14} className="mr-1.5" /> Erase all my data
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3">
              <span className="text-[13px] font-medium text-red-500">This permanently deletes every task, project, and goal on this device.</span>
              <Button variant="danger" size="sm" onClick={() => { clearAll(); setConfirmClear(false); toast({ title: 'All data erased', kind: 'info' }) }}>
                <Check size={14} className="mr-1" /> Yes, erase everything
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </section>

      <p className="pb-4 pt-1 text-center text-[11px] text-[var(--tf-text-faint)]">
        TaskFlow · v1.0.0 · Local-first. Your data never leaves this browser.
      </p>
    </div>
  )
}

function ThemeOption({ mode, active, onSelect }: { mode: 'light' | 'dark' | 'system'; active: boolean; onSelect: () => void }) {
  const IconCmp = mode === 'light' ? Sun : mode === 'dark' ? Moon : SystemGlyph
  const label = mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-all ${
        active
          ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)] shadow-[0_0_0_3px_var(--tf-ring)]'
          : 'border-[var(--tf-border)] bg-[var(--tf-surface-2)] text-[var(--tf-text-secondary)] hover:border-[var(--tf-border-strong)]'
      }`}
    >
      <IconCmp size={16} />
      {label}
    </button>
  )
}

function SystemGlyph({ size }: { size?: number }) {
  return (
    <span className="flex items-center justify-center rounded-[5px] border border-current" style={{ width: size, height: size }}>
      <span className="block h-1.5 w-1.5 rounded-[2px] bg-current" />
    </span>
  )
}

function SwitchRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-[13.5px] font-medium text-[var(--tf-text)]">{label}</p>
        <p className="text-[12px] text-[var(--tf-text-faint)]">{desc}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function Shortcut({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-1 py-0.5">
      <span>{action}</span>
      <span className="flex gap-1">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </span>
    </div>
  )
}

function reminderHint(min: number): string {
  if (min === 0) return 'Notify at the exact due time.'
  return `We'll ping you ${min} minutes before the due time.`
}

function AiConfigForm() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const toast = useStore((s) => s.toast)
  const [baseUrl, setBaseUrl] = useState(settings.ai?.baseUrl ?? 'https://api.openai.com/v1')
  const [model, setModel] = useState(settings.ai?.model ?? 'gpt-4o-mini')
  const [apiKey, setApiKey] = useState(settings.ai?.apiKey ?? '')

  const save = () => {
    updateSettings({ ai: { baseUrl: baseUrl.trim() || 'https://api.openai.com/v1', model: model.trim() || 'gpt-4o-mini', apiKey: apiKey.trim() } })
    toast({ title: 'AI settings saved', message: 'They are stored only on this device.', kind: 'success' })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          type="password"
          label="API key"
          hint="Your key, stored only in this browser."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-…"
          autoComplete="off"
        />
        <Input
          label="Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gpt-4o-mini"
        />
        <div className="sm:col-span-2">
          <Input
            label="Base URL"
            hint="Any OpenAI-compatible endpoint."
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={save}>
          <Check size={15} /> Save AI settings
        </Button>
        {settings.ai && (
          <Button variant="ghost" onClick={() => updateSettings({ ai: null })}>
            Clear key
          </Button>
        )}
      </div>
    </div>
  )
}

function requestNotifyPermission(toast: (t: { title: string; message?: string; kind: 'success' | 'error' | 'info' }) => void, onGranted: () => void) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    toast({ title: 'Notifications not supported', message: 'This browser does not support notifications.', kind: 'info' })
    return
  }
  if (Notification.permission === 'granted') {
    toast({ title: 'Notifications enabled', kind: 'success' })
    onGranted()
    return
  }
  if (Notification.permission === 'denied') {
    toast({ title: 'Notifications are blocked', message: 'Enable them in your browser settings for this site.', kind: 'error' })
    return
  }
  Notification.requestPermission().then((p) => {
    if (p === 'granted') {
      toast({ title: 'Notifications enabled', kind: 'success' })
      onGranted()
    } else {
      toast({ title: 'Permission not granted', kind: 'info' })
    }
  })
}
