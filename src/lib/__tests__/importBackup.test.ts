import { describe, it, expect } from 'vitest'
import { previewImportJSON } from '@/lib/importBackup'

describe('previewImportJSON', () => {
  it('counts collections without applying', () => {
    const preview = previewImportJSON(
      JSON.stringify({
        tasks: [
          { title: 'A', completed: false },
          { title: 'B', completed: true },
        ],
        projects: [{ name: 'P' }],
        notes: [{ title: 'N' }],
        goals: [],
        reviews: [{ weekOf: '2026-01-01' }],
        savedFilters: [{ name: 'Urgent' }],
      })
    )
    expect(preview.ok).toBe(true)
    if (!preview.ok) return
    expect(preview.tasks).toBe(2)
    expect(preview.openTasks).toBe(1)
    expect(preview.projects).toBe(1)
    expect(preview.notes).toBe(1)
    expect(preview.goals).toBe(0)
    expect(preview.reviews).toBe(1)
    expect(preview.savedFilters).toBe(1)
  })

  it('rejects garbage and missing tasks', () => {
    expect(previewImportJSON('{not json').ok).toBe(false)
    expect(previewImportJSON(JSON.stringify({ projects: [] })).ok).toBe(false)
  })
})
