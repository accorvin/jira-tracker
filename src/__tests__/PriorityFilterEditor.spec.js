/**
 * Tests for PriorityFilterEditor.vue component - following TDD practices.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PriorityFilterEditor from '../components/PriorityFilterEditor.vue'

describe('PriorityFilterEditor', () => {
  const mockIssues = [
    { key: 'A-1', team: 'Team Alpha', components: ['UI', 'API'] },
    { key: 'A-2', team: 'Team Beta', components: ['Backend'] },
    { key: 'A-3', team: 'Team Alpha', components: ['Backend', 'API'] },
    { key: 'A-4', team: 'Team Gamma', components: [] }
  ]

  function mountComponent(props = {}) {
    return mount(PriorityFilterEditor, {
      props: {
        issues: mockIssues,
        filter: null,
        ...props
      }
    })
  }

  describe('create mode (filter=null)', () => {
    it('renders a modal with title "New Filter"', () => {
      const wrapper = mountComponent()

      expect(wrapper.text()).toContain('New Filter')
    })

    it('renders an empty name input', () => {
      const wrapper = mountComponent()

      const input = wrapper.find('[data-testid="filter-name-input"]')
      expect(input.exists()).toBe(true)
      expect(input.element.value).toBe('')
    })

    it('renders a Teams checklist section', () => {
      const wrapper = mountComponent()

      expect(wrapper.text()).toContain('Teams')
      expect(wrapper.text()).toContain('Team Alpha')
      expect(wrapper.text()).toContain('Team Beta')
      expect(wrapper.text()).toContain('Team Gamma')
    })

    it('renders a Components checklist section', () => {
      const wrapper = mountComponent()

      expect(wrapper.text()).toContain('Components')
      expect(wrapper.text()).toContain('API')
      expect(wrapper.text()).toContain('Backend')
      expect(wrapper.text()).toContain('UI')
    })

    it('renders team checkboxes all unchecked', () => {
      const wrapper = mountComponent()

      const teamCheckboxes = wrapper.findAll('[data-testid^="team-checkbox-"]')
      expect(teamCheckboxes).toHaveLength(3)
      teamCheckboxes.forEach(cb => {
        expect(cb.element.checked).toBe(false)
      })
    })

    it('renders component checkboxes all unchecked', () => {
      const wrapper = mountComponent()

      const componentCheckboxes = wrapper.findAll('[data-testid^="component-checkbox-"]')
      expect(componentCheckboxes).toHaveLength(3)
      componentCheckboxes.forEach(cb => {
        expect(cb.element.checked).toBe(false)
      })
    })

    it('has a disabled Save button when name is empty', () => {
      const wrapper = mountComponent()

      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.exists()).toBe(true)
      expect(saveButton.element.disabled).toBe(true)
    })

    it('has a disabled Save button when name is set but nothing selected', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="filter-name-input"]').setValue('My Filter')

      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.element.disabled).toBe(true)
    })

    it('enables Save button when name and at least one team is selected', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="filter-name-input"]').setValue('My Filter')
      await wrapper.find('[data-testid="team-checkbox-Team Alpha"]').setValue(true)

      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.element.disabled).toBe(false)
    })

    it('enables Save button when name and at least one component is selected', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="filter-name-input"]').setValue('My Filter')
      await wrapper.find('[data-testid="component-checkbox-UI"]').setValue(true)

      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.element.disabled).toBe(false)
    })

    it('emits save with name, teams, and components when Save is clicked', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="filter-name-input"]').setValue('My Filter')
      await wrapper.find('[data-testid="team-checkbox-Team Beta"]').setValue(true)
      await wrapper.find('[data-testid="component-checkbox-API"]').setValue(true)
      await wrapper.find('[data-testid="save-filter-button"]').trigger('click')

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual([{
        name: 'My Filter',
        teams: ['Team Beta'],
        components: ['API'],
        matchMode: 'any'
      }])
    })

    it('emits cancel when Cancel button is clicked', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="cancel-filter-button"]').trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits cancel when backdrop is clicked', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="filter-editor-backdrop"]').trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('does not emit cancel when modal content is clicked', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="filter-editor-modal"]').trigger('click')

      expect(wrapper.emitted('cancel')).toBeFalsy()
    })
  })

  describe('edit mode (filter provided)', () => {
    const existingFilter = {
      id: 'abc123',
      name: 'My Teams',
      teams: ['Team Alpha', 'Team Gamma'],
      components: ['UI']
    }

    it('renders title "Edit Filter"', () => {
      const wrapper = mountComponent({ filter: existingFilter })

      expect(wrapper.text()).toContain('Edit Filter')
    })

    it('pre-fills the name input', () => {
      const wrapper = mountComponent({ filter: existingFilter })

      const input = wrapper.find('[data-testid="filter-name-input"]')
      expect(input.element.value).toBe('My Teams')
    })

    it('pre-checks teams from the filter', () => {
      const wrapper = mountComponent({ filter: existingFilter })

      expect(wrapper.find('[data-testid="team-checkbox-Team Alpha"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="team-checkbox-Team Beta"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="team-checkbox-Team Gamma"]').element.checked).toBe(true)
    })

    it('pre-checks components from the filter', () => {
      const wrapper = mountComponent({ filter: existingFilter })

      expect(wrapper.find('[data-testid="component-checkbox-UI"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="component-checkbox-API"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="component-checkbox-Backend"]').element.checked).toBe(false)
    })

    it('enables Save button with valid existing data', () => {
      const wrapper = mountComponent({ filter: existingFilter })

      const saveButton = wrapper.find('[data-testid="save-filter-button"]')
      expect(saveButton.element.disabled).toBe(false)
    })

    it('emits save with updated data', async () => {
      const wrapper = mountComponent({ filter: existingFilter })

      await wrapper.find('[data-testid="filter-name-input"]').setValue('Updated Name')
      await wrapper.find('[data-testid="component-checkbox-Backend"]').setValue(true)
      await wrapper.find('[data-testid="save-filter-button"]').trigger('click')

      expect(wrapper.emitted('save')[0]).toEqual([{
        name: 'Updated Name',
        teams: ['Team Alpha', 'Team Gamma'],
        components: ['Backend', 'UI'],
        matchMode: 'any'
      }])
    })
  })

  describe('Select All / Deselect All for Teams', () => {
    it('renders Select All button for teams', () => {
      const wrapper = mountComponent()

      const selectAllButton = wrapper.find('[data-testid="select-all-teams-button"]')
      expect(selectAllButton.exists()).toBe(true)
    })

    it('selects all teams when Select All is clicked', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="select-all-teams-button"]').trigger('click')

      expect(wrapper.find('[data-testid="team-checkbox-Team Alpha"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="team-checkbox-Team Beta"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="team-checkbox-Team Gamma"]').element.checked).toBe(true)
    })

    it('deselects all teams when Deselect All is clicked', async () => {
      const wrapper = mountComponent({
        filter: { id: 'abc', name: 'Test', teams: ['Team Alpha', 'Team Beta', 'Team Gamma'], components: [] }
      })

      await wrapper.find('[data-testid="deselect-all-teams-button"]').trigger('click')

      expect(wrapper.find('[data-testid="team-checkbox-Team Alpha"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="team-checkbox-Team Beta"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="team-checkbox-Team Gamma"]').element.checked).toBe(false)
    })
  })

  describe('Select All / Deselect All for Components', () => {
    it('renders Select All button for components', () => {
      const wrapper = mountComponent()

      const selectAllButton = wrapper.find('[data-testid="select-all-components-button"]')
      expect(selectAllButton.exists()).toBe(true)
    })

    it('selects all components when Select All is clicked', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="select-all-components-button"]').trigger('click')

      expect(wrapper.find('[data-testid="component-checkbox-API"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="component-checkbox-Backend"]').element.checked).toBe(true)
      expect(wrapper.find('[data-testid="component-checkbox-UI"]').element.checked).toBe(true)
    })

    it('deselects all components when Deselect All is clicked', async () => {
      const wrapper = mountComponent({
        filter: { id: 'abc', name: 'Test', teams: [], components: ['API', 'Backend', 'UI'] }
      })

      await wrapper.find('[data-testid="deselect-all-components-button"]').trigger('click')

      expect(wrapper.find('[data-testid="component-checkbox-API"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="component-checkbox-Backend"]').element.checked).toBe(false)
      expect(wrapper.find('[data-testid="component-checkbox-UI"]').element.checked).toBe(false)
    })
  })

  describe('match mode toggle', () => {
    it('renders Match Any and Match All buttons', () => {
      const wrapper = mountComponent()

      const matchAny = wrapper.find('[data-testid="match-any-button"]')
      const matchAll = wrapper.find('[data-testid="match-all-button"]')
      expect(matchAny.exists()).toBe(true)
      expect(matchAll.exists()).toBe(true)
      expect(matchAny.text()).toBe('Selected teams OR components')
      expect(matchAll.text()).toBe('Selected teams AND components')
    })

    it('defaults to Match Any mode', () => {
      const wrapper = mountComponent()

      const matchAny = wrapper.find('[data-testid="match-any-button"]')
      const matchAll = wrapper.find('[data-testid="match-all-button"]')
      expect(matchAny.classes()).toContain('bg-primary-600')
      expect(matchAll.classes()).not.toContain('bg-primary-600')
    })

    it('switches to Match All when clicked', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="match-all-button"]').trigger('click')

      const matchAny = wrapper.find('[data-testid="match-any-button"]')
      const matchAll = wrapper.find('[data-testid="match-all-button"]')
      expect(matchAll.classes()).toContain('bg-primary-600')
      expect(matchAny.classes()).not.toContain('bg-primary-600')
    })

    it('includes matchMode in save payload with default value', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="filter-name-input"]').setValue('Test')
      await wrapper.find('[data-testid="team-checkbox-Team Alpha"]').setValue(true)
      await wrapper.find('[data-testid="save-filter-button"]').trigger('click')

      expect(wrapper.emitted('save')[0][0].matchMode).toBe('any')
    })

    it('includes matchMode "all" in save payload when toggled', async () => {
      const wrapper = mountComponent()

      await wrapper.find('[data-testid="filter-name-input"]').setValue('Test')
      await wrapper.find('[data-testid="team-checkbox-Team Alpha"]').setValue(true)
      await wrapper.find('[data-testid="match-all-button"]').trigger('click')
      await wrapper.find('[data-testid="save-filter-button"]').trigger('click')

      expect(wrapper.emitted('save')[0][0].matchMode).toBe('all')
    })

    it('pre-fills matchMode from existing filter in edit mode', () => {
      const wrapper = mountComponent({
        filter: { id: 'abc', name: 'Test', teams: ['Team Alpha'], components: ['UI'], matchMode: 'all' }
      })

      const matchAll = wrapper.find('[data-testid="match-all-button"]')
      expect(matchAll.classes()).toContain('bg-primary-600')
    })

    it('defaults to "any" when editing a legacy filter without matchMode', () => {
      const wrapper = mountComponent({
        filter: { id: 'abc', name: 'Test', teams: ['Team Alpha'], components: ['UI'] }
      })

      const matchAny = wrapper.find('[data-testid="match-any-button"]')
      expect(matchAny.classes()).toContain('bg-primary-600')
    })
  })

  describe('extracts options from issues', () => {
    it('extracts unique sorted teams from issues', () => {
      const wrapper = mountComponent()

      const teamLabels = wrapper.findAll('[data-testid^="team-label-"]')
      expect(teamLabels).toHaveLength(3)
      expect(teamLabels[0].text()).toContain('Team Alpha')
      expect(teamLabels[1].text()).toContain('Team Beta')
      expect(teamLabels[2].text()).toContain('Team Gamma')
    })

    it('extracts unique sorted components from issues', () => {
      const wrapper = mountComponent()

      const componentLabels = wrapper.findAll('[data-testid^="component-label-"]')
      expect(componentLabels).toHaveLength(3)
      expect(componentLabels[0].text()).toContain('API')
      expect(componentLabels[1].text()).toContain('Backend')
      expect(componentLabels[2].text()).toContain('UI')
    })

    it('handles issues with no team', () => {
      const issues = [
        { key: 'A-1', team: null, components: ['UI'] },
        { key: 'A-2', team: 'Team A', components: [] }
      ]
      const wrapper = mountComponent({ issues })

      const teamLabels = wrapper.findAll('[data-testid^="team-label-"]')
      expect(teamLabels).toHaveLength(1)
      expect(teamLabels[0].text()).toContain('Team A')
    })
  })
})
