/**
 * Tests for PriorityFilterBar.vue component - following TDD practices.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PriorityFilterBar from '../components/PriorityFilterBar.vue'

describe('PriorityFilterBar', () => {
  const mockIssues = [
    { key: 'A-1', team: 'Team Alpha', components: ['UI', 'API'], targetRelease: ['rhoai-3.4'], labels: ['3.4-committed'] },
    { key: 'A-2', team: 'Team Beta', components: ['Backend'], targetRelease: ['rhoai-3.3'], labels: [] },
    { key: 'A-3', team: 'Team Alpha', components: ['Backend', 'API'], targetRelease: ['rhoai-3.4'], labels: ['3.4-committed', 'important'] },
    { key: 'A-4', team: 'Team Gamma', components: [], targetRelease: null, labels: [] }
  ]

  function mountComponent(props = {}) {
    return mount(PriorityFilterBar, {
      props: {
        issues: mockIssues,
        filteredCount: 4,
        presets: [],
        initialFilterState: null,
        ...props
      }
    })
  }

  beforeEach(() => {
    localStorage.clear()
  })

  describe('rendering', () => {
    it('renders the filter bar container', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="priority-filter-bar"]').exists()).toBe(true)
    })

    it('renders Target Release dropdown', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="filter-target-release"]').exists()).toBe(true)
    })

    it('renders Team dropdown', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="filter-team"]').exists()).toBe(true)
    })

    it('renders Component dropdown', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="filter-component"]').exists()).toBe(true)
    })

    it('renders Labels input', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="filter-labels-input"]').exists()).toBe(true)
    })

    it('renders AND/OR toggle', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="match-any-button"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="match-all-button"]').exists()).toBe(true)
    })

    it('renders Clear button', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="clear-filters-button"]').exists()).toBe(true)
    })

    it('renders filtered count', () => {
      const wrapper = mountComponent({ filteredCount: 2 })
      expect(wrapper.text()).toContain('Showing 2 of 4')
    })
  })

  describe('dynamic options', () => {
    it('derives unique sorted target releases from issues', () => {
      const wrapper = mountComponent()
      const options = wrapper.vm.targetReleaseOptions

      expect(options).toEqual(['rhoai-3.3', 'rhoai-3.4'])
    })

    it('derives unique sorted teams from issues', () => {
      const wrapper = mountComponent()
      const options = wrapper.vm.teamOptions

      expect(options).toEqual(['Team Alpha', 'Team Beta', 'Team Gamma'])
    })

    it('derives unique sorted components from issues', () => {
      const wrapper = mountComponent()
      const options = wrapper.vm.componentOptions

      expect(options).toEqual(['API', 'Backend', 'UI'])
    })

    it('handles issues with null targetRelease', () => {
      const wrapper = mountComponent()
      const options = wrapper.vm.targetReleaseOptions
      // A-4 has null targetRelease, should not contribute
      expect(options).not.toContain(null)
    })
  })

  describe('filter-change emission', () => {
    it('emits filter-change on mount with empty state when no initial state', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('filter-change')).toBeTruthy()
      const emitted = wrapper.emitted('filter-change')[0][0]
      expect(emitted.teams).toEqual([])
      expect(emitted.components).toEqual([])
      expect(emitted.targetReleases).toEqual([])
      expect(emitted.labels).toEqual([])
      expect(emitted.matchMode).toBe('any')
    })

    it('emits filter-change on mount with initial state from URL', async () => {
      const initialState = {
        teams: ['Team Alpha'],
        components: [],
        targetReleases: ['rhoai-3.4'],
        labels: [],
        matchMode: 'all'
      }
      const wrapper = mountComponent({ initialFilterState: initialState })
      await wrapper.vm.$nextTick()

      const emitted = wrapper.emitted('filter-change')[0][0]
      expect(emitted.teams).toEqual(['Team Alpha'])
      expect(emitted.targetReleases).toEqual(['rhoai-3.4'])
      expect(emitted.matchMode).toBe('all')
    })
  })

  describe('AND/OR toggle', () => {
    it('defaults to ANY mode', () => {
      const wrapper = mountComponent()
      const anyBtn = wrapper.find('[data-testid="match-any-button"]')
      expect(anyBtn.classes()).toContain('bg-primary-600')
    })

    it('switches to ALL mode when clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.find('[data-testid="match-all-button"]').trigger('click')

      const allBtn = wrapper.find('[data-testid="match-all-button"]')
      expect(allBtn.classes()).toContain('bg-primary-600')
    })

    it('emits filter-change when toggled', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const initialEmitCount = wrapper.emitted('filter-change').length

      await wrapper.find('[data-testid="match-all-button"]').trigger('click')

      const newEmit = wrapper.emitted('filter-change')[initialEmitCount][0]
      expect(newEmit.matchMode).toBe('all')
    })
  })

  describe('Clear button', () => {
    it('resets all filters and emits filter-change', async () => {
      const initialState = {
        teams: ['Team Alpha'],
        components: ['UI'],
        targetReleases: ['rhoai-3.4'],
        labels: ['3.4-committed'],
        matchMode: 'all'
      }
      const wrapper = mountComponent({ initialFilterState: initialState })
      await wrapper.vm.$nextTick()
      const initialEmitCount = wrapper.emitted('filter-change').length

      await wrapper.find('[data-testid="clear-filters-button"]').trigger('click')

      const emitted = wrapper.emitted('filter-change')[initialEmitCount][0]
      expect(emitted.teams).toEqual([])
      expect(emitted.components).toEqual([])
      expect(emitted.targetReleases).toEqual([])
      expect(emitted.labels).toEqual([])
      expect(emitted.matchMode).toBe('any')
    })
  })

  describe('labels input', () => {
    it('adds a label chip when Enter is pressed', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const input = wrapper.find('[data-testid="filter-labels-input"]')
      await input.setValue('3.4-committed')
      await input.trigger('keydown.enter')

      expect(wrapper.findAll('[data-testid^="label-chip-"]')).toHaveLength(1)
      expect(wrapper.find('[data-testid="label-chip-3.4-committed"]').exists()).toBe(true)
    })

    it('clears the input after adding a label', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const input = wrapper.find('[data-testid="filter-labels-input"]')
      await input.setValue('3.4-committed')
      await input.trigger('keydown.enter')

      expect(input.element.value).toBe('')
    })

    it('does not add empty labels', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const input = wrapper.find('[data-testid="filter-labels-input"]')
      await input.setValue('   ')
      await input.trigger('keydown.enter')

      expect(wrapper.findAll('[data-testid^="label-chip-"]')).toHaveLength(0)
    })

    it('does not add duplicate labels', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const input = wrapper.find('[data-testid="filter-labels-input"]')
      await input.setValue('3.4-committed')
      await input.trigger('keydown.enter')
      await input.setValue('3.4-committed')
      await input.trigger('keydown.enter')

      expect(wrapper.findAll('[data-testid^="label-chip-"]')).toHaveLength(1)
    })

    it('removes a label chip when X is clicked', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      const input = wrapper.find('[data-testid="filter-labels-input"]')
      await input.setValue('3.4-committed')
      await input.trigger('keydown.enter')

      await wrapper.find('[data-testid="remove-label-3.4-committed"]').trigger('click')

      expect(wrapper.findAll('[data-testid^="label-chip-"]')).toHaveLength(0)
    })

    it('emits filter-change when a label is added', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const initialEmitCount = wrapper.emitted('filter-change').length

      const input = wrapper.find('[data-testid="filter-labels-input"]')
      await input.setValue('3.4-committed')
      await input.trigger('keydown.enter')

      const emitted = wrapper.emitted('filter-change')[initialEmitCount][0]
      expect(emitted.labels).toEqual(['3.4-committed'])
    })

    it('renders initial labels from initialFilterState', async () => {
      const initialState = {
        teams: [],
        components: [],
        targetReleases: [],
        labels: ['3.4-committed', 'important'],
        matchMode: 'any'
      }
      const wrapper = mountComponent({ initialFilterState: initialState })
      await wrapper.vm.$nextTick()

      expect(wrapper.findAll('[data-testid^="label-chip-"]')).toHaveLength(2)
    })
  })

  describe('preset management', () => {
    it('renders preset selector', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="preset-selector"]').exists()).toBe(true)
    })

    it('shows presets in the selector', () => {
      const presets = [
        { id: 'p1', name: 'My Preset', teams: ['Team Alpha'], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      ]
      const wrapper = mountComponent({ presets })
      expect(wrapper.text()).toContain('My Preset')
    })

    it('emits save-preset when save button is clicked with name', async () => {
      const wrapper = mountComponent()
      await wrapper.vm.$nextTick()

      // Set a filter value first
      await wrapper.find('[data-testid="match-all-button"]').trigger('click')

      const nameInput = wrapper.find('[data-testid="preset-name-input"]')
      await nameInput.setValue('My Preset')
      await wrapper.find('[data-testid="save-preset-button"]').trigger('click')

      expect(wrapper.emitted('save-preset')).toBeTruthy()
      expect(wrapper.emitted('save-preset')[0][0].name).toBe('My Preset')
    })

    it('emits delete-preset when delete is clicked', async () => {
      const presets = [
        { id: 'p1', name: 'My Preset', teams: ['Team Alpha'], components: [], targetReleases: [], labels: [], matchMode: 'any' }
      ]
      const wrapper = mountComponent({ presets })

      await wrapper.find('[data-testid="delete-preset-p1"]').trigger('click')

      expect(wrapper.emitted('delete-preset')).toBeTruthy()
      expect(wrapper.emitted('delete-preset')[0][0]).toBe('p1')
    })

    it('loads preset values when a preset is selected', async () => {
      const presets = [
        { id: 'p1', name: 'My Preset', teams: ['Team Alpha'], components: ['UI'], targetReleases: ['rhoai-3.4'], labels: ['3.4-committed'], matchMode: 'all' }
      ]
      const wrapper = mountComponent({ presets })
      await wrapper.vm.$nextTick()
      const initialEmitCount = wrapper.emitted('filter-change').length

      await wrapper.find('[data-testid="select-preset-p1"]').trigger('click')

      const emitted = wrapper.emitted('filter-change')[initialEmitCount][0]
      expect(emitted.teams).toEqual(['Team Alpha'])
      expect(emitted.components).toEqual(['UI'])
      expect(emitted.targetReleases).toEqual(['rhoai-3.4'])
      expect(emitted.labels).toEqual(['3.4-committed'])
      expect(emitted.matchMode).toBe('all')
    })
  })
})
