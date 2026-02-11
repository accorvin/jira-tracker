/**
 * Tests for PriorityTable.vue component - following TDD practices.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PriorityTable from '../components/PriorityTable.vue'

describe('PriorityTable', () => {
  const mockIssues = [
    { key: 'RHOAIENG-001', summary: 'Feature A', team: 'Team X', status: 'In Progress', rank: 1, displayRank: 1, colorStatus: 'Green', targetRelease: ['rhoai-3.2'] },
    { key: 'RHOAIENG-002', summary: 'Feature B', team: 'Team Y', status: 'New', rank: 2, displayRank: 2, colorStatus: null, targetRelease: ['rhoai-3.2'] },
    { key: 'RHOAIENG-003', summary: 'Feature C', team: 'Team Z', status: 'In Progress', rank: 101, displayRank: 3, colorStatus: 'Yellow', targetRelease: ['rhoai-3.2'] }
  ]

  it('renders a table with correct columns', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const headers = wrapper.findAll('th')
    const headerTexts = headers.map(h => h.text())
    expect(headerTexts).toContain('Rank')
    expect(headerTexts).toContain('Key')
    expect(headerTexts).toContain('Summary')
    expect(headerTexts).toContain('Team')
    expect(headerTexts).toContain('Status')
  })

  it('renders rows sorted by rank ascending', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(3)

    // First row should be rank 1
    expect(rows[0].text()).toContain('RHOAIENG-001')
    // Second row should be rank 2
    expect(rows[1].text()).toContain('RHOAIENG-002')
    // Third row should be rank 101
    expect(rows[2].text()).toContain('RHOAIENG-003')
  })

  it('displays displayRank values in rank badges', () => {
    const issues = [
      { key: 'A-1', summary: 'First', team: 'T', status: 'New', rank: 15, displayRank: 5, colorStatus: null, targetRelease: [] },
      { key: 'A-2', summary: 'Second', team: 'T', status: 'New', rank: 42, displayRank: 12, colorStatus: null, targetRelease: [] }
    ]
    const wrapper = mount(PriorityTable, {
      props: { issues }
    })
    const rankBadges = wrapper.findAll('[data-testid="rank-badge"]')
    expect(rankBadges[0].text()).toBe('5')
    expect(rankBadges[1].text()).toBe('12')
  })

  it('displays rank badges with tier colors', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const rankBadges = wrapper.findAll('[data-testid="rank-badge"]')
    expect(rankBadges.length).toBe(3)

    // Rank 1 (top tier) - green
    expect(rankBadges[0].classes()).toContain('bg-green-500')
    // Rank 2 (top tier) - green
    expect(rankBadges[1].classes()).toContain('bg-green-500')
    // Rank 101 (low tier) - gray
    expect(rankBadges[2].classes()).toContain('bg-gray-300')
  })

  it('highlights in-progress items ranked >100 with amber background', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const rows = wrapper.findAll('tbody tr')
    // RHOAIENG-003 is rank 101, In Progress - should have amber highlight
    const rank101Row = rows[2] // sorted last
    expect(rank101Row.classes()).toContain('bg-amber-50')
  })

  it('does not highlight idle items ranked >100 with amber', () => {
    const issues = [
      { key: 'A-1', summary: 'Test', team: 'Team A', status: 'New', rank: 150, colorStatus: null, targetRelease: [] }
    ]
    const wrapper = mount(PriorityTable, {
      props: { issues }
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].classes()).not.toContain('bg-amber-50')
  })

  it('renders issue keys as links to Jira', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const links = wrapper.findAll('a[data-testid="issue-link"]')
    expect(links.length).toBe(3)
    expect(links[0].attributes('href')).toContain('RHOAIENG-001')
  })

  it('shows tier-colored left borders on rows', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const rows = wrapper.findAll('tbody tr')
    // Rank 1 (top) - green left border
    expect(rows[0].classes()).toContain('border-l-green-500')
    // Rank 101 (low) - gray left border
    expect(rows[2].classes()).toContain('border-l-gray-300')
  })

  it('renders empty state when no issues', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: [] }
    })
    expect(wrapper.text()).toContain('No issues')
  })
})
