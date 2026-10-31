export type ImportPreview =
  | {
      ok: true
      tasks: number
      openTasks: number
      projects: number
      notes: number
      goals: number
      reviews: number
      savedFilters: number
    }
  | { ok: false; error: string }

export function previewImportJSON(json: string): ImportPreview {
  try {
    const data = JSON.parse(json) as {
      tasks?: unknown
      projects?: unknown
      notes?: unknown
      goals?: unknown
      reviews?: unknown
      savedFilters?: unknown
    }
    if (!data || !Array.isArray(data.tasks)) {
      return { ok: false, error: 'Invalid file: expected TaskFlow export with a "tasks" array.' }
    }
    const openTasks = data.tasks.filter((t) => {
      if (!t || typeof t !== 'object') return true
      const row = t as { archived?: unknown; completed?: unknown }
      return !row.archived && !row.completed
    }).length
    return {
      ok: true,
      tasks: data.tasks.length,
      openTasks,
      projects: Array.isArray(data.projects) ? data.projects.length : 0,
      notes: Array.isArray(data.notes) ? data.notes.length : 0,
      goals: Array.isArray(data.goals) ? data.goals.length : 0,
      reviews: Array.isArray(data.reviews) ? data.reviews.length : 0,
      savedFilters: Array.isArray(data.savedFilters) ? data.savedFilters.length : 0,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not parse file.' }
  }
}
