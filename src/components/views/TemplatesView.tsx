import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { useUIStore } from '@/store/useUIStore'
import { WORKFLOW_TEMPLATES } from '@/lib/workspace'

export function TemplatesView() {
  const applyWorkflow = useStore((s) => s.applyWorkflow)
  const navigate = useUIStore((s) => s.navigate)
  const [previewId, setPreviewId] = useState<string | null>(WORKFLOW_TEMPLATES[0]?.id ?? null)
  const preview = WORKFLOW_TEMPLATES.find((t) => t.id === previewId) ?? WORKFLOW_TEMPLATES[0]

  return (
    <div className="space-y-5">
      <header>
        <h2 className="display text-[28px] font-semibold tracking-tight text-[var(--tf-text)]">Templates</h2>
        <p className="text-[13px] text-[var(--tf-text-muted)]">Reusable workflows. Preview, then create. Nothing is saved until you apply.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <ul className="space-y-1.5">
          {WORKFLOW_TEMPLATES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={`w-full rounded-xl border px-3 py-2.5 text-left ${preview?.id === t.id ? 'border-[var(--tf-accent)] bg-[var(--tf-accent-soft)]' : 'border-[var(--tf-border)] hover:bg-[var(--tf-hover)]'}`}
                onClick={() => setPreviewId(t.id)}
              >
                <p className="text-[14px] font-medium text-[var(--tf-text)]">{t.name}</p>
                <p className="text-[12px] text-[var(--tf-text-muted)]">{t.blurb}</p>
              </button>
            </li>
          ))}
        </ul>
        {preview && (
          <div className="card space-y-3 p-4">
            <p className="text-[15px] font-semibold text-[var(--tf-text)]">{preview.projectName}</p>
            <ol className="space-y-1.5">
              {preview.steps.map((s, i) => (
                <li key={s.title} className="text-[13px] text-[var(--tf-text-secondary)]">
                  {i + 1}. {s.title}
                  {typeof s.dependsOnIndex === 'number' ? ` · after step ${s.dependsOnIndex + 1}` : ''}
                </li>
              ))}
            </ol>
            <button
              className="btn btn-primary"
              onClick={() => {
                const created = applyWorkflow(preview.id)
                if (created) navigate('all', { projectId: created.id })
              }}
            >
              Create this project
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
