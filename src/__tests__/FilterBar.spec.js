/**
 * Tests for FilterBar.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

  describe('Filter Persistence', () => {
    const localStorageKey = 'kanban-filters'

    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear()
      // Mock localStorage
      vi.spyOn(Storage.prototype, 'getItem')
      vi.spyOn(Storage.prototype, 'setItem')
      vi.spyOn(Storage.prototype, 'removeItem')
    })

    afterEach(() => {
      localStorage.clear()
      vi.restoreAllMocks()
    })

    it('loads filters from localStorage on mount', () => {
      const savedFilters = {
        assignee: 'John Doe',
        status: 'In Progress',
        team: 'Fine Tuning',
        issueType: 'Feature'
      }
      localStorage.setItem(localStorageKey, JSON.stringify(savedFilters))

      const wrapper = mount(FilterBar, {
        props: { issues: mockIssues }
      })

      expect(wrapper.vm.filters.assignee).toBe('John Doe')
      expect(wrapper.vm.filters.status).toBe('In Progress')
      expect(wrapper.vm.filters.team).toBe('Fine Tuning')
      expect(wrapper.vm.filters.issueType).toBe('Feature')
    })

    it('saves filters to localStorage when changed', async () => {
      const wrapper = mount(FilterBar, {
        props: { issues: mockIssues }
      })

      const selects = wrapper.findAll('select')
      await selects[0].setValue('John Doe')

      expect(localStorage.setItem).toHaveBeenCalled()
      const savedData = JSON.parse(localStorage.getItem(localStorageKey))
      expect(savedData.assignee).toBe('John Doe')
    })

    it('persists all filter changes to localStorage', async () => {
      const wrapper = mount(FilterBar, {
        props: { issues: mockIssues }
      })

      const selects = wrapper.findAll('select')
      await selects[0].setValue('Jane Smith')
      await selects[1].setValue('New')
      await selects[2].setValue('KubeRay')
      await selects[3].setValue('Initiative')

      const savedData = JSON.parse(localStorage.getItem(localStorageKey))
      expect(savedData.assignee).toBe('Jane Smith')
      expect(savedData.status).toBe('New')
      expect(savedData.team).toBe('KubeRay')
      expect(savedData.issueType).toBe('Initiative')
    })

    it('removes filters from localStorage when cleared', async () => {
      const savedFilters = {
        assignee: 'John Doe',
        status: 'In Progress',
        team: 'Fine Tuning',
        issueType: 'Feature'
      }
      localStorage.setItem(localStorageKey, JSON.stringify(savedFilters))

      const wrapper = mount(FilterBar, {
        props: { issues: mockIssues }
      })

      const clearButton = wrapper.find('button')
      await clearButton.trigger('click')

      expect(localStorage.removeItem).toHaveBeenCalledWith(localStorageKey)
    })

    it('handles missing localStorage data gracefully', () => {
      const wrapper = mount(FilterBar, {
        props: { issues: mockIssues }
      })

      expect(wrapper.vm.filters.assignee).toBe('')
      expect(wrapper.vm.filters.status).toBe('')
      expect(wrapper.vm.filters.team).toBe('')
      expect(wrapper.vm.filters.issueType).toBe('')
    })

    it('handles corrupted localStorage data gracefully', () => {
      localStorage.setItem(localStorageKey, 'invalid json')

      const wrapper = mount(FilterBar, {
        props: { issues: mockIssues }
      })

      expect(wrapper.vm.filters.assignee).toBe('')
      expect(wrapper.vm.filters.status).toBe('')
      expect(wrapper.vm.filters.team).toBe('')
      expect(wrapper.vm.filters.issueType).toBe('')
    })
  })
})
