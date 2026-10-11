import { useEffect, useState } from 'react'
import { Check, X, Plus, Trash2, Archive, RotateCcw, Folder } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { PROJECT_COLORS, PROJECT_ICONS } from '@/lib/constants'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/inputs'
import { ConfirmDialog, type ConfirmState } from '@/components/ui/ConfirmDialog'

export function ProjectModal() {
  const { projectModal, closeProjectModal } = useUIStore()
  const projects = useStore((s) => s.projects)
  const { addProject, updateProject, removeProject, toggleProjectArchive, addSection, removeSection, toast } = useStore()
  const navigate = useUIStore((s) => s.navigate)

  const editing = projectModal.projectId ? projects.find((p) => p.id === projectModal.projectId) : undefined

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(PROJECT_COLORS.grape)
  const [icon, setIcon] = useState<string>('briefcase')
  const [sectionName, setSectionName] = useState('')
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)

  useEffect(() => {
    if (!projectModal.open) return
    setName(editing?.name ?? '')
    setDescription(editing?.description ?? '')
    setColor(editing?.color ?? PROJECT_COLORS.grape)
    setIcon(editing?.icon ?? 'briefcase')
    setSectionName('')
    setConfirm(null)
  }, [projectModal.open, projectModal.projectId, editing?.id, editing?.name, editing?.description, editing?.color, editing?.icon])

  if (!projectModal.open) return null

  const valid = name.trim().length > 0

  const handleSubmit = () => {
    if (!valid) return
    if (editing) {
      updateProject(editing.id, { name: name.trim(), description: description.trim(), color, icon })
      toast({ title: 'Project updated', kind: 'success' })
      closeProjectModal()
    } else {
      const p = addProject(name.trim(), color)
      if (!p) return
      updateProject(p.id, { icon, description: description.trim() })
      toast({ title: 'Project created', kind: 'success' })
      closeProjectModal()
      navigate('all', { projectId: p.id })
    }
  }

  return (
    <>
      <Modal
        open={projectModal.open}
        onClose={closeProjectModal}
        title={editing ? `Edit ${editing.name}` : 'New project'}
        size="md"
        footer={
          <>
            {editing && (
              <Button variant="ghost" size="sm" onClick={() => setConfirm({ title: `Delete “${editing.name}”?`, message: 'The project will be removed and its tasks will move to your Inbox.', confirmLabel: 'Delete project', danger: true, onConfirm: () => { removeProject(editing.id); toast({ title: 'Project deleted', message: 'Its tasks were moved to Inbox.', kind: 'info' }); closeProjectModal() } })}>
                <Trash2 size={14} className="mr-1" /> Delete
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="ghost" onClick={closeProjectModal}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={!valid}>
              {editing ? 'Save changes' : 'Create project'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website redesign" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} aria-label="Project name" />
          </Field>

          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {Object.entries(PROJECT_COLORS).map(([key, hex]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(hex)}
                  aria-label={`Color ${key}`}
                  aria-pressed={color === hex}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110"
                  style={{ background: hex }}
                >
                  {color === hex && <Check size={15} strokeWidth={3} className="text-white" />}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Icon">
            <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto">
              {Object.keys(PROJECT_ICONS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  aria-label={`Icon ${key}`}
                  aria-pressed={icon === key}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    icon === key ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)] text-[var(--tf-accent-text-strong)]' : 'border-[var(--tf-border)] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]'
                  }`}
                >
                  <Icon name={key} size={16} />
                </button>
              ))}
            </div>
          </Field>

          <Field label="Description" hint="Optional — shown at the top of the project.">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about?" aria-label="Project description" />
          </Field>

          {editing && (
            <div className="rounded-xl border border-[var(--tf-border)] p-3">
              <div className="mb-2 flex items-center gap-2">
                <Folder size={14} className="text-[var(--tf-text-muted)]" />
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-[var(--tf-text-muted)]">Sections</h4>
              </div>
              {editing.sections.length === 0 && <p className="mb-2 text-[12px] text-[var(--tf-text-faint)]">No sections yet. Add one to organize tasks, e.g. “Active” or “Later”.</p>}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {editing.sections.map((s) => (
                  <span key={s} className="flex items-center gap-1 rounded-full bg-[var(--tf-surface-3)] py-1 pl-2.5 pr-1 text-[12px] font-medium text-[var(--tf-text-secondary)]">
                    {s}
                    <button className="icon-btn h-5 w-5" onClick={() => { removeSection(editing.id, s); toast({ title: 'Section removed', message: 'Its tasks moved to the project top level.', kind: 'info' }) }} aria-label={`Remove section ${s}`}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const v = sectionName.trim()
                  if (v) {
                    addSection(editing.id, v)
                    setSectionName('')
                  }
                }}
              >
                <Input value={sectionName} onChange={(e) => setSectionName(e.target.value)} placeholder="New section…" className="flex-1" aria-label="New section name" />
                <Button variant="secondary" size="sm" type="submit"><Plus size={14} /> Add</Button>
              </form>
            </div>
          )}

          {editing && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => { toggleProjectArchive(editing.id); toast({ title: editing.archived ? 'Project restored' : 'Project archived', kind: 'success' }) }}>
                {editing.archived ? <><RotateCcw size={14} className="mr-1" /> Restore project</> : <><Archive size={14} className="mr-1" /> Archive project</>}
              </Button>
              <span className="text-[12px] text-[var(--tf-text-faint)]">Archived projects are hidden from the sidebar list.</span>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}
