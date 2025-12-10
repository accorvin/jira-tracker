/**
 * Tests for App.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../App.vue'
import KanbanBoard from '../components/KanbanBoard.vue'
import FilterBar from '../components/FilterBar.vue'

// Mock fetch
global.fetch = vi.fn()

describe('App', () => {
  const mockData = {
    lastUpdated: '2025-12-10T10:30:00Z',
    issues: [
      {
        key: 'ISSUE-1',
        summary: 'Test issue',
        issueType: 'Feature',
        assignee: 'John Doe',
        status: 'In Progress',
        team: 'Fine Tuning',
        releaseType: 'GA',
        targetRelease: 'rhoai-3.2',
        url: 'https://issues.redhat.com/browse/ISSUE-1'
      }
    ]
  }

  beforeEach(() => {
    fetch.mockReset()
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData
    })
  })

  it('renders Red Hat logo', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const logo = wrapper.find('img')
    expect(logo.exists()).toBe(true)
    expect(logo.attributes('src')).toContain('redhat-logo.svg')
  })

  it('renders page title "RHOAI T&E Features-at-a-Glance"', async () => {
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('RHOAI T&E Features-at-a-Glance')
  })

  it('fetches issues.json on mount', async () => {
    mount(App)
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/issues.json')
  })

  it('renders last updated timestamp', async () => {
    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Last Updated')
  })

  it('renders KanbanBoard component', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const board = wrapper.findComponent(KanbanBoard)
    expect(board.exists()).toBe(true)
  })

  it('renders FilterBar component', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const filterBar = wrapper.findComponent(FilterBar)
    expect(filterBar.exists()).toBe(true)
  })

  it('passes all issues to KanbanBoard initially', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const board = wrapper.findComponent(KanbanBoard)
    expect(board.props('issues')).toHaveLength(1)
    expect(board.props('issues')[0].key).toBe('ISSUE-1')
  })

  it('filters issues when FilterBar emits filter-change', async () => {
    const multiIssueData = {
      lastUpdated: '2025-12-10T10:30:00Z',
      issues: [
        {
          key: 'ISSUE-1',
          summary: 'Issue 1',
          issueType: 'Feature',
          assignee: 'John Doe',
          status: 'In Progress',
          team: 'Fine Tuning',
          releaseType: 'GA',
          targetRelease: 'rhoai-3.2',
          url: 'https://issues.redhat.com/browse/ISSUE-1'
        },
        {
          key: 'ISSUE-2',
          summary: 'Issue 2',
          issueType: 'Initiative',
          assignee: 'Jane Smith',
          status: 'New',
          team: 'KubeRay',
          releaseType: 'GA',
          targetRelease: 'rhoai-3.2',
          url: 'https://issues.redhat.com/browse/ISSUE-2'
        }
      ]
    }

    fetch.mockResolvedValue({
      ok: true,
      json: async () => multiIssueData
    })

    const wrapper = mount(App)
    await flushPromises()

    const filterBar = wrapper.findComponent(FilterBar)
    filterBar.vm.$emit('filter-change', { assignee: 'John Doe', status: '', team: '', issueType: '' })
    await wrapper.vm.$nextTick()

    const board = wrapper.findComponent(KanbanBoard)
    expect(board.props('issues')).toHaveLength(1)
    expect(board.props('issues')[0].key).toBe('ISSUE-1')
  })

  it('passes all issues to FilterBar', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const filterBar = wrapper.findComponent(FilterBar)
    expect(filterBar.props('issues')).toHaveLength(1)
  })
})
