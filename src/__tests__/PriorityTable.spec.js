/**
 * Tests for PriorityTable.vue component - following TDD practices.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PriorityTable from '../components/PriorityTable.vue'

describe('PriorityTable', () => {
  const mockIssues = [
    { key: 'RHOAIENG-001', summary: 'Feature A', team: 'Team X', status: 'In Progress', rank: 1, displayRank: 1, colorStatus: 'Green', targetRelease: ['rhoai-3.2'], components: ['UI', 'Backend'], labels: ['3.4-committed', 'important'] },
    { key: 'RHOAIENG-002', summary: 'Feature B', team: 'Team Y', status: 'New', rank: 2, displayRank: 2, colorStatus: null, targetRelease: ['rhoai-3.2'], components: [], labels: [] },
    { key: 'RHOAIENG-003', summary: 'Feature C', team: 'Team Z', status: 'In Progress', rank: 101, displayRank: 3, colorStatus: 'Yellow', targetRelease: ['rhoai-3.2'], components: ['API'], labels: ['3.4-committed'] }
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
    expect(headerTexts).toContain('Components')
    expect(headerTexts).toContain('Labels')
    expect(headerTexts).toContain('Status')
  })

  it('renders components as individual pills', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const rows = wrapper.findAll('tbody tr')

    // First issue has ['UI', 'Backend'] — two pills
    const row1Pills = rows[0].findAll('[data-testid="component-pill"]')
    expect(row1Pills.length).toBe(2)
    expect(row1Pills[0].text()).toBe('UI')
    expect(row1Pills[1].text()).toBe('Backend')
    expect(row1Pills[0].classes()).toContain('rounded-full')

    // Second issue has empty components — dash, no pills
    const row2Pills = rows[1].findAll('[data-testid="component-pill"]')
    expect(row2Pills.length).toBe(0)
    expect(rows[1].text()).toContain('—')

    // Third issue has ['API'] — one pill
    const row3Pills = rows[2].findAll('[data-testid="component-pill"]')
    expect(row3Pills.length).toBe(1)
    expect(row3Pills[0].text()).toBe('API')
  })

  it('renders labels as individual pills', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const rows = wrapper.findAll('tbody tr')

    // First issue has ['3.4-committed', 'important'] — two pills
    const row1Pills = rows[0].findAll('[data-testid="label-pill"]')
    expect(row1Pills.length).toBe(2)
    expect(row1Pills[0].text()).toBe('3.4-committed')
    expect(row1Pills[1].text()).toBe('important')
    expect(row1Pills[0].classes()).toContain('rounded-full')

    // Second issue has empty labels — dash, no pills
    const row2Pills = rows[1].findAll('[data-testid="label-pill"]')
    expect(row2Pills.length).toBe(0)
    expect(rows[1].find('[data-testid="labels-cell"]').text()).toContain('—')

    // Third issue has ['3.4-committed'] — one pill
    const row3Pills = rows[2].findAll('[data-testid="label-pill"]')
    expect(row3Pills.length).toBe(1)
    expect(row3Pills[0].text()).toBe('3.4-committed')
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

  it('displays neutral rank badge styling for all issues', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const rankBadges = wrapper.findAll('[data-testid="rank-badge"]')
    expect(rankBadges.length).toBe(3)

    for (const badge of rankBadges) {
      expect(badge.classes()).toContain('bg-gray-100')
      expect(badge.classes()).toContain('text-gray-700')
    }
  })

  it('renders issue keys as links to Jira', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const links = wrapper.findAll('a[data-testid="issue-link"]')
    expect(links.length).toBe(3)
    expect(links[0].attributes('href')).toContain('RHOAIENG-001')
  })

  it('shows neutral left borders on all rows', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: mockIssues }
    })
    const rows = wrapper.findAll('tbody tr')
    for (const row of rows) {
      expect(row.classes()).toContain('border-l-gray-300')
    }
  })

  it('renders empty state when no issues', () => {
    const wrapper = mount(PriorityTable, {
      props: { issues: [] }
    })
    expect(wrapper.text()).toContain('No issues')
  })
})
