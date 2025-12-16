/**
 * Tests for ReleaseTabBar.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReleaseTabBar from '../components/ReleaseTabBar.vue'

describe('ReleaseTabBar', () => {
  const mockReleases = [
    {
      name: 'rhoai-3.2',
      planDate: '2024-11-30',
      codeFreeze: '2024-12-20',
      releaseDate: '2025-01-15'
    },
    {
      name: 'rhoai-3.1',
      planDate: '2024-08-30',
      codeFreeze: '2024-09-20',
      releaseDate: '2024-10-15'
    },
    {
      name: 'rhoai-3.3',
      planDate: '2025-02-28',
      codeFreeze: '2025-03-15',
      releaseDate: '2025-04-01'
    }
  ]

  it('renders correct number of tabs from releases prop', () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mockReleases,
        selectedRelease: 'rhoai-3.1'
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    expect(tabs).toHaveLength(3)
  })

  it('displays release names on tabs', () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mockReleases,
        selectedRelease: 'rhoai-3.1'
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    const tabTexts = tabs.map(tab => tab.text())
    expect(tabTexts).toContain('rhoai-3.1')
    expect(tabTexts).toContain('rhoai-3.2')
    expect(tabTexts).toContain('rhoai-3.3')
  })

  it('highlights the selected release tab', () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mockReleases,
        selectedRelease: 'rhoai-3.2'
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    const selectedTab = tabs.find(tab => tab.text() === 'rhoai-3.2')
    expect(selectedTab.classes()).toContain('tab-selected')
  })

  it('does not highlight unselected tabs', () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mockReleases,
        selectedRelease: 'rhoai-3.2'
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    const unselectedTab = tabs.find(tab => tab.text() === 'rhoai-3.1')
    expect(unselectedTab.classes()).not.toContain('tab-selected')
  })

  it('emits select event with release name when tab clicked', async () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mockReleases,
        selectedRelease: 'rhoai-3.1'
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    const tabToClick = tabs.find(tab => tab.text() === 'rhoai-3.2')
    await tabToClick.trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')[0]).toEqual(['rhoai-3.2'])
  })

  it('renders Add button', () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mockReleases,
        selectedRelease: 'rhoai-3.1'
      }
    })

    const addButton = wrapper.find('[data-testid="add-release-btn"]')
    expect(addButton.exists()).toBe(true)
    expect(addButton.text()).toContain('Add')
  })

  it('emits add event when Add button clicked', async () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mockReleases,
        selectedRelease: 'rhoai-3.1'
      }
    })

    const addButton = wrapper.find('[data-testid="add-release-btn"]')
    await addButton.trigger('click')

    expect(wrapper.emitted('add')).toBeTruthy()
  })

  it('sorts releases by semantic version (lowest first)', () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mockReleases,
        selectedRelease: 'rhoai-3.1'
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    const tabTexts = tabs.map(tab => tab.text())

    // Should be sorted: 3.1, 3.2, 3.3
    expect(tabTexts[0]).toBe('rhoai-3.1')
    expect(tabTexts[1]).toBe('rhoai-3.2')
    expect(tabTexts[2]).toBe('rhoai-3.3')
  })

  it('handles empty releases array gracefully', () => {
    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: [],
        selectedRelease: null
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    expect(tabs).toHaveLength(0)

    // Add button should still be present
    const addButton = wrapper.find('[data-testid="add-release-btn"]')
    expect(addButton.exists()).toBe(true)
  })

  it('handles releases with different major versions', () => {
    const mixedVersionReleases = [
      { name: 'rhoai-4.0', planDate: '2025-06-01', codeFreeze: '2025-07-01', releaseDate: '2025-08-01' },
      { name: 'rhoai-3.2', planDate: '2024-11-30', codeFreeze: '2024-12-20', releaseDate: '2025-01-15' },
      { name: 'rhoai-3.10', planDate: '2025-05-01', codeFreeze: '2025-06-01', releaseDate: '2025-07-01' }
    ]

    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: mixedVersionReleases,
        selectedRelease: 'rhoai-3.2'
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    const tabTexts = tabs.map(tab => tab.text())

    // Should be sorted: 3.2, 3.10, 4.0
    expect(tabTexts[0]).toBe('rhoai-3.2')
    expect(tabTexts[1]).toBe('rhoai-3.10')
    expect(tabTexts[2]).toBe('rhoai-4.0')
  })

  it('sorts extended versions with suffixes correctly', () => {
    const extendedVersionReleases = [
      { name: 'rhoai-3.4', planDate: '2025-03-01', codeFreeze: '2025-04-01', releaseDate: '2025-05-01' },
      { name: 'rhoai-3.4.RC1', planDate: '2025-02-15', codeFreeze: '2025-03-15', releaseDate: '2025-04-15' },
      { name: 'rhoai-3.4.EA1', planDate: '2025-01-01', codeFreeze: '2025-02-01', releaseDate: '2025-03-01' },
      { name: 'rhoai-3.3', planDate: '2024-12-01', codeFreeze: '2025-01-01', releaseDate: '2025-02-01' }
    ]

    const wrapper = mount(ReleaseTabBar, {
      props: {
        releases: extendedVersionReleases,
        selectedRelease: 'rhoai-3.4'
      }
    })

    const tabs = wrapper.findAll('[data-testid="release-tab"]')
    const tabTexts = tabs.map(tab => tab.text())

    // Pre-releases (EA1, RC1) should come before the base version
    // Expected order: 3.3, 3.4.EA1, 3.4.RC1, 3.4
    expect(tabTexts[0]).toBe('rhoai-3.3')
    expect(tabTexts[1]).toBe('rhoai-3.4.EA1')
    expect(tabTexts[2]).toBe('rhoai-3.4.RC1')
    expect(tabTexts[3]).toBe('rhoai-3.4')
  })
})
