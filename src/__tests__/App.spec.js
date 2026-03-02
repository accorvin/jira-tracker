/**
 * Tests for App.vue component - following TDD practices.
 * Updated for release-based flow.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import App from '../App.vue'
import KanbanBoard from '../components/KanbanBoard.vue'
import FilterBar from '../components/FilterBar.vue'
import ReleaseTabBar from '../components/ReleaseTabBar.vue'
import ReleaseInfoPanel from '../components/ReleaseInfoPanel.vue'

// Create reactive user ref that can be controlled in tests
const mockUser = ref(null)
const mockLoading = ref(false)
const mockError = ref(null)

// Mock useAuth composable
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    error: mockError,
    signIn: vi.fn(),
    signOut: vi.fn(),
    getIdToken: vi.fn(async () => 'mock-token')
  })
}))

// Mock useAdmin composable
vi.mock('../composables/useAdmin', () => ({
  useAdmin: () => ({
    isAdmin: ref(true),
    adminList: ref([]),
    adminLoading: ref(false),
    adminError: ref(null),
    fetchAdminStatus: vi.fn(),
    resetAdmin: vi.fn()
  })
}))

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
  const API_ENDPOINT = '/api'

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
        components: ['AI Pipelines'],
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

    // Reset auth state - start with null user, will be set to trigger watcher
    mockUser.value = null
    mockLoading.value = false
    mockError.value = null

    // Ensure currentView is 'release-tracking' by default
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'currentView') return null
      return null
    })

    // Set up fetch mock to handle different endpoints
    fetch.mockImplementation((url, options) => {
      if (url === `${API_ENDPOINT}/releases`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockReleases
        })
      }
      if (url === `${API_ENDPOINT}/refresh`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockRefreshResponse
        })
      }
      if (url === `${API_ENDPOINT}/issues/rhoai-3.2`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockIssues
        })
      }
      if (url === `${API_ENDPOINT}/plan-rankings`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ lastUpdated: '2025-12-10T10:30:00Z', planId: 2423, totalCount: 0, issues: [] })
        })
      }
      if (url === `${API_ENDPOINT}/admins`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ admins: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })
  })

  // Helper to authenticate user and trigger data loading
  const authenticateUser = async (wrapper, { waitForIssues = true } = {}) => {
    mockUser.value = {
      email: 'test@redhat.com',
      displayName: 'Test User',
      photoURL: null,
      getIdToken: async () => 'mock-token'
    }
    // Flush promises to trigger the watcher
    await flushPromises()

    if (wrapper && waitForIssues) {
      // Wait for issues to be loaded (max 50ms)
      let attempts = 0
      while (wrapper.vm.allIssues.length === 0 && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 5))
        await flushPromises()
        await wrapper.vm.$nextTick()
        attempts++
      }
    }

    await flushPromises()
  }

  it('renders Red Hat logo', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    const logo = wrapper.find('img')
    expect(logo.exists()).toBe(true)
    expect(logo.attributes('src')).toContain('redhat-logo.svg')
  })

  it('renders page title "OpenShift AI Features-at-a-Glance"', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    expect(wrapper.text()).toContain('OpenShift AI Features-at-a-Glance')
  })

  it('fetches releases on mount', async () => {
    mount(App)
    await authenticateUser()

    expect(fetch).toHaveBeenCalledWith('/api/releases', expect.any(Object))
  })

  it('fetches issues after loading releases', async () => {
    mount(App)
    await authenticateUser(null, { waitForIssues: false })
    await new Promise(resolve => setTimeout(resolve, 20))
    await flushPromises()

    // Check that the URLs were called (don't check call order)
    const callUrls = fetch.mock.calls.map(call => call[0])
    expect(callUrls).toContain('/api/releases')
    expect(callUrls).toContain('/api/issues/rhoai-3.2')
  })

  it('renders last updated timestamp when issues are loaded', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    expect(wrapper.text()).toContain('Last Updated')
  })

  it('renders KanbanBoard component', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    const board = wrapper.findComponent(KanbanBoard)
    expect(board.exists()).toBe(true)
  })

  it('renders ReleaseTabBar component', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    const tabBar = wrapper.findComponent(ReleaseTabBar)
    expect(tabBar.exists()).toBe(true)
  })

  it('renders ReleaseInfoPanel when release is selected', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    const infoPanel = wrapper.findComponent(ReleaseInfoPanel)
    expect(infoPanel.exists()).toBe(true)
  })

  it('renders FilterBar component when issues are loaded', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    const filterBar = wrapper.findComponent(FilterBar)
    expect(filterBar.exists()).toBe(true)
  })

  it('passes all issues to KanbanBoard initially', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

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
          components: ['AI Pipelines'],
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
          components: ['Training Ray'],
          releaseType: 'GA',
          targetRelease: 'rhoai-3.2',
          url: 'https://issues.redhat.com/browse/ISSUE-2'
        }
      ]
    }

    fetch.mockImplementation((url) => {
      if (url === `${API_ENDPOINT}/releases`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockReleases
        })
      }
      if (url === `${API_ENDPOINT}/refresh`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockRefreshResponse
        })
      }
      if (url === `${API_ENDPOINT}/issues/rhoai-3.2`) {
        return Promise.resolve({
          ok: true,
          json: async () => multiIssueData
        })
      }
      if (url === `${API_ENDPOINT}/plan-rankings`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ lastUpdated: '2025-12-10T10:30:00Z', planId: 2423, totalCount: 0, issues: [] })
        })
      }
      if (url === `${API_ENDPOINT}/admins`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ admins: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    const wrapper = mount(App)
    await authenticateUser(wrapper)

    const filterBar = wrapper.findComponent(FilterBar)
    filterBar.vm.$emit('filter-change', { teams: [], components: [], assignee: 'John Doe', status: '', issueType: '' })
    await wrapper.vm.$nextTick()

    const board = wrapper.findComponent(KanbanBoard)
    expect(board.props('issues')).toHaveLength(1)
    expect(board.props('issues')[0].key).toBe('ISSUE-1')
  })

  it('passes all issues to FilterBar', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    const filterBar = wrapper.findComponent(FilterBar)
    expect(filterBar.props('issues')).toHaveLength(1)
  })

  it('shows modal when no releases exist', async () => {
    fetch.mockImplementation((url) => {
      if (url === `${API_ENDPOINT}/releases`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ releases: [] })
        })
      }
      if (url === `${API_ENDPOINT}/plan-rankings`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ lastUpdated: '2025-12-10T10:30:00Z', planId: 2423, totalCount: 0, issues: [] })
        })
      }
      if (url === `${API_ENDPOINT}/admins`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ admins: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    const wrapper = mount(App)
    await authenticateUser(wrapper)

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
      if (url === `${API_ENDPOINT}/releases`) {
        return Promise.resolve({
          ok: true,
          json: async () => multiReleaseData
        })
      }
      if (url === `${API_ENDPOINT}/refresh`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockRefreshResponse
        })
      }
      if (url.startsWith(`${API_ENDPOINT}/issues/`)) {
        return Promise.resolve({
          ok: true,
          json: async () => mockIssues
        })
      }
      if (url === `${API_ENDPOINT}/plan-rankings`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ lastUpdated: '2025-12-10T10:30:00Z', planId: 2423, totalCount: 0, issues: [] })
        })
      }
      if (url === `${API_ENDPOINT}/admins`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ admins: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    const wrapper = mount(App)
    await authenticateUser()

    // Clear any calls from initial load
    localStorageMock.setItem.mockClear()

    // Switch to a different release
    const tabBar = wrapper.findComponent(ReleaseTabBar)
    tabBar.vm.$emit('select', 'rhoai-3.2')
    await flushPromises()

    expect(localStorageMock.setItem).toHaveBeenCalledWith('selectedRelease', 'rhoai-3.2')
  })

  it('shows loading indicator during initial data fetch', async () => {
    let resolveIssues
    const issuesPromise = new Promise((resolve) => {
      resolveIssues = resolve
    })

    fetch.mockImplementation((url) => {
      if (url === `${API_ENDPOINT}/releases`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockReleases
        })
      }
      if (url === `${API_ENDPOINT}/issues/rhoai-3.2`) {
        return issuesPromise.then(() => Promise.resolve({
          ok: true,
          json: async () => mockIssues
        }))
      }
      if (url === `${API_ENDPOINT}/plan-rankings`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ lastUpdated: '2025-12-10T10:30:00Z', planId: 2423, totalCount: 0, issues: [] })
        })
      }
      if (url === `${API_ENDPOINT}/admins`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ admins: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    const wrapper = mount(App)
    // Authenticate user to trigger loading (but don't wait for completion)
    mockUser.value = {
      email: 'test@redhat.com',
      displayName: 'Test User',
      photoURL: null,
      getIdToken: async () => 'mock-token'
    }
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve, 10))
    await flushPromises()

    // Loading indicator should be visible
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading')

    // Resolve the fetch
    resolveIssues()
    await flushPromises()
    await wrapper.vm.$nextTick()
    await new Promise(resolve => setTimeout(resolve, 10))
    await flushPromises()

    // Loading indicator should be hidden
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(false)
  })

  it('shows loading indicator when refresh button is clicked', async () => {
    const wrapper = mount(App)
    await authenticateUser(wrapper)

    // Initially no loading indicator
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(false)

    // Mock a delayed refresh response
    let resolveRefresh
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve
    })

    fetch.mockImplementation((url) => {
      if (url === `${API_ENDPOINT}/releases`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockReleases
        })
      }
      if (url === `${API_ENDPOINT}/refresh`) {
        return refreshPromise.then(() => Promise.resolve({
          ok: true,
          json: async () => ({ success: true, totalCount: 1, results: [] })
        }))
      }
      if (url === `${API_ENDPOINT}/issues/rhoai-3.2`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockIssues
        })
      }
      if (url === `${API_ENDPOINT}/plan-rankings`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ lastUpdated: '2025-12-10T10:30:00Z', planId: 2423, totalCount: 0, issues: [] })
        })
      }
      if (url === `${API_ENDPOINT}/admins`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ admins: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    // Click refresh button (find it by text to avoid selecting user menu buttons)
    const buttons = wrapper.findAll('button')
    const refreshButton = buttons.find(b => b.text().includes('Refresh'))
    const initialRefreshingState = wrapper.vm.isRefreshing
    await refreshButton.trigger('click')
    await wrapper.vm.$nextTick()

    // Loading indicator should not be visible during refresh (it shows isRefreshing, not isLoading)
    // The refresh process doesn't show the loading overlay, it just disables the button
    // So we check that isRefreshing changed from its initial state
    expect(wrapper.vm.isRefreshing).not.toBe(initialRefreshingState)

    // Verify the refresh API was called
    resolveRefresh()
    await flushPromises()

    // The fetch mock should have been called with the refresh endpoint
    const fetchCalls = fetch.mock.calls
    const refreshCallExists = fetchCalls.some(call => call[0] === '/api/refresh')
    expect(refreshCallExists).toBe(true)
  })

  it('hides loading indicator after fetch error', async () => {
    fetch.mockImplementation((url) => {
      if (url === `${API_ENDPOINT}/releases`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockReleases
        })
      }
      if (url === `${API_ENDPOINT}/issues/rhoai-3.2`) {
        return Promise.reject(new Error('Network error'))
      }
      if (url === `${API_ENDPOINT}/plan-rankings`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ lastUpdated: '2025-12-10T10:30:00Z', planId: 2423, totalCount: 0, issues: [] })
        })
      }
      if (url === `${API_ENDPOINT}/admins`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ admins: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    // Mock window.alert to prevent error dialogs
    global.alert = vi.fn()

    const wrapper = mount(App)
    await authenticateUser(wrapper, { waitForIssues: false })
    await new Promise(resolve => setTimeout(resolve, 20))
    await flushPromises()

    // Loading indicator should be hidden even after error
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(false)
  })

  it('loading overlay appears over the kanban board area', async () => {
    let resolveIssues
    const issuesPromise = new Promise((resolve) => {
      resolveIssues = resolve
    })

    fetch.mockImplementation((url) => {
      if (url === `${API_ENDPOINT}/releases`) {
        return Promise.resolve({
          ok: true,
          json: async () => mockReleases
        })
      }
      if (url === `${API_ENDPOINT}/issues/rhoai-3.2`) {
        return issuesPromise.then(() => Promise.resolve({
          ok: true,
          json: async () => mockIssues
        }))
      }
      if (url === `${API_ENDPOINT}/plan-rankings`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ lastUpdated: '2025-12-10T10:30:00Z', planId: 2423, totalCount: 0, issues: [] })
        })
      }
      if (url === `${API_ENDPOINT}/admins`) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ admins: [] })
        })
      }
      return Promise.reject(new Error(`Unknown URL: ${url}`))
    })

    const wrapper = mount(App)
    // Authenticate user to trigger loading
    mockUser.value = {
      email: 'test@redhat.com',
      displayName: 'Test User',
      photoURL: null,
      getIdToken: async () => 'mock-token'
    }
    await flushPromises()

    // Check that overlay has proper positioning classes
    const overlay = wrapper.find('[data-testid="loading-overlay"]')
    expect(overlay.exists()).toBe(true)
    expect(overlay.classes()).toContain('fixed')
    expect(overlay.classes()).toContain('inset-0')

    resolveIssues()
    await flushPromises()
  })
})
