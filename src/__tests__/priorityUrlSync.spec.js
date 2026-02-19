/**
 * Tests for priorityUrlSync utility - following TDD practices.
 */
import { describe, it, expect } from 'vitest'
import { parsePriorityUrlParams, buildPriorityUrlParams } from '../utils/priorityUrlSync'

describe('priorityUrlSync', () => {
  describe('parsePriorityUrlParams', () => {
    it('returns null when no filter params are present', () => {
      expect(parsePriorityUrlParams('')).toBeNull()
      expect(parsePriorityUrlParams('?view=priority')).toBeNull()
    })

    it('parses release param', () => {
      const result = parsePriorityUrlParams('?release=rhoai-3.4')

      expect(result.targetReleases).toEqual(['rhoai-3.4'])
    })

    it('parses multiple releases', () => {
      const result = parsePriorityUrlParams('?release=rhoai-3.4,rhoai-3.3')

      expect(result.targetReleases).toEqual(['rhoai-3.4', 'rhoai-3.3'])
    })

    it('parses teams param', () => {
      const result = parsePriorityUrlParams('?teams=Team%20A')

      expect(result.teams).toEqual(['Team A'])
    })

    it('parses multiple teams', () => {
      const result = parsePriorityUrlParams('?teams=Team%20A,Team%20B')

      expect(result.teams).toEqual(['Team A', 'Team B'])
    })

    it('parses components param', () => {
      const result = parsePriorityUrlParams('?components=UI,Backend')

      expect(result.components).toEqual(['UI', 'Backend'])
    })

    it('parses labels param', () => {
      const result = parsePriorityUrlParams('?labels=3.4-committed')

      expect(result.labels).toEqual(['3.4-committed'])
    })

    it('parses multiple labels', () => {
      const result = parsePriorityUrlParams('?labels=3.4-committed,important')

      expect(result.labels).toEqual(['3.4-committed', 'important'])
    })

    it('parses match mode', () => {
      const result = parsePriorityUrlParams('?teams=Team%20A&match=all')

      expect(result.matchMode).toBe('all')
    })

    it('defaults match mode to any when not specified', () => {
      const result = parsePriorityUrlParams('?teams=Team%20A')

      expect(result.matchMode).toBe('any')
    })

    it('parses all params together', () => {
      const result = parsePriorityUrlParams('?release=rhoai-3.4&teams=Team%20A&components=UI&labels=3.4-committed&match=all')

      expect(result).toEqual({
        targetReleases: ['rhoai-3.4'],
        teams: ['Team A'],
        components: ['UI'],
        labels: ['3.4-committed'],
        matchMode: 'all'
      })
    })

    it('preserves non-filter params (ignores them)', () => {
      const result = parsePriorityUrlParams('?view=priority&teams=Team%20A')

      expect(result.teams).toEqual(['Team A'])
      // Should not include 'view' in filter state
      expect(result).not.toHaveProperty('view')
    })

    it('defaults empty arrays for missing params', () => {
      const result = parsePriorityUrlParams('?teams=Team%20A')

      expect(result.components).toEqual([])
      expect(result.targetReleases).toEqual([])
      expect(result.labels).toEqual([])
    })
  })

  describe('buildPriorityUrlParams', () => {
    it('returns empty string for empty filter state', () => {
      const filter = { teams: [], components: [], targetReleases: [], labels: [], matchMode: 'any' }

      expect(buildPriorityUrlParams(filter)).toBe('')
    })

    it('builds release param', () => {
      const filter = { teams: [], components: [], targetReleases: ['rhoai-3.4'], labels: [], matchMode: 'any' }
      const parsed = new URLSearchParams(buildPriorityUrlParams(filter))

      expect(parsed.get('release')).toBe('rhoai-3.4')
    })

    it('builds multiple releases', () => {
      const filter = { teams: [], components: [], targetReleases: ['rhoai-3.4', 'rhoai-3.3'], labels: [], matchMode: 'any' }
      const result = buildPriorityUrlParams(filter)

      // Commas should be raw separators, not encoded
      expect(result).toContain('release=rhoai-3.4,rhoai-3.3')
    })

    it('builds teams param with encoding', () => {
      const filter = { teams: ['Team A'], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      const result = buildPriorityUrlParams(filter)
      const parsed = new URLSearchParams(result)

      expect(parsed.get('teams')).toBe('Team A')
    })

    it('builds multiple params', () => {
      const filter = { teams: ['Team A'], components: ['UI'], targetReleases: ['rhoai-3.4'], labels: ['3.4-committed'], matchMode: 'any' }
      const result = buildPriorityUrlParams(filter)
      const parsed = new URLSearchParams(result)

      expect(parsed.get('teams')).toBe('Team A')
      expect(parsed.get('components')).toBe('UI')
      expect(parsed.get('release')).toBe('rhoai-3.4')
      expect(parsed.get('labels')).toBe('3.4-committed')
      // 'any' matchMode is default and should be omitted
      expect(parsed.has('match')).toBe(false)
    })

    it('includes match=all when matchMode is all', () => {
      const filter = { teams: ['Team A'], components: [], targetReleases: [], labels: [], matchMode: 'all' }
      const result = buildPriorityUrlParams(filter)
      const parsed = new URLSearchParams(result)

      expect(parsed.get('match')).toBe('all')
    })

    it('omits match param when matchMode is any (default)', () => {
      const filter = { teams: ['Team A'], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      const result = buildPriorityUrlParams(filter)
      const parsed = new URLSearchParams(result)

      expect(parsed.has('match')).toBe(false)
    })

    it('preserves existing non-filter params', () => {
      const filter = { teams: ['Team A'], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      const result = buildPriorityUrlParams(filter, '?view=priority')
      const parsed = new URLSearchParams(result)

      expect(parsed.get('view')).toBe('priority')
      expect(parsed.get('teams')).toBe('Team A')
    })

    it('replaces existing filter params while preserving others', () => {
      const filter = { teams: ['Team B'], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      const result = buildPriorityUrlParams(filter, '?view=priority&teams=Team%20A')
      const parsed = new URLSearchParams(result)

      expect(parsed.get('view')).toBe('priority')
      expect(parsed.get('teams')).toBe('Team B')
    })

    it('removes filter params when their arrays are empty', () => {
      const filter = { teams: [], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      const result = buildPriorityUrlParams(filter, '?view=priority&teams=Team%20A&labels=foo')
      const parsed = new URLSearchParams(result)

      expect(parsed.get('view')).toBe('priority')
      expect(parsed.has('teams')).toBe(false)
      expect(parsed.has('labels')).toBe(false)
    })

    it('roundtrips through parse and build', () => {
      const original = { teams: ['Team A', 'Team B'], components: ['UI'], targetReleases: ['rhoai-3.4'], labels: ['3.4-committed'], matchMode: 'all' }
      const url = buildPriorityUrlParams(original)
      const parsed = parsePriorityUrlParams(url)

      expect(parsed).toEqual(original)
    })
  })
})
