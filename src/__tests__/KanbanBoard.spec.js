/**
 * Tests for KanbanBoard.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KanbanBoard from '../components/KanbanBoard.vue'
import KanbanColumn from '../components/KanbanColumn.vue'

describe('KanbanBoard', () => {
  const mockIssues = [
    {
      key: 'ISSUE-1',
      summary: 'New issue',
      issueType: 'Feature',
      assignee: 'John',
      status: 'New',
      team: 'Team A',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/ISSUE-1'
    },
    {
      key: 'ISSUE-2',
      summary: 'Backlog issue',
      issueType: 'Feature',
      assignee: 'Jane',
      status: 'Backlog',
      team: 'Team B',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/ISSUE-2'
    },
    {
      key: 'ISSUE-3',
      summary: 'Refinement issue',
      issueType: 'Feature',
      assignee: 'Bob',
      status: 'Refinement',
      team: 'Team A',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/ISSUE-3'
    },
    {
      key: 'ISSUE-4',
      summary: 'In Progress issue',
      issueType: 'Feature',
      assignee: 'Alice',
      status: 'In Progress',
      team: 'Team B',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/ISSUE-4'
    },
    {
      key: 'ISSUE-5',
      summary: 'Review issue',
      issueType: 'Feature',
      assignee: 'Charlie',
      status: 'Review',
      team: 'Team A',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/ISSUE-5'
    },
    {
      key: 'ISSUE-6',
      summary: 'Testing issue',
      issueType: 'Feature',
      assignee: 'David',
      status: 'Testing',
      team: 'Team B',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/ISSUE-6'
    },
    {
      key: 'ISSUE-7',
      summary: 'Resolved issue',
      issueType: 'Feature',
      assignee: 'Eve',
      status: 'Resolved',
      team: 'Team A',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/ISSUE-7'
    },
    {
      key: 'ISSUE-8',
      summary: 'Closed issue',
      issueType: 'Feature',
      assignee: 'Frank',
      status: 'Closed',
      team: 'Team B',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/ISSUE-8'
    }
  ]

  it('renders four columns: To Do, In Refinement, In Progress, Done', () => {
    const wrapper = mount(KanbanBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAllComponents(KanbanColumn)
    expect(columns).toHaveLength(4)

    const titles = columns.map(col => col.props('title'))
    expect(titles).toContain('To Do')
    expect(titles).toContain('In Refinement')
    expect(titles).toContain('In Progress')
    expect(titles).toContain('Done')
  })

  it('maps "New" and "Backlog" statuses to "To Do" column', () => {
    const wrapper = mount(KanbanBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAllComponents(KanbanColumn)
    const todoColumn = columns.find(col => col.props('title') === 'To Do')

    expect(todoColumn.props('issues')).toHaveLength(2)
    expect(todoColumn.props('issues')[0].key).toBe('ISSUE-1')
    expect(todoColumn.props('issues')[1].key).toBe('ISSUE-2')
  })

  it('maps "Refinement" status to "In Refinement" column', () => {
    const wrapper = mount(KanbanBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAllComponents(KanbanColumn)
    const refinementColumn = columns.find(col => col.props('title') === 'In Refinement')

    expect(refinementColumn.props('issues')).toHaveLength(1)
    expect(refinementColumn.props('issues')[0].key).toBe('ISSUE-3')
  })

  it('maps "In Progress", "Review", "Testing" statuses to "In Progress" column', () => {
    const wrapper = mount(KanbanBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAllComponents(KanbanColumn)
    const inProgressColumn = columns.find(col => col.props('title') === 'In Progress')

    expect(inProgressColumn.props('issues')).toHaveLength(3)
    expect(inProgressColumn.props('issues')[0].key).toBe('ISSUE-4')
    expect(inProgressColumn.props('issues')[1].key).toBe('ISSUE-5')
    expect(inProgressColumn.props('issues')[2].key).toBe('ISSUE-6')
  })

  it('maps "Resolved" and "Closed" statuses to "Done" column', () => {
    const wrapper = mount(KanbanBoard, {
      props: { issues: mockIssues }
    })

    const columns = wrapper.findAllComponents(KanbanColumn)
    const doneColumn = columns.find(col => col.props('title') === 'Done')

    expect(doneColumn.props('issues')).toHaveLength(2)
    expect(doneColumn.props('issues')[0].key).toBe('ISSUE-7')
    expect(doneColumn.props('issues')[1].key).toBe('ISSUE-8')
  })

  it('handles unknown status gracefully', () => {
    const issuesWithUnknown = [
      ...mockIssues,
      {
        key: 'ISSUE-9',
        summary: 'Unknown status issue',
        issueType: 'Feature',
        assignee: 'Grace',
        status: 'UnknownStatus',
        team: 'Team A',
        releaseType: 'GA',
        targetRelease: 'rhoai-3.2',
        url: 'https://issues.redhat.com/browse/ISSUE-9'
      }
    ]

    const wrapper = mount(KanbanBoard, {
      props: { issues: issuesWithUnknown }
    })

    // Should not crash
    const columns = wrapper.findAllComponents(KanbanColumn)
    expect(columns).toHaveLength(4)
  })

  it('handles empty issues array', () => {
    const wrapper = mount(KanbanBoard, {
      props: { issues: [] }
    })

    const columns = wrapper.findAllComponents(KanbanColumn)
    expect(columns).toHaveLength(4)

    columns.forEach(col => {
      expect(col.props('issues')).toHaveLength(0)
    })
  })
})
