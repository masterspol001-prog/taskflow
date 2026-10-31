import { describe, it, expect, beforeEach } from 'vitest'
import { matchPaletteCommands, loadRecentSearches, pushRecentSearch } from '@/lib/commands'

describe('matchPaletteCommands', () => {
  it('returns defaults when empty', () => {
    const hits = matchPaletteCommands('')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].id).toBe('capture')
  })

  it('matches slash-less jump words', () => {
    const hits = matchPaletteCommands('today')
    expect(hits.some((c) => c.id === 'today')).toBe(true)
  })

  it('matches focus from a partial', () => {
    const hits = matchPaletteCommands('foc')
    expect(hits.some((c) => c.id === 'focus')).toBe(true)
  })

  it('matches analytics', () => {
    const hits = matchPaletteCommands('analytics')
    expect(hits.some((c) => c.id === 'analytics')).toBe(true)
  })
})

describe('recent searches', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('stores unique newest-first queries', () => {
    pushRecentSearch('milk')
    pushRecentSearch('report')
    pushRecentSearch('milk')
    expect(loadRecentSearches()).toEqual(['milk', 'report'])
  })

  it('ignores tiny queries', () => {
    pushRecentSearch('a')
    expect(loadRecentSearches()).toEqual([])
  })
})
