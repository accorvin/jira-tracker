/**
 * Tests for priorityFilterLogic utility - following TDD practices.
 */
import { describe, it, expect } from 'vitest'
import { issueMatchesFilter, filterIssues } from '../utils/priorityFilterLogic'

describe('priorityFilterLogic', () => {
  const makeIssue = (overrides = {}) => ({
    key: 'A-1',
    team: 'Team A',
    components: ['UI'],
    targetRelease: ['rhoai-3.4'],
    labels: [],
    ...overrides
  })

  describe('issueMatchesFilter', () => {
    it('returns true when all filter criteria are empty', () => {
      const issue = makeIssue()
      const filter = { teams: [], components: [], targetReleases: [], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(true)
    })

    it('matches by team (ANY semantics)', () => {
      const issue = makeIssue({ team: 'Team A' })
      const filter = { teams: ['Team A', 'Team B'], components: [], targetReleases: [], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(true)
    })

    it('does not match when team is not in filter', () => {
      const issue = makeIssue({ team: 'Team C' })
      const filter = { teams: ['Team A', 'Team B'], components: [], targetReleases: [], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(false)
    })

    it('matches by component (ANY semantics)', () => {
      const issue = makeIssue({ components: ['UI', 'API'] })
      const filter = { teams: [], components: ['API'], targetReleases: [], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(true)
    })

    it('does not match when no component overlaps', () => {
      const issue = makeIssue({ components: ['UI'] })
      const filter = { teams: [], components: ['Backend'], targetReleases: [], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(false)
    })

    it('matches by targetRelease (ANY semantics)', () => {
      const issue = makeIssue({ targetRelease: ['rhoai-3.4'] })
      const filter = { teams: [], components: [], targetReleases: ['rhoai-3.4', 'rhoai-3.3'], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(true)
    })

    it('matches targetRelease when issue has multiple releases', () => {
      const issue = makeIssue({ targetRelease: ['rhoai-3.3', 'rhoai-3.4'] })
      const filter = { teams: [], components: [], targetReleases: ['rhoai-3.4'], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(true)
    })

    it('does not match targetRelease when none overlap', () => {
      const issue = makeIssue({ targetRelease: ['rhoai-3.2'] })
      const filter = { teams: [], components: [], targetReleases: ['rhoai-3.4'], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(false)
    })

    it('matches labels using ALL semantics (issue must have every selected label)', () => {
      const issue = makeIssue({ labels: ['3.4-committed', 'important'] })
      const filter = { teams: [], components: [], targetReleases: [], labels: ['3.4-committed'], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(true)
    })

    it('does not match labels when issue is missing a required label', () => {
      const issue = makeIssue({ labels: ['3.4-committed'] })
      const filter = { teams: [], components: [], targetReleases: [], labels: ['3.4-committed', 'important'], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(false)
    })

    it('does not match labels when issue has no labels', () => {
      const issue = makeIssue({ labels: [] })
      const filter = { teams: [], components: [], targetReleases: [], labels: ['3.4-committed'], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(false)
    })

    describe('matchMode: any (OR across dimensions)', () => {
      it('matches when any dimension matches', () => {
        const issue = makeIssue({ team: 'Team A', components: ['Backend'] })
        const filter = { teams: ['Team A'], components: ['UI'], targetReleases: [], labels: [], matchMode: 'any' }

        // team matches, component doesn't — OR → true
        expect(issueMatchesFilter(issue, filter)).toBe(true)
      })

      it('does not match when no dimension matches', () => {
        const issue = makeIssue({ team: 'Team C', components: ['Backend'] })
        const filter = { teams: ['Team A'], components: ['UI'], targetReleases: [], labels: [], matchMode: 'any' }

        expect(issueMatchesFilter(issue, filter)).toBe(false)
      })
    })

    describe('matchMode: all (AND across dimensions)', () => {
      it('matches when all specified dimensions match', () => {
        const issue = makeIssue({ team: 'Team A', components: ['UI'], targetRelease: ['rhoai-3.4'] })
        const filter = { teams: ['Team A'], components: ['UI'], targetReleases: ['rhoai-3.4'], labels: [], matchMode: 'all' }

        expect(issueMatchesFilter(issue, filter)).toBe(true)
      })

      it('does not match when one dimension fails', () => {
        const issue = makeIssue({ team: 'Team A', components: ['Backend'] })
        const filter = { teams: ['Team A'], components: ['UI'], targetReleases: [], labels: [], matchMode: 'all' }

        expect(issueMatchesFilter(issue, filter)).toBe(false)
      })

      it('ignores empty dimensions in AND mode', () => {
        const issue = makeIssue({ team: 'Team A', components: ['Backend'] })
        const filter = { teams: ['Team A'], components: [], targetReleases: [], labels: [], matchMode: 'all' }

        // Only team is specified and matches
        expect(issueMatchesFilter(issue, filter)).toBe(true)
      })
    })

    it('handles missing labels on issue gracefully', () => {
      const issue = { key: 'A-1', team: 'Team A', components: ['UI'], targetRelease: ['rhoai-3.4'] }
      const filter = { teams: ['Team A'], components: [], targetReleases: [], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(true)
    })

    it('handles missing components on issue gracefully', () => {
      const issue = { key: 'A-1', team: 'Team A', targetRelease: ['rhoai-3.4'], labels: [] }
      const filter = { teams: [], components: ['UI'], targetReleases: [], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(false)
    })

    it('handles null targetRelease on issue gracefully', () => {
      const issue = makeIssue({ targetRelease: null })
      const filter = { teams: [], components: [], targetReleases: ['rhoai-3.4'], labels: [], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(false)
    })

    it('defaults missing filter arrays to empty', () => {
      const issue = makeIssue({ team: 'Team A' })
      const filter = { teams: ['Team A'], matchMode: 'any' }

      expect(issueMatchesFilter(issue, filter)).toBe(true)
    })
  })

  describe('filterIssues', () => {
    const issues = [
      makeIssue({ key: 'A-1', team: 'Team A', components: ['UI'], targetRelease: ['rhoai-3.4'], labels: ['3.4-committed'] }),
      makeIssue({ key: 'A-2', team: 'Team B', components: ['Backend'], targetRelease: ['rhoai-3.3'], labels: [] }),
      makeIssue({ key: 'A-3', team: 'Team A', components: ['API'], targetRelease: ['rhoai-3.4'], labels: ['3.4-committed', 'important'] }),
      makeIssue({ key: 'A-4', team: 'Team C', components: ['UI', 'Backend'], targetRelease: ['rhoai-3.2'], labels: [] })
    ]

    it('returns all issues when filter is empty', () => {
      const filter = { teams: [], components: [], targetReleases: [], labels: [], matchMode: 'any' }

      expect(filterIssues(issues, filter)).toHaveLength(4)
    })

    it('filters by team', () => {
      const filter = { teams: ['Team A'], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      const result = filterIssues(issues, filter)

      expect(result).toHaveLength(2)
      expect(result.map(i => i.key)).toEqual(['A-1', 'A-3'])
    })

    it('filters by targetRelease', () => {
      const filter = { teams: [], components: [], targetReleases: ['rhoai-3.4'], labels: [], matchMode: 'any' }
      const result = filterIssues(issues, filter)

      expect(result).toHaveLength(2)
      expect(result.map(i => i.key)).toEqual(['A-1', 'A-3'])
    })

    it('filters by labels (ALL semantics)', () => {
      const filter = { teams: [], components: [], targetReleases: [], labels: ['3.4-committed'], matchMode: 'any' }
      const result = filterIssues(issues, filter)

      expect(result).toHaveLength(2)
      expect(result.map(i => i.key)).toEqual(['A-1', 'A-3'])
    })

    it('filters by multiple labels (must have all)', () => {
      const filter = { teams: [], components: [], targetReleases: [], labels: ['3.4-committed', 'important'], matchMode: 'any' }
      const result = filterIssues(issues, filter)

      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('A-3')
    })

    it('combines dimensions with OR in any mode', () => {
      const filter = { teams: ['Team A'], components: ['Backend'], targetReleases: [], labels: [], matchMode: 'any' }
      const result = filterIssues(issues, filter)

      // A-1 (Team A), A-2 (Backend), A-3 (Team A), A-4 (Backend)
      expect(result).toHaveLength(4)
    })

    it('combines dimensions with AND in all mode', () => {
      const filter = { teams: ['Team A'], components: ['UI'], targetReleases: [], labels: [], matchMode: 'all' }
      const result = filterIssues(issues, filter)

      // Only A-1 matches both Team A and UI
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('A-1')
    })

    it('returns empty array when no issues match', () => {
      const filter = { teams: ['Nonexistent'], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      const result = filterIssues(issues, filter)

      expect(result).toHaveLength(0)
    })
  })
})
