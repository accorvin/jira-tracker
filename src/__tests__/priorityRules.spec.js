/**
 * Tests for priorityRules.js utility - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { getRankTier, detectPriorityViolations, getLowPriorityInProgress } from '../utils/priorityRules.js'

describe('getRankTier', () => {
  it('returns "top" for ranks 1-25', () => {
    expect(getRankTier(1)).toBe('top')
    expect(getRankTier(25)).toBe('top')
    expect(getRankTier(13)).toBe('top')
  })

  it('returns "high" for ranks 26-100', () => {
    expect(getRankTier(26)).toBe('high')
    expect(getRankTier(100)).toBe('high')
    expect(getRankTier(50)).toBe('high')
  })

  it('returns "low" for ranks 101+', () => {
    expect(getRankTier(101)).toBe('low')
    expect(getRankTier(500)).toBe('low')
    expect(getRankTier(1000)).toBe('low')
  })
})

describe('detectPriorityViolations', () => {
  it('returns empty array when no violations exist', () => {
    const issues = [
      { key: 'A-1', rank: 1, status: 'In Progress', team: 'Team A' },
      { key: 'A-2', rank: 2, status: 'In Progress', team: 'Team A' }
    ]
    expect(detectPriorityViolations(issues)).toEqual([])
  })

  it('detects when a team works on a lower-ranked item while higher-ranked is idle', () => {
    const issues = [
      { key: 'A-1', rank: 5, status: 'New', team: 'Team A' },
      { key: 'A-2', rank: 50, status: 'In Progress', team: 'Team A' }
    ]
    const violations = detectPriorityViolations(issues)
    expect(violations.length).toBe(1)
    expect(violations[0].team).toBe('Team A')
    expect(violations[0].inProgressIssue.key).toBe('A-2')
    expect(violations[0].higherRankedIdleIssue.key).toBe('A-1')
    expect(violations[0].inProgressRank).toBe(50)
    expect(violations[0].idleRank).toBe(5)
    expect(violations[0].rankGap).toBe(45)
  })

  it('does not flag teams that are working on their highest-ranked items', () => {
    const issues = [
      { key: 'A-1', rank: 1, status: 'In Progress', team: 'Team A' },
      { key: 'A-2', rank: 10, status: 'New', team: 'Team A' }
    ]
    expect(detectPriorityViolations(issues)).toEqual([])
  })

  it('excludes done issues from violation detection', () => {
    const issues = [
      { key: 'A-1', rank: 1, status: 'Resolved', team: 'Team A' },
      { key: 'A-2', rank: 50, status: 'In Progress', team: 'Team A' }
    ]
    // Resolved issue should be excluded - no violation
    expect(detectPriorityViolations(issues)).toEqual([])
  })

  it('excludes Closed issues from violation detection', () => {
    const issues = [
      { key: 'A-1', rank: 1, status: 'Closed', team: 'Team A' },
      { key: 'A-2', rank: 50, status: 'In Progress', team: 'Team A' }
    ]
    expect(detectPriorityViolations(issues)).toEqual([])
  })

  it('treats Review and Testing as in-progress statuses', () => {
    const issues = [
      { key: 'A-1', rank: 5, status: 'New', team: 'Team A' },
      { key: 'A-2', rank: 50, status: 'Review', team: 'Team A' }
    ]
    const violations = detectPriorityViolations(issues)
    expect(violations.length).toBe(1)
    expect(violations[0].inProgressIssue.key).toBe('A-2')
  })

  it('handles multiple teams independently', () => {
    const issues = [
      { key: 'A-1', rank: 5, status: 'New', team: 'Team A' },
      { key: 'A-2', rank: 50, status: 'In Progress', team: 'Team A' },
      { key: 'B-1', rank: 10, status: 'In Progress', team: 'Team B' },
      { key: 'B-2', rank: 20, status: 'New', team: 'Team B' }
    ]
    const violations = detectPriorityViolations(issues)
    // Only Team A has a violation
    expect(violations.length).toBe(1)
    expect(violations[0].team).toBe('Team A')
  })

  it('sorts violations by rank gap descending', () => {
    const issues = [
      { key: 'A-1', rank: 5, status: 'New', team: 'Team A' },
      { key: 'A-2', rank: 50, status: 'In Progress', team: 'Team A' },
      { key: 'B-1', rank: 1, status: 'Backlog', team: 'Team B' },
      { key: 'B-2', rank: 200, status: 'In Progress', team: 'Team B' }
    ]
    const violations = detectPriorityViolations(issues)
    expect(violations.length).toBe(2)
    expect(violations[0].team).toBe('Team B') // gap 199
    expect(violations[1].team).toBe('Team A') // gap 45
  })

  it('skips issues without a team', () => {
    const issues = [
      { key: 'A-1', rank: 5, status: 'New', team: null },
      { key: 'A-2', rank: 50, status: 'In Progress', team: null }
    ]
    expect(detectPriorityViolations(issues)).toEqual([])
  })

  it('considers Backlog and Refinement as idle statuses', () => {
    const issues = [
      { key: 'A-1', rank: 5, status: 'Backlog', team: 'Team A' },
      { key: 'A-2', rank: 50, status: 'In Progress', team: 'Team A' }
    ]
    const violations = detectPriorityViolations(issues)
    expect(violations.length).toBe(1)
  })
})

describe('getLowPriorityInProgress', () => {
  it('returns features ranked >100 that are in progress', () => {
    const issues = [
      { key: 'A-1', rank: 50, status: 'In Progress' },
      { key: 'A-2', rank: 101, status: 'In Progress' },
      { key: 'A-3', rank: 200, status: 'In Progress' }
    ]
    const result = getLowPriorityInProgress(issues)
    expect(result.length).toBe(2)
    expect(result[0].key).toBe('A-2')
    expect(result[1].key).toBe('A-3')
  })

  it('does not include items ranked <=100', () => {
    const issues = [
      { key: 'A-1', rank: 100, status: 'In Progress' },
      { key: 'A-2', rank: 99, status: 'In Progress' }
    ]
    expect(getLowPriorityInProgress(issues)).toEqual([])
  })

  it('does not include idle or done items even if ranked >100', () => {
    const issues = [
      { key: 'A-1', rank: 200, status: 'New' },
      { key: 'A-2', rank: 300, status: 'Resolved' },
      { key: 'A-3', rank: 400, status: 'Closed' }
    ]
    expect(getLowPriorityInProgress(issues)).toEqual([])
  })

  it('includes Review and Testing statuses', () => {
    const issues = [
      { key: 'A-1', rank: 150, status: 'Review' },
      { key: 'A-2', rank: 200, status: 'Testing' }
    ]
    const result = getLowPriorityInProgress(issues)
    expect(result.length).toBe(2)
  })

  it('returns empty array for empty input', () => {
    expect(getLowPriorityInProgress([])).toEqual([])
  })
})
