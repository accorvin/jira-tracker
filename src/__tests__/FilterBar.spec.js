/**
 * Tests for FilterBar.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FilterBar from '../components/FilterBar.vue'

describe('FilterBar', () => {
  const mockIssues = [
    {
      key: 'ISSUE-1',
      summary: 'Issue 1',
      issueType: 'Feature',
      assignee: 'John Doe',
      status: 'In Progress',
      team: 'Fine Tuning',
      releaseType: 'GA',
      targetRelease: 'rhoai-3.2'
    },
    {
      key: 'ISSUE-2',
      summary: 'Issue 2',
      issueType: 'Initiative',
      assignee: 'Jane Smith',
      status: 'New',
      team: 'KubeRay',
      releaseType: 'Tech Preview',
      targetRelease: 'rhoai-3.2'
    },
    {
      key: 'ISSUE-3',
      summary: 'Issue 3',
      issueType: 'Feature',
      assignee: null,
      status: 'Resolved',
      team: null,
      releaseType: null,
      targetRelease: 'rhoai-3.3'
    }
  ]

  it('renders filter dropdowns', () => {
    const wrapper = mount(FilterBar, {
      props: { issues: mockIssues }
    })

    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('populates assignee filter options from issue data', () => {
    const wrapper = mount(FilterBar, {
      props: { issues: mockIssues }
    })

    const html = wrapper.html()
    expect(html).toContain('John Doe')
    expect(html).toContain('Jane Smith')
  })

  it('populates status filter options from issue data', () => {
    const wrapper = mount(FilterBar, {
      props: { issues: mockIssues }
    })

    const html = wrapper.html()
    expect(html).toContain('In Progress')
    expect(html).toContain('New')
    expect(html).toContain('Resolved')
  })

  it('populates team filter options from issue data', () => {
    const wrapper = mount(FilterBar, {
      props: { issues: mockIssues }
    })

    const html = wrapper.html()
    expect(html).toContain('Fine Tuning')
    expect(html).toContain('KubeRay')
  })

  it('populates issue type filter options from issue data', () => {
    const wrapper = mount(FilterBar, {
      props: { issues: mockIssues }
    })

    const html = wrapper.html()
    expect(html).toContain('Feature')
    expect(html).toContain('Initiative')
  })

  it('emits filter change events', async () => {
    const wrapper = mount(FilterBar, {
      props: { issues: mockIssues }
    })

    const selects = wrapper.findAll('select')
    await selects[0].setValue('John Doe')

    expect(wrapper.emitted('filter-change')).toBeTruthy()
  })

  it('has clear filters functionality', async () => {
    const wrapper = mount(FilterBar, {
      props: { issues: mockIssues }
    })

    const clearButton = wrapper.find('button')
    expect(clearButton.exists()).toBe(true)
    expect(clearButton.text()).toContain('Clear')
  })
})
