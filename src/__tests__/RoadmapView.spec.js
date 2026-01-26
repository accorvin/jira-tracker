/**
 * Tests for RoadmapView.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RoadmapView from '../components/RoadmapView.vue'
import RoadmapFilterBar from '../components/RoadmapFilterBar.vue'
import RoadmapBoard from '../components/RoadmapBoard.vue'

// Mock the API module
vi.mock('../services/api', () => ({
  getAllIssues: vi.fn()
}))

import { getAllIssues } from '../services/api'

describe('RoadmapView', () => {
  const mockReleases = [
    { name: 'rhoai-3.1' },
    { name: 'rhoai-3.2' }
  ]

  const mockIssues = [
    { key: 'ISSUE-1', summary: 'Feature 1', team: 'Team A', components: ['UI'], targetRelease: ['rhoai-3.1'] },
    { key: 'ISSUE-2', summary: 'Feature 2', team: 'Team B', components: ['Backend'], targetRelease: ['rhoai-3.2'] },
    { key: 'ISSUE-3', summary: 'Feature 3', team: 'Team A', components: ['API'], targetRelease: ['rhoai-3.2'] },
    { key: 'ISSUE-4', summary: 'Feature 4', team: 'Team A', components: ['UI'], targetRelease: [] }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getAllIssues.mockResolvedValue({ issues: mockIssues, releaseNames: ['rhoai-3.1', 'rhoai-3.2'] })
  })

  it('renders RoadmapFilterBar component', async () => {
    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    expect(wrapper.findComponent(RoadmapFilterBar).exists()).toBe(true)
  })

  it('renders RoadmapBoard component', async () => {
    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    expect(wrapper.findComponent(RoadmapBoard).exists()).toBe(true)
  })

  it('loads issues on mount', async () => {
    mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    expect(getAllIssues).toHaveBeenCalledWith(mockReleases)
  })

  it('filters issues by team when team filter is selected', async () => {
    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    // Simulate filter change
    const filterBar = wrapper.findComponent(RoadmapFilterBar)
    await filterBar.vm.$emit('filter-change', { mode: 'team', value: 'Team A' })

    const board = wrapper.findComponent(RoadmapBoard)
    const filteredIssues = board.props('issues')

    // Should only have Team A issues (ISSUE-1, ISSUE-3, ISSUE-4)
    expect(filteredIssues.length).toBe(3)
    expect(filteredIssues.every(i => i.team === 'Team A')).toBe(true)
  })

  it('filters issues by component when component filter is selected', async () => {
    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    // Simulate filter change
    const filterBar = wrapper.findComponent(RoadmapFilterBar)
    await filterBar.vm.$emit('filter-change', { mode: 'component', value: 'UI' })

    const board = wrapper.findComponent(RoadmapBoard)
    const filteredIssues = board.props('issues')

    // Should only have UI component issues (ISSUE-1, ISSUE-4)
    expect(filteredIssues.length).toBe(2)
    expect(filteredIssues.every(i => i.components.includes('UI'))).toBe(true)
  })

  it('shows all issues when filter value is empty', async () => {
    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    // Simulate filter change to "All"
    const filterBar = wrapper.findComponent(RoadmapFilterBar)
    await filterBar.vm.$emit('filter-change', { mode: 'team', value: '' })

    const board = wrapper.findComponent(RoadmapBoard)
    const filteredIssues = board.props('issues')

    expect(filteredIssues.length).toBe(4)
  })

  it('shows loading overlay while fetching data', async () => {
    // Make API call take time (never resolve)
    getAllIssues.mockImplementation(() => new Promise(() => {}))

    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    // Wait for mounted hook to start the async operation
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(true)
  })

  it('hides loading overlay after data is loaded', async () => {
    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(false)
  })

  it('reloads data when isRefreshing changes from true to false', async () => {
    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()
    expect(getAllIssues).toHaveBeenCalledTimes(1)

    // Simulate refresh starting and completing
    await wrapper.setProps({ isRefreshing: true })
    await wrapper.setProps({ isRefreshing: false })
    await flushPromises()

    expect(getAllIssues).toHaveBeenCalledTimes(2)
  })

  it('shows empty state when no issues are loaded', async () => {
    getAllIssues.mockResolvedValue({ issues: [], releaseNames: [] })

    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    // The board should still render with just the Backlog column
    const board = wrapper.findComponent(RoadmapBoard)
    expect(board.exists()).toBe(true)
  })

  it('passes all issues to FilterBar for option extraction', async () => {
    const wrapper = mount(RoadmapView, {
      props: { releases: mockReleases, isRefreshing: false }
    })

    await flushPromises()

    const filterBar = wrapper.findComponent(RoadmapFilterBar)
    expect(filterBar.props('issues')).toHaveLength(4)
  })
})
