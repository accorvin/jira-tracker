/**
 * Tests for PriorityView.vue component - following TDD practices.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PriorityView from '../components/PriorityView.vue'
import PriorityFilterSelector from '../components/PriorityFilterSelector.vue'
import PriorityFilterEditor from '../components/PriorityFilterEditor.vue'
import PriorityAlerts from '../components/PriorityAlerts.vue'
import PriorityTable from '../components/PriorityTable.vue'

// Mock the API module
vi.mock('../services/api', () => ({
  getPlanRankings: vi.fn()
}))

import { getPlanRankings } from '../services/api'

describe('PriorityView', () => {
  const mockIssues = [
    { key: 'A-1', summary: 'Feature 1', team: 'Team A', components: ['UI'], status: 'In Progress', rank: 1, colorStatus: 'Green', targetRelease: ['rhoai-3.2'] },
    { key: 'A-2', summary: 'Feature 2', team: 'Team B', components: ['Backend'], status: 'New', rank: 2, colorStatus: null, targetRelease: ['rhoai-3.2'] },
    { key: 'A-3', summary: 'Feature 3', team: 'Team A', components: ['API'], status: 'Resolved', rank: 3, colorStatus: 'Green', targetRelease: ['rhoai-3.2'] },
    { key: 'A-4', summary: 'Feature 4', team: 'Team B', components: ['UI'], status: 'In Progress', rank: 150, colorStatus: 'Yellow', targetRelease: ['rhoai-3.2'] }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getPlanRankings.mockResolvedValue({
      lastUpdated: '2026-02-11T12:00:00Z',
      planId: 2423,
      totalCount: 4,
      issues: mockIssues
    })
  })

  it('renders PriorityFilterSelector component', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()
    expect(wrapper.findComponent(PriorityFilterSelector).exists()).toBe(true)
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

  it('filters issues by saved filter teams', async () => {
    // Set up a saved filter for Team A
    localStorage.setItem('priorityFilters', JSON.stringify([
      { id: 'f1', name: 'Team A Only', teams: ['Team A'], components: [] }
    ]))
    localStorage.setItem('priorityFilters-active', 'f1')

    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const table = wrapper.findComponent(PriorityTable)
    const tableIssues = table.props('issues')
    expect(tableIssues.every(i => i.team === 'Team A')).toBe(true)
  })

  it('filters issues by saved filter components', async () => {
    localStorage.setItem('priorityFilters', JSON.stringify([
      { id: 'f1', name: 'UI Components', teams: [], components: ['UI'] }
    ]))
    localStorage.setItem('priorityFilters-active', 'f1')

    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const table = wrapper.findComponent(PriorityTable)
    const tableIssues = table.props('issues')
    expect(tableIssues.every(i => i.components.includes('UI'))).toBe(true)
  })

  it('uses union logic for filter matching (team OR component)', async () => {
    localStorage.setItem('priorityFilters', JSON.stringify([
      { id: 'f1', name: 'Mixed', teams: ['Team A'], components: ['Backend'] }
    ]))
    localStorage.setItem('priorityFilters-active', 'f1')

    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const table = wrapper.findComponent(PriorityTable)
    const tableIssues = table.props('issues')
    // A-1 matches Team A, A-2 matches Backend component, A-4 matches neither
    expect(tableIssues).toHaveLength(2)
    expect(tableIssues.map(i => i.key).sort()).toEqual(['A-1', 'A-2'])
  })

  it('uses intersection logic when matchMode is "all" (team AND component)', async () => {
    localStorage.setItem('priorityFilters', JSON.stringify([
      { id: 'f1', name: 'Strict', teams: ['Team A'], components: ['Backend'], matchMode: 'all' }
    ]))
    localStorage.setItem('priorityFilters-active', 'f1')

    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const table = wrapper.findComponent(PriorityTable)
    const tableIssues = table.props('issues')
    // No non-done issue matches both Team A AND Backend component
    // A-1 is Team A + UI (no Backend match), A-2 is Team B + Backend (no Team A match)
    expect(tableIssues).toHaveLength(0)
  })

  it('uses intersection logic with matchMode "all" showing matching issues', async () => {
    // Use issues where one matches both team AND component
    getPlanRankings.mockResolvedValue({
      lastUpdated: '2026-02-11T12:00:00Z',
      planId: 2423,
      totalCount: 3,
      issues: [
        { key: 'A-1', summary: 'Feature 1', team: 'Team A', components: ['UI', 'Backend'], status: 'In Progress', rank: 1, colorStatus: 'Green', targetRelease: ['rhoai-3.2'] },
        { key: 'A-2', summary: 'Feature 2', team: 'Team B', components: ['Backend'], status: 'New', rank: 2, colorStatus: null, targetRelease: ['rhoai-3.2'] },
        { key: 'A-5', summary: 'Feature 5', team: 'Team A', components: ['Backend'], status: 'New', rank: 3, colorStatus: null, targetRelease: ['rhoai-3.2'] }
      ]
    })

    localStorage.setItem('priorityFilters', JSON.stringify([
      { id: 'f1', name: 'Strict', teams: ['Team A'], components: ['Backend'], matchMode: 'all' }
    ]))
    localStorage.setItem('priorityFilters-active', 'f1')

    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const table = wrapper.findComponent(PriorityTable)
    const tableIssues = table.props('issues')
    // A-1 matches Team A + has Backend component, A-5 matches Team A + has Backend
    expect(tableIssues).toHaveLength(2)
    expect(tableIssues.map(i => i.key).sort()).toEqual(['A-1', 'A-5'])
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
    // Team B has A-4 in progress at rank 150 while A-2 is idle at rank 2
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

  it('does not show filter editor by default', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    expect(wrapper.findComponent(PriorityFilterEditor).exists()).toBe(false)
  })

  it('shows filter editor when create-filter is emitted', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const selector = wrapper.findComponent(PriorityFilterSelector)
    await selector.vm.$emit('create-filter')

    expect(wrapper.findComponent(PriorityFilterEditor).exists()).toBe(true)
  })

  it('shows filter editor with filter data when edit-filter is emitted', async () => {
    localStorage.setItem('priorityFilters', JSON.stringify([
      { id: 'f1', name: 'My Filter', teams: ['Team A'], components: ['UI'] }
    ]))

    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const selector = wrapper.findComponent(PriorityFilterSelector)
    await selector.vm.$emit('edit-filter', 'f1')

    const editor = wrapper.findComponent(PriorityFilterEditor)
    expect(editor.exists()).toBe(true)
    expect(editor.props('filter')).toEqual({ id: 'f1', name: 'My Filter', teams: ['Team A'], components: ['UI'] })
  })

  it('hides filter editor when cancel is emitted', async () => {
    const wrapper = mount(PriorityView, {
      props: { isRefreshing: false }
    })
    await flushPromises()

    const selector = wrapper.findComponent(PriorityFilterSelector)
    await selector.vm.$emit('create-filter')
    expect(wrapper.findComponent(PriorityFilterEditor).exists()).toBe(true)

    const editor = wrapper.findComponent(PriorityFilterEditor)
    await editor.vm.$emit('cancel')
    expect(wrapper.findComponent(PriorityFilterEditor).exists()).toBe(false)
  })
})
