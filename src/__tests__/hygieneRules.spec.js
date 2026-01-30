/**
 * Tests for hygieneRules.js - following TDD practices.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { evaluateHygiene } from '../utils/hygieneRules.js'

describe('Hygiene Rules Engine', () => {
  beforeEach(() => {
    // Mock current date to 2025-12-11 12:00:00 UTC
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-12-11T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Rule 1: Stale Refinement', () => {
    it('should trigger for issue in Refinement > 21 days', () => {
      const issue = {
        status: 'Refinement',
        statusEnteredAt: '2025-11-10T12:00:00Z' // 31 days ago
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-refinement')).toBe(true)
      const violation = violations.find(v => v.id === 'stale-refinement')
      expect(violation.message).toContain('31 days')
    })

    it('should not trigger for issue in Refinement <= 21 days', () => {
      const issue = {
        status: 'Refinement',
        statusEnteredAt: '2025-11-25T12:00:00Z' // 16 days ago
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-refinement')).toBe(false)
    })

    it('should not trigger for issue not in Refinement', () => {
      const issue = {
        status: 'In Progress',
        statusEnteredAt: '2025-10-01T12:00:00Z' // 71 days ago
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-refinement')).toBe(false)
    })

    it('should trigger for issue exactly on boundary (22 days)', () => {
      const issue = {
        status: 'Refinement',
        statusEnteredAt: '2025-11-19T12:00:00Z' // Exactly 22 days ago
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-refinement')).toBe(true)
    })
  })

  describe('Rule 2: Missing Assignee', () => {
    it('should trigger for issue in Refinement without assignee', () => {
      const issue = {
        status: 'Refinement',
        assignee: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-assignee')).toBe(true)
    })

    it('should trigger for issue in In Progress without assignee', () => {
      const issue = {
        status: 'In Progress',
        assignee: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-assignee')).toBe(true)
    })

    it('should trigger for issue in Review without assignee', () => {
      const issue = {
        status: 'Review',
        assignee: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-assignee')).toBe(true)
    })

    it('should trigger for issue in Testing without assignee', () => {
      const issue = {
        status: 'Testing',
        assignee: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-assignee')).toBe(true)
    })

    it('should not trigger for issue with assignee', () => {
      const issue = {
        status: 'Refinement',
        assignee: 'John Doe'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-assignee')).toBe(false)
    })

    it('should not trigger for issue in other statuses without assignee', () => {
      const issue = {
        status: 'New',
        assignee: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-assignee')).toBe(false)
    })
  })

  describe('Rule 3: Missing Team', () => {
    it('should trigger for issue in Refinement without team', () => {
      const issue = {
        status: 'Refinement',
        team: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-team')).toBe(true)
    })

    it('should trigger for issue in In Progress without team', () => {
      const issue = {
        status: 'In Progress',
        team: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-team')).toBe(true)
    })

    it('should not trigger for issue with team', () => {
      const issue = {
        status: 'Refinement',
        team: 'Fine Tuning'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-team')).toBe(false)
    })
  })

  describe('Rule 4: Stale/Missing Status Summary', () => {
    it('should trigger when status summary exists but not updated in 7+ days', () => {
      const issue = {
        status: 'In Progress',
        statusSummary: 'Some summary',
        statusSummaryUpdated: '2025-12-01T12:00:00Z', // 10 days ago
        statusEnteredAt: '2025-11-01T12:00:00Z'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-status-summary')).toBe(true)
      const violation = violations.find(v => v.id === 'stale-status-summary')
      expect(violation.message).toContain('10 days')
    })

    it('should not trigger when status summary updated within 7 days', () => {
      const issue = {
        status: 'In Progress',
        statusSummary: 'Some summary',
        statusSummaryUpdated: '2025-12-09T12:00:00Z', // 2 days ago
        statusEnteredAt: '2025-11-01T12:00:00Z'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-status-summary')).toBe(false)
    })

    it('should trigger when no status summary and in status > 7 days', () => {
      const issue = {
        status: 'Refinement',
        statusSummary: null,
        statusSummaryUpdated: null,
        statusEnteredAt: '2025-11-20T12:00:00Z' // 21 days ago
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-status-summary')).toBe(true)
      const violation = violations.find(v => v.id === 'stale-status-summary')
      expect(violation.message).toContain('21 days')
    })

    it('should not trigger when no status summary but in status < 7 days', () => {
      const issue = {
        status: 'Refinement',
        statusSummary: null,
        statusSummaryUpdated: null,
        statusEnteredAt: '2025-12-08T12:00:00Z' // 3 days ago
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-status-summary')).toBe(false)
    })

    it('should not trigger for issues not in Refinement or In Progress', () => {
      const issue = {
        status: 'Resolved',
        statusSummary: null,
        statusSummaryUpdated: null,
        statusEnteredAt: '2025-10-01T12:00:00Z'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'stale-status-summary')).toBe(false)
    })
  })

  describe('Rule 5: Missing Color Status', () => {
    it('should trigger for issue in In Progress without color status', () => {
      const issue = {
        status: 'In Progress',
        colorStatus: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-color-status')).toBe(true)
    })

    it('should trigger for issue in Review without color status', () => {
      const issue = {
        status: 'Review',
        colorStatus: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-color-status')).toBe(true)
    })

    it('should not trigger for issue with color status', () => {
      const issue = {
        status: 'In Progress',
        colorStatus: 'Green'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-color-status')).toBe(false)
    })

    it('should not trigger for issue in Refinement without color status', () => {
      const issue = {
        status: 'Refinement',
        colorStatus: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-color-status')).toBe(false)
    })
  })

  describe('Rule 6: Missing Release Type', () => {
    it('should trigger for Feature in In Progress without release type', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        releaseType: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-release-type')).toBe(true)
    })

    it('should not trigger for Feature with release type', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        releaseType: 'GA'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-release-type')).toBe(false)
    })

    it('should not trigger for Initiative without release type', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Initiative',
        releaseType: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-release-type')).toBe(false)
    })

    it('should not trigger for Feature in Refinement without release type', () => {
      const issue = {
        status: 'Refinement',
        issueType: 'Feature',
        releaseType: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-release-type')).toBe(false)
    })
  })

  describe('Rule: Missing Docs Required', () => {
    it('should trigger for Feature in In Progress without docsRequired', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        docsRequired: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-docs-required')).toBe(true)
    })

    it('should trigger for Feature in In Progress with docsRequired set to "None"', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        docsRequired: 'None'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-docs-required')).toBe(true)
    })

    it('should trigger for Feature in Review without docsRequired', () => {
      const issue = {
        status: 'Review',
        issueType: 'Feature',
        docsRequired: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-docs-required')).toBe(true)
    })

    it('should not trigger for Feature with docsRequired set to "Yes"', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        docsRequired: 'Yes'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-docs-required')).toBe(false)
    })

    it('should not trigger for Feature with docsRequired set to "No"', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        docsRequired: 'No'
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-docs-required')).toBe(false)
    })

    it('should not trigger for Feature in Refinement without docsRequired', () => {
      const issue = {
        status: 'Refinement',
        issueType: 'Feature',
        docsRequired: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-docs-required')).toBe(false)
    })

    it('should not trigger for Feature in New status without docsRequired', () => {
      const issue = {
        status: 'New',
        issueType: 'Feature',
        docsRequired: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-docs-required')).toBe(false)
    })

    it('should not trigger for Initiative in In Progress without docsRequired', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Initiative',
        docsRequired: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.some(v => v.id === 'missing-docs-required')).toBe(false)
    })
  })

  describe('evaluateHygiene', () => {
    it('should return empty array for issue with no violations', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        assignee: 'John Doe',
        team: 'Fine Tuning',
        statusSummary: 'Summary',
        statusSummaryUpdated: '2025-12-10T12:00:00Z', // 1 day ago
        statusEnteredAt: '2025-12-05T12:00:00Z',
        colorStatus: 'Green',
        releaseType: 'GA',
        linkedRfeApproved: true,
        docsRequired: 'Yes'
      }

      const violations = evaluateHygiene(issue)
      expect(violations).toHaveLength(0)
    })

    it('should return single violation for issue with one problem', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        assignee: null, // Missing assignee
        team: 'Fine Tuning',
        statusSummary: 'Summary',
        statusSummaryUpdated: '2025-12-10T12:00:00Z',
        statusEnteredAt: '2025-12-05T12:00:00Z',
        colorStatus: 'Green',
        releaseType: 'GA',
        linkedRfeApproved: true,
        docsRequired: 'Yes'
      }

      const violations = evaluateHygiene(issue)
      expect(violations).toHaveLength(1)
      expect(violations[0].id).toBe('missing-assignee')
      expect(violations[0].message).toContain('no assignee')
    })

    it('should return multiple violations for issue with multiple problems', () => {
      const issue = {
        status: 'In Progress',
        issueType: 'Feature',
        assignee: null, // Missing assignee
        team: null, // Missing team
        statusSummary: null, // Missing status summary
        statusSummaryUpdated: null,
        statusEnteredAt: '2025-11-01T12:00:00Z', // In status > 7 days
        colorStatus: null, // Missing color status
        releaseType: null // Missing release type
      }

      const violations = evaluateHygiene(issue)
      expect(violations.length).toBeGreaterThanOrEqual(5)
      expect(violations.some(v => v.id === 'missing-assignee')).toBe(true)
      expect(violations.some(v => v.id === 'missing-team')).toBe(true)
      expect(violations.some(v => v.id === 'stale-status-summary')).toBe(true)
      expect(violations.some(v => v.id === 'missing-color-status')).toBe(true)
      expect(violations.some(v => v.id === 'missing-release-type')).toBe(true)
    })

    it('should include detailed messages in violations', () => {
      const issue = {
        status: 'Refinement',
        issueType: 'Initiative',
        assignee: null,
        team: 'Fine Tuning',
        statusSummary: null,
        statusSummaryUpdated: null,
        statusEnteredAt: '2025-10-15T12:00:00Z', // 57 days ago
        colorStatus: null,
        releaseType: null
      }

      const violations = evaluateHygiene(issue)
      expect(violations.length).toBeGreaterThan(0)

      // Check that messages are detailed and actionable
      const staleRefinement = violations.find(v => v.id === 'stale-refinement')
      if (staleRefinement) {
        expect(staleRefinement.message).toContain('57 days')
        expect(staleRefinement.message).toContain('21 days')
      }

      const missingAssignee = violations.find(v => v.id === 'missing-assignee')
      if (missingAssignee) {
        expect(missingAssignee.message).toContain('Refinement')
        expect(missingAssignee.message).toContain('no assignee')
      }
    })
  })
})
