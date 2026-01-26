/**
 * Tests for RoadmapFilterBar.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RoadmapFilterBar from '../components/RoadmapFilterBar.vue'

describe('RoadmapFilterBar', () => {
  const mockIssues = [
    { key: 'ISSUE-1', team: 'Team A', components: ['UI', 'API'] },
    { key: 'ISSUE-2', team: 'Team B', components: ['Backend'] },
    { key: 'ISSUE-3', team: 'Team A', components: ['UI'] },
    { key: 'ISSUE-4', team: null, components: [] }
  ]

  beforeEach(() => {
    localStorage.clear()
  })

  it('renders filter mode toggle with Team and Component options', () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    const toggle = wrapper.find('[data-testid="filter-mode-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.text()).toContain('Team')
    expect(toggle.text()).toContain('Component')
  })

  it('defaults to Team filter mode', () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    const teamButton = wrapper.find('[data-testid="mode-team"]')
    expect(teamButton.classes()).toContain('bg-primary-500')
  })

  it('switches to Component mode when Component button clicked', async () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    const componentButton = wrapper.find('[data-testid="mode-component"]')
    await componentButton.trigger('click')

    expect(componentButton.classes()).toContain('bg-primary-500')
    const teamButton = wrapper.find('[data-testid="mode-team"]')
    expect(teamButton.classes()).not.toContain('bg-primary-500')
  })

  it('shows team options in dropdown when in Team mode', () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    const select = wrapper.find('[data-testid="filter-select"]')
    const options = select.findAll('option')

    // Should have "All" + unique teams (Team A, Team B)
    expect(options.length).toBe(3)
    expect(options[0].text()).toBe('All Teams')
    expect(options[1].text()).toBe('Team A')
    expect(options[2].text()).toBe('Team B')
  })

  it('shows component options in dropdown when in Component mode', async () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    const componentButton = wrapper.find('[data-testid="mode-component"]')
    await componentButton.trigger('click')

    const select = wrapper.find('[data-testid="filter-select"]')
    const options = select.findAll('option')

    // Should have "All" + unique components (API, Backend, UI)
    expect(options.length).toBe(4)
    expect(options[0].text()).toBe('All Components')
    expect(options[1].text()).toBe('API')
    expect(options[2].text()).toBe('Backend')
    expect(options[3].text()).toBe('UI')
  })

  it('emits filter-change with team when team is selected', async () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    const select = wrapper.find('[data-testid="filter-select"]')
    await select.setValue('Team A')

    expect(wrapper.emitted('filter-change')).toBeTruthy()
    const emittedValue = wrapper.emitted('filter-change')[wrapper.emitted('filter-change').length - 1][0]
    expect(emittedValue).toEqual({
      mode: 'team',
      value: 'Team A'
    })
  })

  it('emits filter-change with component when component is selected', async () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    // Switch to component mode
    const componentButton = wrapper.find('[data-testid="mode-component"]')
    await componentButton.trigger('click')

    const select = wrapper.find('[data-testid="filter-select"]')
    await select.setValue('UI')

    expect(wrapper.emitted('filter-change')).toBeTruthy()
    const emittedValue = wrapper.emitted('filter-change')[wrapper.emitted('filter-change').length - 1][0]
    expect(emittedValue).toEqual({
      mode: 'component',
      value: 'UI'
    })
  })

  it('emits filter-change with empty value when "All" is selected', async () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    // First select a team
    const select = wrapper.find('[data-testid="filter-select"]')
    await select.setValue('Team A')

    // Then select "All"
    await select.setValue('')

    const emittedValue = wrapper.emitted('filter-change')[wrapper.emitted('filter-change').length - 1][0]
    expect(emittedValue).toEqual({
      mode: 'team',
      value: ''
    })
  })

  it('clears selection when mode is switched', async () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    // Select a team
    const select = wrapper.find('[data-testid="filter-select"]')
    await select.setValue('Team A')

    // Switch to component mode
    const componentButton = wrapper.find('[data-testid="mode-component"]')
    await componentButton.trigger('click')

    // Selection should be cleared
    expect(select.element.value).toBe('')
  })

  it('handles empty issues array gracefully', () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: [] }
    })

    const select = wrapper.find('[data-testid="filter-select"]')
    const options = select.findAll('option')

    // Should only have "All" option
    expect(options.length).toBe(1)
    expect(options[0].text()).toBe('All Teams')
  })

  it('extracts unique teams from issues', () => {
    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: mockIssues }
    })

    const select = wrapper.find('[data-testid="filter-select"]')
    const options = select.findAll('option')

    // Team A appears twice in issues but should only appear once in options
    const teamAOptions = options.filter(o => o.text() === 'Team A')
    expect(teamAOptions.length).toBe(1)
  })

  it('sorts options alphabetically', () => {
    const unsortedIssues = [
      { key: 'ISSUE-1', team: 'Zebra Team', components: [] },
      { key: 'ISSUE-2', team: 'Alpha Team', components: [] },
      { key: 'ISSUE-3', team: 'Beta Team', components: [] }
    ]

    const wrapper = mount(RoadmapFilterBar, {
      props: { issues: unsortedIssues }
    })

    const select = wrapper.find('[data-testid="filter-select"]')
    const options = select.findAll('option')

    expect(options[1].text()).toBe('Alpha Team')
    expect(options[2].text()).toBe('Beta Team')
    expect(options[3].text()).toBe('Zebra Team')
  })
})
