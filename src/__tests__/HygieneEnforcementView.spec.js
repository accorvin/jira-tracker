/**
 * Tests for HygieneEnforcementView.vue — proposal status visibility and auto-enforcement.
 * TDD: tests written BEFORE implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import HygieneEnforcementView from '../components/HygieneEnforcementView.vue'

// Mock useAdmin
vi.mock('../composables/useAdmin', () => ({
  useAdmin: () => ({
    isAdmin: ref(true)
  })
}))

// Mock API calls
const mockGetHygieneConfig = vi.fn().mockResolvedValue({ rules: {} })
const mockSaveHygieneConfig = vi.fn().mockResolvedValue({})
const mockGetHygienePending = vi.fn().mockResolvedValue({ proposals: [], lastRunAt: null })
const mockGetHygieneHistory = vi.fn().mockResolvedValue({ runs: [] })
const mockApproveProposals = vi.fn().mockResolvedValue({ results: [] })
const mockDismissProposals = vi.fn().mockResolvedValue({ success: true })
const mockRunHygieneEnforcement = vi.fn().mockResolvedValue({ proposalCount: 0 })

vi.mock('../services/api', () => ({
  getHygieneConfig: (...args) => mockGetHygieneConfig(...args),
  saveHygieneConfig: (...args) => mockSaveHygieneConfig(...args),
  getHygienePending: (...args) => mockGetHygienePending(...args),
  getHygieneHistory: (...args) => mockGetHygieneHistory(...args),
  approveProposals: (...args) => mockApproveProposals(...args),
  dismissProposals: (...args) => mockDismissProposals(...args),
  runHygieneEnforcement: (...args) => mockRunHygieneEnforcement(...args)
}))

// Mock hygieneRules
vi.mock('../utils/hygieneRules', () => ({
  getEnforceableRules: () => [
    {
      id: 'missing-rice-score',
      name: 'Missing RICE Score',
      description: 'Features in progress must have a RICE score',
      enforcement: { type: 'comment', commentTemplate: 'Please add RICE score' }
    }
  ]
}))

function createProposal(overrides = {}) {
  return {
    id: `prop-${Math.random().toString(36).slice(2)}`,
    issueKey: 'RHAISTRAT-100',
    issueSummary: 'Test Feature',
    issueAssignee: 'John Doe',
    issueStatus: 'In Progress',
    ruleId: 'missing-rice-score',
    ruleName: 'Missing RICE Score',
    actionType: 'comment',
    targetStatus: null,
    comment: 'Please add RICE score',
    detectedAt: '2026-03-01T08:00:00Z',
    status: 'pending',
    ...overrides
  }
}

describe('HygieneEnforcementView — Proposal Status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHygieneConfig.mockResolvedValue({ rules: {} })
    mockGetHygienePending.mockResolvedValue({ proposals: [], lastRunAt: null })
    mockGetHygieneHistory.mockResolvedValue({ runs: [] })
  })

  describe('Proposals tab shows only actionable proposals', () => {
    it('shows pending and failed proposals only', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'pending', issueKey: 'RHAISTRAT-101' }),
        createProposal({ id: 'p2', status: 'applied', issueKey: 'RHAISTRAT-102', appliedAt: '2026-03-02T10:00:00Z' }),
        createProposal({ id: 'p3', status: 'failed', issueKey: 'RHAISTRAT-103', error: 'Jira API error' }),
        createProposal({ id: 'p4', status: 'dismissed', issueKey: 'RHAISTRAT-104', dismissedAt: '2026-03-02T11:00:00Z' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('RHAISTRAT-101')
      })

      // Pending and failed should be visible
      expect(wrapper.text()).toContain('RHAISTRAT-103')
      // Applied and dismissed should NOT be on proposals tab
      expect(wrapper.text()).not.toContain('RHAISTRAT-102')
      expect(wrapper.text()).not.toContain('RHAISTRAT-104')
    })

    it('does not render a status filter dropdown', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'pending' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('RHAISTRAT-100')
      })

      expect(wrapper.find('[data-testid="status-filter"]').exists()).toBe(false)
    })

    it('shows checkboxes for all displayed proposals (pending and failed)', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'pending', issueKey: 'RHAISTRAT-101' }),
        createProposal({ id: 'p3', status: 'failed', issueKey: 'RHAISTRAT-103' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('RHAISTRAT-101')
      })

      const checkboxes = wrapper.findAll('[data-testid="proposal-checkbox"]')
      expect(checkboxes).toHaveLength(2)
    })
  })

  describe('Retry failed proposals', () => {
    it('shows retry button for failed proposals', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'failed', error: 'Jira API error' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="retry-button-p1"]').exists()).toBe(true)
      })
    })

    it('does not show retry button for non-failed proposals', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'pending' }),
        createProposal({ id: 'p2', status: 'applied' }),
        createProposal({ id: 'p3', status: 'dismissed' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('RHAISTRAT-100')
      })

      expect(wrapper.find('[data-testid^="retry-button-"]').exists()).toBe(false)
    })

    it('calls approveProposals when retry is clicked', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'failed', error: 'Jira API error' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })
      mockApproveProposals.mockResolvedValue({ results: [{ id: 'p1', status: 'applied' }] })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="retry-button-p1"]').exists()).toBe(true)
      })

      await wrapper.find('[data-testid="retry-button-p1"]').trigger('click')

      expect(mockApproveProposals).toHaveBeenCalledWith(['p1'])
    })
  })

  describe('Failed proposal error display', () => {
    it('shows error message for failed proposals', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'failed', error: 'Jira API timeout' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('Jira API timeout')
      })
    })
  })

  describe('Tab badge counts', () => {
    it('shows pending count badge on Proposals tab', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'pending' }),
        createProposal({ id: 'p2', status: 'pending' }),
        createProposal({ id: 'p3', status: 'applied' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="pending-count-badge"]').exists()).toBe(true)
      })

      // Should show 2 (only pending, not applied)
      expect(wrapper.find('[data-testid="pending-count-badge"]').text()).toBe('2')
    })

    it('shows failed count badge when there are failures', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'failed' }),
        createProposal({ id: 'p2', status: 'applied' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="failed-count-badge"]').exists()).toBe(true)
      })

      expect(wrapper.find('[data-testid="failed-count-badge"]').text()).toBe('1')
    })
  })

  describe('History tab shows proposal outcomes', () => {
    it('shows status for proposals in history run details', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'applied', issueKey: 'RHAISTRAT-101', appliedAt: '2026-03-01T10:00:00Z' }),
        createProposal({ id: 'p2', status: 'dismissed', issueKey: 'RHAISTRAT-102', dismissedAt: '2026-03-01T11:00:00Z' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const historyRuns = [
        {
          runAt: '2026-03-01T08:00:00Z',
          totalIssuesEvaluated: 10,
          totalViolationsFound: 2,
          newProposalsGenerated: 2,
          enabledRules: ['missing-rice-score'],
          proposals: [
            { id: 'p1', issueKey: 'RHAISTRAT-101', ruleName: 'Missing RICE Score', actionType: 'comment' },
            { id: 'p2', issueKey: 'RHAISTRAT-102', ruleName: 'Missing RICE Score', actionType: 'comment' }
          ]
        }
      ]
      mockGetHygieneHistory.mockResolvedValue({ runs: historyRuns })

      const wrapper = mount(HygieneEnforcementView)
      // Wait for pending data to load, then switch to history tab
      await vi.waitFor(() => {
        expect(wrapper.findAll('nav button').find(b => b.text().includes('History'))).toBeTruthy()
      })

      const historyTab = wrapper.findAll('nav button').find(b => b.text().includes('History'))
      await historyTab.trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('10 issues evaluated')
      })

      // Expand the run
      const expandButton = wrapper.find('[data-testid="history-run-toggle-0"]')
      await expandButton.trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('RHAISTRAT-101')
      })

      // Should show status badges in history
      const historyStatusBadges = wrapper.findAll('[data-testid="history-proposal-status"]')
      expect(historyStatusBadges.length).toBeGreaterThanOrEqual(2)

      const statusTexts = historyStatusBadges.map(b => b.text())
      expect(statusTexts).toContain('Applied')
      expect(statusTexts).toContain('Dismissed')
    })

    it('shows summary counts per run', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'applied', appliedAt: '2026-03-01T10:00:00Z' }),
        createProposal({ id: 'p2', status: 'applied', appliedAt: '2026-03-01T10:00:00Z' }),
        createProposal({ id: 'p3', status: 'failed', error: 'timeout' }),
        createProposal({ id: 'p4', status: 'dismissed', dismissedAt: '2026-03-01T11:00:00Z' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const historyRuns = [
        {
          runAt: '2026-03-01T08:00:00Z',
          totalIssuesEvaluated: 10,
          totalViolationsFound: 4,
          newProposalsGenerated: 4,
          enabledRules: ['missing-rice-score'],
          proposals: [
            { id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }
          ]
        }
      ]
      mockGetHygieneHistory.mockResolvedValue({ runs: historyRuns })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.findAll('nav button').find(b => b.text().includes('History'))).toBeTruthy()
      })

      const historyTab = wrapper.findAll('nav button').find(b => b.text().includes('History'))
      await historyTab.trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('10 issues evaluated')
      })

      // Should show outcome summary counts on the run header
      expect(wrapper.text()).toContain('2 applied')
      expect(wrapper.text()).toContain('1 failed')
      expect(wrapper.text()).toContain('1 dismissed')
    })

    it('shows timestamps for proposal outcomes in history details', async () => {
      const proposals = [
        createProposal({ id: 'p1', status: 'applied', issueKey: 'RHAISTRAT-101', appliedAt: '2026-03-01T10:30:00Z' }),
        createProposal({ id: 'p2', status: 'dismissed', issueKey: 'RHAISTRAT-102', dismissedAt: '2026-03-01T11:45:00Z' })
      ]
      mockGetHygienePending.mockResolvedValue({ proposals, lastRunAt: '2026-03-01T08:00:00Z' })

      const historyRuns = [
        {
          runAt: '2026-03-01T08:00:00Z',
          totalIssuesEvaluated: 10,
          totalViolationsFound: 2,
          newProposalsGenerated: 2,
          enabledRules: ['missing-rice-score'],
          proposals: [
            { id: 'p1', issueKey: 'RHAISTRAT-101', ruleName: 'Missing RICE Score', actionType: 'comment' },
            { id: 'p2', issueKey: 'RHAISTRAT-102', ruleName: 'Missing RICE Score', actionType: 'comment' }
          ]
        }
      ]
      mockGetHygieneHistory.mockResolvedValue({ runs: historyRuns })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.findAll('nav button').find(b => b.text().includes('History'))).toBeTruthy()
      })

      const historyTab = wrapper.findAll('nav button').find(b => b.text().includes('History'))
      await historyTab.trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('10 issues evaluated')
      })

      const expandButton = wrapper.find('[data-testid="history-run-toggle-0"]')
      await expandButton.trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('RHAISTRAT-101')
      })

      // Should show outcome timestamps
      const outcomeTimestamps = wrapper.findAll('[data-testid="history-proposal-timestamp"]')
      expect(outcomeTimestamps.length).toBeGreaterThanOrEqual(2)
      // Timestamps should contain formatted date strings
      const timestampTexts = outcomeTimestamps.map(t => t.text())
      expect(timestampTexts.some(t => t.length > 0)).toBe(true)
    })
  })

  describe('Auto-enforce toggle', () => {
    it('renders an Auto column header in the rules table', async () => {
      mockGetHygieneConfig.mockResolvedValue({ rules: {} })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('Missing RICE Score')
      })

      const headers = wrapper.findAll('th')
      const headerTexts = headers.map(h => h.text())
      expect(headerTexts).toContain('Auto')
    })

    it('renders an auto-enforce toggle for each rule', async () => {
      mockGetHygieneConfig.mockResolvedValue({
        rules: { 'missing-rice-score': { enabled: true } }
      })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="auto-toggle-missing-rice-score"]').exists()).toBe(true)
      })
    })

    it('auto-enforce toggle is disabled when rule is not enabled', async () => {
      mockGetHygieneConfig.mockResolvedValue({
        rules: { 'missing-rice-score': { enabled: false } }
      })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="auto-toggle-missing-rice-score"]').exists()).toBe(true)
      })

      const autoToggle = wrapper.find('[data-testid="auto-toggle-missing-rice-score"]')
      expect(autoToggle.attributes('disabled')).toBeDefined()
    })

    it('auto-enforce toggle is enabled when rule is enabled', async () => {
      mockGetHygieneConfig.mockResolvedValue({
        rules: { 'missing-rice-score': { enabled: true } }
      })

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="auto-toggle-missing-rice-score"]').exists()).toBe(true)
      })

      const autoToggle = wrapper.find('[data-testid="auto-toggle-missing-rice-score"]')
      expect(autoToggle.attributes('disabled')).toBeUndefined()
    })

    it('saves autoEnforce config when auto toggle is clicked', async () => {
      mockGetHygieneConfig.mockResolvedValue({
        rules: { 'missing-rice-score': { enabled: true, autoEnforce: false } }
      })
      mockSaveHygieneConfig.mockResolvedValue({})

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="auto-toggle-missing-rice-score"]').exists()).toBe(true)
      })

      await wrapper.find('[data-testid="auto-toggle-missing-rice-score"]').trigger('click')

      expect(mockSaveHygieneConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          'missing-rice-score': expect.objectContaining({ autoEnforce: true })
        })
      )
    })

    it('turns off autoEnforce when enabled is toggled off', async () => {
      mockGetHygieneConfig.mockResolvedValue({
        rules: { 'missing-rice-score': { enabled: true, autoEnforce: true } }
      })
      mockSaveHygieneConfig.mockResolvedValue({})

      const wrapper = mount(HygieneEnforcementView)
      await vi.waitFor(() => {
        expect(wrapper.find('[data-testid="auto-toggle-missing-rice-score"]').exists()).toBe(true)
      })

      // Click the enabled toggle to disable the rule
      await wrapper.find('[data-testid="enabled-toggle-missing-rice-score"]').trigger('click')

      expect(mockSaveHygieneConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          'missing-rice-score': expect.objectContaining({ enabled: false, autoEnforce: false })
        })
      )
    })
  })
})
