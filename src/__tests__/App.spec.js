/**
 * Tests for App.vue component - following TDD practices.
 * Updated for release-based flow.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from '../App.vue'
import KanbanBoard from '../components/KanbanBoard.vue'
import FilterBar from '../components/FilterBar.vue'
import ReleaseTabBar from '../components/ReleaseTabBar.vue'
import ReleaseInfoPanel from '../components/ReleaseInfoPanel.vue'

// Mock fetch
global.fetch = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
global.localStorage = localStorageMock

describe('App', () => {
  const mockReleases = {
    releases: [
      {
        name: 'rhoai-3.2',
        planDate: '2024-11-30',
        codeFreeze: '2024-12-20',
        releaseDate: '2025-01-15'
      }
    ]
  }

  const mockIssues = {
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

  const mockRefreshResponse = {
    success: true,
    count: 1
  }

  beforeEach(() => {
    fetch.mockReset()
    localStorageMock.getItem.mockReset()
    localStorageMock.setItem.mockReset()
    localStorageMock.removeItem.mockReset()

    // Set up fetch mock to handle different endpoints
    fetch.mockImplementation((url, options) => {
      if (url === '/api/releases') {
        return Promise.resolve({
          ok: true,
          json: async () => mockReleases
        })
      }
      if (url === '/api/refresh') {
        return Promise.resolve({
          ok: true,
          json: async () => mockRefreshResponse
        })
      }
      if (url === '/issues.json') {
        return Promise.resolve({
          ok: true,
          json: async () => mockIssues
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
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

  it('fetches releases on mount', async () => {
    mount(App)
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/releases')
  })

  it('fetches issues after loading releases', async () => {
    mount(App)
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/refresh', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ targetRelease: 'rhoai-3.2' })
    }))
    expect(fetch).toHaveBeenCalledWith('/issues.json')
  })

  it('renders last updated timestamp when issues are loaded', async () => {
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

  it('renders ReleaseTabBar component', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const tabBar = wrapper.findComponent(ReleaseTabBar)
    expect(tabBar.exists()).toBe(true)
  })

  it('renders ReleaseInfoPanel when release is selected', async () => {
    const wrapper = mount(App)
    await flushPromises()

    const infoPanel = wrapper.findComponent(ReleaseInfoPanel)
    expect(infoPanel.exists()).toBe(true)
  })

  it('renders FilterBar component when issues are loaded', async () => {
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

    fetch.mockImplementation((url) => {
      if (url === '/api/releases') {
        return Promise.resolve({
          ok: true,
          json: async () => mockReleases
        })
      }
      if (url === '/api/refresh') {
        return Promise.resolve({
          ok: true,
          json: async () => mockRefreshResponse
        })
      }
      if (url === '/issues.json') {
        return Promise.resolve({
          ok: true,
          json: async () => multiIssueData
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
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

  it('shows modal when no releases exist', async () => {
    fetch.mockImplementation((url) => {
      if (url === '/api/releases') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ releases: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    const wrapper = mount(App)
    await flushPromises()

    expect(wrapper.text()).toContain('Add Release')
  })

  it('saves selected release to localStorage when switching releases', async () => {
    const multiReleaseData = {
      releases: [
        { name: 'rhoai-3.1', planDate: '2024-08-30', codeFreeze: '2024-09-20', releaseDate: '2024-10-15' },
        { name: 'rhoai-3.2', planDate: '2024-11-30', codeFreeze: '2024-12-20', releaseDate: '2025-01-15' }
      ]
    }

    fetch.mockImplementation((url) => {
      if (url === '/api/releases') {
        return Promise.resolve({
          ok: true,
          json: async () => multiReleaseData
        })
      }
      if (url === '/api/refresh') {
        return Promise.resolve({
          ok: true,
          json: async () => mockRefreshResponse
        })
      }
      if (url === '/issues.json') {
        return Promise.resolve({
          ok: true,
          json: async () => mockIssues
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    const wrapper = mount(App)
    await flushPromises()

    // Clear any calls from initial load
    localStorageMock.setItem.mockClear()

    // Switch to a different release
    const tabBar = wrapper.findComponent(ReleaseTabBar)
    tabBar.vm.$emit('select', 'rhoai-3.2')
    await flushPromises()

    expect(localStorageMock.setItem).toHaveBeenCalledWith('selectedRelease', 'rhoai-3.2')
  })
})
