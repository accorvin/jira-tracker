/**
 * Tests for enforcement dedup/cooldown logic — TDD style.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// The shared module exports CommonJS; our ESM wrapper re-exports it
import { processViolations } from '../../amplify/backend/function/jiraFetcher/src/shared/enforcementLogic.cjs'

describe('Enforcement Logic', () => {
  const NOW = '2026-02-23T08:00:00.000Z'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('processViolations', () => {
    it('should create proposals for new violations not in ledger', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Missing RICE score comment'
        }
      ]
      const ledger = {}
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.proposals).toHaveLength(1)
      expect(result.proposals[0].issueKey).toBe('RHAISTRAT-100')
      expect(result.proposals[0].ruleId).toBe('missing-rice-score')
      expect(result.proposals[0].status).toBe('pending')
      expect(result.proposals[0].id).toMatch(/^prop-/)
    })

    it('should skip violations for disabled rules', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {}
      const enabledRuleIds = [] // No rules enabled

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.proposals).toHaveLength(0)
    })

    it('should skip violations in cooldown (< 7 days since last action)', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-20T08:00:00Z',
          lastActionAt: '2026-02-20T08:00:00Z', // 3 days ago
          actionTaken: 'transition',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.proposals).toHaveLength(0)
    })

    it('should re-remind after cooldown expires (>= 7 days since last action)', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-15T08:00:00Z', // 8 days ago
          actionTaken: 'transition',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.proposals).toHaveLength(1)
      expect(result.proposals[0].issueKey).toBe('RHAISTRAT-100')
    })

    it('should act on regression (resolved entry with new violation)', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-10T08:00:00Z',
          actionTaken: 'transition',
          resolved: true,
          resolvedAt: '2026-02-12T08:00:00Z'
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.proposals).toHaveLength(1)
    })

    it('should update ledger for new violations', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {}
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      const key = 'RHAISTRAT-100:missing-rice-score'
      expect(result.updatedLedger[key]).toBeDefined()
      expect(result.updatedLedger[key].firstDetectedAt).toBe(NOW)
      expect(result.updatedLedger[key].lastActionAt).toBe(NOW)
      expect(result.updatedLedger[key].resolved).toBe(false)
    })

    it('should mark resolved entries for violations no longer detected', () => {
      const violations = [] // No violations found
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-10T08:00:00Z',
          actionTaken: 'transition',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      const key = 'RHAISTRAT-100:missing-rice-score'
      expect(result.updatedLedger[key].resolved).toBe(true)
      expect(result.updatedLedger[key].resolvedAt).toBe(NOW)
    })

    it('should handle multiple violations for different rules on same issue', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: null,
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment 1'
        },
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: null,
          issueStatus: 'In Progress',
          ruleId: 'missing-assignee',
          ruleName: 'Missing Assignee',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment 2'
        }
      ]
      const ledger = {}
      const enabledRuleIds = ['missing-rice-score', 'missing-assignee']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.proposals).toHaveLength(2)
      expect(result.updatedLedger['RHAISTRAT-100:missing-rice-score']).toBeDefined()
      expect(result.updatedLedger['RHAISTRAT-100:missing-assignee']).toBeDefined()
    })

    it('should update lastActionAt on re-remind but preserve firstDetectedAt', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const originalFirstDetected = '2026-02-10T08:00:00Z'
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: originalFirstDetected,
          lastActionAt: '2026-02-14T08:00:00Z', // 9 days ago
          actionTaken: 'transition',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      const key = 'RHAISTRAT-100:missing-rice-score'
      expect(result.updatedLedger[key].firstDetectedAt).toBe(originalFirstDetected)
      expect(result.updatedLedger[key].lastActionAt).toBe(NOW)
    })

    it('should reset regression entry fields correctly', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-05T08:00:00Z',
          lastActionAt: '2026-02-05T08:00:00Z',
          actionTaken: 'transition',
          resolved: true,
          resolvedAt: '2026-02-08T08:00:00Z'
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      const key = 'RHAISTRAT-100:missing-rice-score'
      expect(result.updatedLedger[key].resolved).toBe(false)
      expect(result.updatedLedger[key].resolvedAt).toBeNull()
      expect(result.updatedLedger[key].firstDetectedAt).toBe(NOW)
      expect(result.updatedLedger[key].lastActionAt).toBe(NOW)
    })

    it('should generate unique proposal IDs', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Feature A',
          issueAssignee: 'John',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment 1'
        },
        {
          issueKey: 'RHAISTRAT-200',
          issueSummary: 'Feature B',
          issueAssignee: 'Jane',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment 2'
        }
      ]
      const ledger = {}
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.proposals[0].id).not.toBe(result.proposals[1].id)
    })

    it('should not resolve ledger entries for disabled rules', () => {
      const violations = [] // No violations
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-10T08:00:00Z',
          actionTaken: 'transition',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = [] // Rule is disabled

      const result = processViolations(violations, ledger, enabledRuleIds)

      // Should not touch entries for disabled rules
      const key = 'RHAISTRAT-100:missing-rice-score'
      expect(result.updatedLedger[key].resolved).toBe(false)
    })

    it('should return resolvedKeys for violations no longer detected', () => {
      const violations = [] // No violations found
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-10T08:00:00Z',
          actionTaken: 'transition',
          resolved: false,
          resolvedAt: null
        },
        'RHAISTRAT-200:missing-assignee': {
          issueKey: 'RHAISTRAT-200',
          ruleId: 'missing-assignee',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-10T08:00:00Z',
          actionTaken: 'comment-only',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score', 'missing-assignee']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.resolvedKeys).toContain('RHAISTRAT-100:missing-rice-score')
      expect(result.resolvedKeys).toContain('RHAISTRAT-200:missing-assignee')
      expect(result.resolvedKeys).toHaveLength(2)
    })

    it('should not include already-resolved entries in resolvedKeys', () => {
      const violations = []
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-10T08:00:00Z',
          actionTaken: 'transition',
          resolved: true,
          resolvedAt: '2026-02-15T08:00:00Z'
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.resolvedKeys).toHaveLength(0)
    })

    it('should skip creating proposal when pending proposal already exists for same issue+rule', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {}
      const enabledRuleIds = ['missing-rice-score']
      const pendingProposals = [
        {
          id: 'prop-existing',
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          status: 'pending'
        }
      ]

      const result = processViolations(violations, ledger, enabledRuleIds, pendingProposals)

      expect(result.proposals).toHaveLength(0)
    })

    it('should skip creating proposal when failed proposal already exists for same issue+rule', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {}
      const enabledRuleIds = ['missing-rice-score']
      const pendingProposals = [
        {
          id: 'prop-failed',
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          status: 'failed',
          error: 'Jira API error'
        }
      ]

      const result = processViolations(violations, ledger, enabledRuleIds, pendingProposals)

      expect(result.proposals).toHaveLength(0)
    })

    it('should NOT skip creating proposal when only applied/dismissed proposals exist for same issue+rule', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {}
      const enabledRuleIds = ['missing-rice-score']
      const pendingProposals = [
        {
          id: 'prop-applied',
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          status: 'applied'
        },
        {
          id: 'prop-dismissed',
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          status: 'dismissed'
        }
      ]

      const result = processViolations(violations, ledger, enabledRuleIds, pendingProposals)

      expect(result.proposals).toHaveLength(1)
    })

    it('should skip re-remind when pending proposal exists even after cooldown expires', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-01T08:00:00Z',
          lastActionAt: '2026-02-10T08:00:00Z', // 13 days ago — well past cooldown
          actionTaken: 'transition',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score']
      const pendingProposals = [
        {
          id: 'prop-existing',
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          status: 'pending'
        }
      ]

      const result = processViolations(violations, ledger, enabledRuleIds, pendingProposals)

      expect(result.proposals).toHaveLength(0)
    })

    it('should still create proposals for different issue+rule combos when one has a pending proposal', () => {
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: null,
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment 1'
        },
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: null,
          issueStatus: 'In Progress',
          ruleId: 'missing-assignee',
          ruleName: 'Missing Assignee',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment 2'
        }
      ]
      const ledger = {}
      const enabledRuleIds = ['missing-rice-score', 'missing-assignee']
      const pendingProposals = [
        {
          id: 'prop-existing',
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          status: 'pending'
        }
      ]

      const result = processViolations(violations, ledger, enabledRuleIds, pendingProposals)

      // Only missing-assignee should get a new proposal
      expect(result.proposals).toHaveLength(1)
      expect(result.proposals[0].ruleId).toBe('missing-assignee')
    })

    it('should NOT resolve ledger entries within cooldown (data noise protection)', () => {
      // If a violation temporarily disappears but lastActionAt is within cooldown,
      // don't mark it resolved — treat as data noise, not genuine resolution.
      // Real-world case: issue's target release was briefly cleared, removing it
      // from the dataset, then set again — shouldn't cause duplicate notifications.
      const violations = [] // Violation temporarily not detected
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-20T08:00:00Z',
          lastActionAt: '2026-02-20T08:00:00Z', // 3 days ago — within cooldown
          actionTaken: 'comment-only',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      const key = 'RHAISTRAT-100:missing-rice-score'
      expect(result.updatedLedger[key].resolved).toBe(false)
      expect(result.updatedLedger[key].resolvedAt).toBeNull()
      expect(result.resolvedKeys).not.toContain(key)
    })

    it('should still resolve ledger entries past cooldown when violation disappears', () => {
      // After cooldown expires, if the violation is genuinely gone, resolve it
      const violations = []
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-10T08:00:00Z', // 13 days ago — past cooldown
          actionTaken: 'comment-only',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      const key = 'RHAISTRAT-100:missing-rice-score'
      expect(result.updatedLedger[key].resolved).toBe(true)
      expect(result.updatedLedger[key].resolvedAt).toBe(NOW)
      expect(result.resolvedKeys).toContain(key)
    })

    it('should NOT treat regression within cooldown as actionable', () => {
      // If an entry was marked resolved but lastActionAt is within cooldown,
      // don't generate a new proposal — just un-resolve the entry
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John Doe',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'comment-only',
          targetStatus: null,
          comment: 'Comment'
        }
      ]
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-20T08:00:00Z',
          lastActionAt: '2026-02-20T08:00:00Z', // 3 days ago — within cooldown
          actionTaken: 'comment-only',
          resolved: true,
          resolvedAt: '2026-02-21T08:00:00Z'
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      // Should NOT generate a proposal — cooldown still active
      expect(result.proposals).toHaveLength(0)
      // But should un-resolve the entry
      const key = 'RHAISTRAT-100:missing-rice-score'
      expect(result.updatedLedger[key].resolved).toBe(false)
    })

    it('should handle exactly 7-day boundary (skip, not re-remind)', () => {
      // lastActionAt is exactly 7 days ago — borderline
      // "lastActionAt < 7 days ago → SKIP" means we skip at exactly 7 days
      // ">= 7 days ago → ACT" means exactly 7 is on the boundary
      // The plan says "lastActionAt >= 7 days ago → ACT (re-remind)"
      // So at exactly 7 days, we should act
      const violations = [
        {
          issueKey: 'RHAISTRAT-100',
          issueSummary: 'Test Feature',
          issueAssignee: 'John',
          issueStatus: 'In Progress',
          ruleId: 'missing-rice-score',
          ruleName: 'Missing RICE Score',
          actionType: 'transition',
          targetStatus: 'Refinement',
          comment: 'Comment'
        }
      ]
      const ledger = {
        'RHAISTRAT-100:missing-rice-score': {
          issueKey: 'RHAISTRAT-100',
          ruleId: 'missing-rice-score',
          firstDetectedAt: '2026-02-10T08:00:00Z',
          lastActionAt: '2026-02-16T08:00:00Z', // Exactly 7 days ago
          actionTaken: 'transition',
          resolved: false,
          resolvedAt: null
        }
      }
      const enabledRuleIds = ['missing-rice-score']

      const result = processViolations(violations, ledger, enabledRuleIds)

      expect(result.proposals).toHaveLength(1)
    })
  })
})
