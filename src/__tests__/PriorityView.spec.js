/**
 * Tests for PriorityView.vue component - following TDD practices.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PriorityView from '../components/PriorityView.vue'
import PriorityFilterBar from '../components/PriorityFilterBar.vue'
import PriorityAlerts from '../components/PriorityAlerts.vue'
import PriorityTable from '../components/PriorityTable.vue'

// Mock the API module
vi.mock('../services/api', () => ({
  getPlanRankings: vi.fn()
}))

import { getPlanRankings } from '../services/api'

describe('PriorityView', () => {
  const mockIssues = [
    { key: 'A-1', summary: 'Feature 1', team: 'Team A', components: ['UI'], status: 'In Progress', rank: 1, colorStatus: 'Green', targetRelease: ['rhoai-3.2'], labels: [] },
    { key: 'A-2', summary: 'Feature 2', team: 'Team B', components: ['Backend'], status: 'New', rank: 2, colorStatus: null, targetRelease: ['rhoai-3.2'], labels: [] },
    { key: 'A-3', summary: 'Feature 3', team: 'Team A', components: ['API'], status: 'Resolved', rank: 3, colorStatus: 'Green', targetRelease: ['rhoai-3.2'], labels: [] },
    { key: 'A-4', summary: 'Feature 4', team: 'Team B', components: ['UI'], status: 'In Progress', rank: 150, colorStatus: 'Yellow', targetRelease: ['rhoai-3.2'], labels: [] }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Reset URL to prevent state leaking between tests
    window.history.replaceState(null, '', window.location.pathname)
    getPlanRankings.mockResolvedValue({
      lastUpdated: '2026-02-11T12:00:00Z',
      planId: 2423,
      totalCount: 4,
      issues: mockIssues
    })
  })

  it('renders PriorityFilterBar component after data loads', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()
    expect(wrapper.findComponent(PriorityFilterBar).exists()).toBe(true)
  })

  it('renders PriorityAlerts component', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()
    expect(wrapper.findComponent(PriorityAlerts).exists()).toBe(true)
  })

  it('renders PriorityTable component', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()
    expect(wrapper.findComponent(PriorityTable).exists()).toBe(true)
  })

  it('loads data via getPlanRankings on mount', async () => {
    mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()
    expect(getPlanRankings).toHaveBeenCalledTimes(1)
  })

  it('reloads data when isRefreshing changes from true to false', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()
    expect(getPlanRankings).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ isRefreshing: true })
    await wrapper.setProps({ isRefreshing: false })
    await flushPromises()
    expect(getPlanRankings).toHaveBeenCalledTimes(2)
  })

  it('shows all non-done issues when no filter is active', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const table = wrapper.findComponent(PriorityTable)
    const tableIssues = table.props('issues')
    // A-3 (Resolved) filtered out at load time, remaining 3 shown
    expect(tableIssues).toHaveLength(3)
  })

  it('filters issues when filter-change is emitted from PriorityFilterBar', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const filterBar = wrapper.findComponent(PriorityFilterBar)
    await filterBar.vm.$emit('filter-change', {
      teams: ['Team A'],
      components: [],
      targetReleases: [],
      labels: [],
      matchMode: 'any'
    })
    await wrapper.vm.$nextTick()

    const table = wrapper.findComponent(PriorityTable)
    const tableIssues = table.props('issues')
    expect(tableIssues.every(i => i.team === 'Team A')).toBe(true)
  })

  it('excludes done issues from loaded data', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const table = wrapper.findComponent(PriorityTable)
    const tableIssues = table.props('issues')
    // A-3 (Resolved) should be filtered out at load time
    expect(tableIssues.length).toBe(3)
    expect(tableIssues.every(i => i.status !== 'Resolved' && i.status !== 'Closed')).toBe(true)
  })

  it('shows loading overlay while fetching data', async () => {
    getPlanRankings.mockImplementation(() => new Promise(() => {}))

    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })

    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="loading-overlay"]').exists()).toBe(true)
  })

  it('passes violations to PriorityAlerts', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const alerts = wrapper.findComponent(PriorityAlerts)
    expect(alerts.props('violations').length).toBeGreaterThan(0)
  })

  it('passes lowPriorityInProgress to PriorityAlerts', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const alerts = wrapper.findComponent(PriorityAlerts)
    // A-4 is in progress at rank 150
    expect(alerts.props('lowPriorityInProgress').length).toBe(1)
    expect(alerts.props('lowPriorityInProgress')[0].key).toBe('A-4')
  })

  it('does not show filter bar before data loads', async () => {
    getPlanRankings.mockImplementation(() => new Promise(() => {}))

    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })

    await wrapper.vm.$nextTick()
    expect(wrapper.findComponent(PriorityFilterBar).exists()).toBe(false)
  })
})
