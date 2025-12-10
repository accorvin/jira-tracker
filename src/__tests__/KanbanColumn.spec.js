/**
 * Tests for KanbanColumn.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import KanbanColumn from '../components/KanbanColumn.vue'
import IssueCard from '../components/IssueCard.vue'

describe('KanbanColumn', () => {
  const mockIssues = [
    {
      key: 'RHOAIENG-123',
      summary: 'Implement feature X',
      issueType: 'Feature',
      assignee: 'John Doe',
      status: 'In Progress',
      team: 'Fine Tuning',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/RHOAIENG-123'
    },
    {
      key: 'RHOAIENG-124',
      summary: 'Implement feature Y',
      issueType: 'Feature',
      assignee: 'Jane Smith',
      status: 'In Progress',
      team: 'KubeRay',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2',
      url: 'https://issues.redhat.com/browse/RHOAIENG-124'
    }
  ]

  it('renders column title', () => {
    const wrapper = mount(KanbanColumn, {
      props: {
        title: 'In Progress',
        issues: mockIssues
      }
    })

    expect(wrapper.text()).toContain('In Progress')
  })

  it('renders issue count', () => {
    const wrapper = mount(KanbanColumn, {
      props: {
        title: 'In Progress',
        issues: mockIssues
      }
    })

    expect(wrapper.text()).toContain('2')
  })

  it('renders list of IssueCard components', () => {
    const wrapper = mount(KanbanColumn, {
      props: {
        title: 'In Progress',
        issues: mockIssues
      }
    })

    const cards = wrapper.findAllComponents(IssueCard)
    expect(cards).toHaveLength(2)
  })

  it('handles empty issue list', () => {
    const wrapper = mount(KanbanColumn, {
      props: {
        title: 'In Progress',
        issues: []
      }
    })

    const cards = wrapper.findAllComponents(IssueCard)
    expect(cards).toHaveLength(0)
    expect(wrapper.text()).toContain('0')
  })

  it('passes issue props to IssueCard components', () => {
    const wrapper = mount(KanbanColumn, {
      props: {
        title: 'In Progress',
        issues: mockIssues
      }
    })

    const cards = wrapper.findAllComponents(IssueCard)
    expect(cards[0].props('issue')).toEqual(mockIssues[0])
    expect(cards[1].props('issue')).toEqual(mockIssues[1])
  })
})
