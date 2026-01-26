/**
 * Tests for RoadmapBoard.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoadmapBoard from '../components/RoadmapBoard.vue'

describe('RoadmapBoard', () => {
  const mockIssues = [
    { key: 'ISSUE-1', summary: 'Feature 1', targetRelease: ['rhoai-3.2'] },
    { key: 'ISSUE-2', summary: 'Feature 2', targetRelease: ['rhoai-3.1'] },
    { key: 'ISSUE-3', summary: 'Feature 3', targetRelease: ['rhoai-3.3'] },
    { key: 'ISSUE-4', summary: 'Feature 4', targetRelease: [] },
    { key: 'ISSUE-5', summary: 'Feature 5', targetRelease: ['rhoai-3.2'] }
  ]

  it('renders a Backlog column as the leftmost column', () => {
    const wrapper = mount(RoadmapBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')
    expect(columns.length).toBeGreaterThan(0)
    expect(columns[0].find('[data-testid="column-title"]').text()).toBe('Backlog')
  })

  it('renders columns for each unique release in the issues', () => {
    const wrapper = mount(RoadmapBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')
    const columnTitles = columns.map(c => c.find('[data-testid="column-title"]').text())

    // Should have Backlog + 3 releases (3.1, 3.2, 3.3)
    expect(columns.length).toBe(4)
    expect(columnTitles).toContain('Backlog')
    expect(columnTitles).toContain('rhoai-3.1')
    expect(columnTitles).toContain('rhoai-3.2')
    expect(columnTitles).toContain('rhoai-3.3')
  })

  it('sorts release columns chronologically (by version)', () => {
    const wrapper = mount(RoadmapBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')
    const columnTitles = columns.map(c => c.find('[data-testid="column-title"]').text())

    // Order should be: Backlog, 3.1, 3.2, 3.3
    expect(columnTitles[0]).toBe('Backlog')
    expect(columnTitles[1]).toBe('rhoai-3.1')
    expect(columnTitles[2]).toBe('rhoai-3.2')
    expect(columnTitles[3]).toBe('rhoai-3.3')
  })

  it('places issues without targetRelease in the Backlog column', () => {
    const wrapper = mount(RoadmapBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')
    const backlogColumn = columns[0]
    const backlogCards = backlogColumn.findAll('[data-testid="issue-card"]')

    expect(backlogCards.length).toBe(1)
    expect(backlogCards[0].text()).toContain('ISSUE-4')
  })

  it('groups issues by their targetRelease', () => {
    const wrapper = mount(RoadmapBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')

    // Find the rhoai-3.2 column (should be index 2 after Backlog and 3.1)
    const release32Column = columns.find(c =>
      c.find('[data-testid="column-title"]').text() === 'rhoai-3.2'
    )
    const release32Cards = release32Column.findAll('[data-testid="issue-card"]')

    // Should have ISSUE-1 and ISSUE-5
    expect(release32Cards.length).toBe(2)
  })

  it('sorts issues alphabetically by key within each column', () => {
    const wrapper = mount(RoadmapBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')
    const release32Column = columns.find(c =>
      c.find('[data-testid="column-title"]').text() === 'rhoai-3.2'
    )
    const release32Cards = release32Column.findAll('[data-testid="issue-card"]')

    // ISSUE-1 should come before ISSUE-5 alphabetically
    expect(release32Cards[0].text()).toContain('ISSUE-1')
    expect(release32Cards[1].text()).toContain('ISSUE-5')
  })

  it('displays issue in multiple columns if it targets multiple releases', () => {
    const multiReleaseIssues = [
      { key: 'ISSUE-1', summary: 'Multi-release feature', targetRelease: ['rhoai-3.1', 'rhoai-3.2'] }
    ]

    const wrapper = mount(RoadmapBoard, {
      props: { issues: multiReleaseIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')

    const release31Column = columns.find(c =>
      c.find('[data-testid="column-title"]').text() === 'rhoai-3.1'
    )
    const release32Column = columns.find(c =>
      c.find('[data-testid="column-title"]').text() === 'rhoai-3.2'
    )

    expect(release31Column.findAll('[data-testid="issue-card"]').length).toBe(1)
    expect(release32Column.findAll('[data-testid="issue-card"]').length).toBe(1)
  })

  it('handles empty issues array gracefully', () => {
    const wrapper = mount(RoadmapBoard, {
      props: { issues: [] }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')

    // Should still show Backlog column
    expect(columns.length).toBe(1)
    expect(columns[0].find('[data-testid="column-title"]').text()).toBe('Backlog')
  })

  it('displays issue count badge on each column', () => {
    const wrapper = mount(RoadmapBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')
    const backlogColumn = columns[0]
    const countBadge = backlogColumn.find('[data-testid="column-count"]')

    expect(countBadge.exists()).toBe(true)
    expect(countBadge.text()).toBe('1')
  })

  it('handles issues with null targetRelease as backlog', () => {
    const issuesWithNull = [
      { key: 'ISSUE-1', summary: 'Feature 1', targetRelease: null },
      { key: 'ISSUE-2', summary: 'Feature 2', targetRelease: ['rhoai-3.1'] }
    ]

    const wrapper = mount(RoadmapBoard, {
      props: { issues: issuesWithNull }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')
    const backlogColumn = columns[0]
    const backlogCards = backlogColumn.findAll('[data-testid="issue-card"]')

    expect(backlogCards.length).toBe(1)
    expect(backlogCards[0].text()).toContain('ISSUE-1')
  })

  it('handles extended version numbers correctly', () => {
    const extendedVersionIssues = [
      { key: 'ISSUE-1', summary: 'Feature 1', targetRelease: ['rhoai-3.4'] },
      { key: 'ISSUE-2', summary: 'Feature 2', targetRelease: ['rhoai-3.4.RC1'] },
      { key: 'ISSUE-3', summary: 'Feature 3', targetRelease: ['rhoai-3.4.EA1'] }
    ]

    const wrapper = mount(RoadmapBoard, {
      props: { issues: extendedVersionIssues }
    })

    const columns = wrapper.findAll('[data-testid="roadmap-column"]')
    const columnTitles = columns.map(c => c.find('[data-testid="column-title"]').text())

    // Pre-releases should come before base version
    // Order: Backlog, 3.4.EA1, 3.4.RC1, 3.4
    expect(columnTitles[1]).toBe('rhoai-3.4.EA1')
    expect(columnTitles[2]).toBe('rhoai-3.4.RC1')
    expect(columnTitles[3]).toBe('rhoai-3.4')
  })
})
