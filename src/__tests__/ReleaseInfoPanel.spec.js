/**
 * Tests for ReleaseInfoPanel.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReleaseInfoPanel from '../components/ReleaseInfoPanel.vue'

describe('ReleaseInfoPanel', () => {
  const mockRelease = {
    name: 'rhoai-3.2',
    planDate: '2024-11-30',
    codeFreeze: '2024-12-20',
    releaseDate: '2025-01-15'
  }

  it('renders release name as heading', () => {
    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: mockRelease }
    })

    const heading = wrapper.find('[data-testid="release-name"]')
    expect(heading.text()).toBe('rhoai-3.2')
  })

  it('displays Plan Due date in "Jan 15, 2025" format', () => {
    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: mockRelease }
    })

    const planDate = wrapper.find('[data-testid="plan-date"]')
    expect(planDate.text()).toBe('Nov 30, 2024')
  })

  it('displays Code Freeze date in correct format', () => {
    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: mockRelease }
    })

    const codeFreeze = wrapper.find('[data-testid="code-freeze"]')
    expect(codeFreeze.text()).toBe('Dec 20, 2024')
  })

  it('displays Release Date in correct format', () => {
    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: mockRelease }
    })

    const releaseDate = wrapper.find('[data-testid="release-date"]')
    expect(releaseDate.text()).toBe('Jan 15, 2025')
  })

  it('renders Edit button', () => {
    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: mockRelease }
    })

    const editButton = wrapper.find('[data-testid="edit-btn"]')
    expect(editButton.exists()).toBe(true)
    expect(editButton.text()).toContain('Edit')
  })

  it('renders Delete button', () => {
    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: mockRelease }
    })

    const deleteButton = wrapper.find('[data-testid="delete-btn"]')
    expect(deleteButton.exists()).toBe(true)
    expect(deleteButton.text()).toContain('Delete')
  })

  it('emits edit event when Edit clicked', async () => {
    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: mockRelease }
    })

    const editButton = wrapper.find('[data-testid="edit-btn"]')
    await editButton.trigger('click')

    expect(wrapper.emitted('edit')).toBeTruthy()
  })

  it('emits delete event when Delete clicked', async () => {
    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: mockRelease }
    })

    const deleteButton = wrapper.find('[data-testid="delete-btn"]')
    await deleteButton.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
  })

  it('handles missing planDate gracefully', () => {
    const releaseWithoutPlanDate = {
      name: 'rhoai-3.2',
      planDate: null,
      codeFreeze: '2024-12-20',
      releaseDate: '2025-01-15'
    }

    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: releaseWithoutPlanDate }
    })

    const planDate = wrapper.find('[data-testid="plan-date"]')
    expect(planDate.text()).toBe('Not set')
  })

  it('handles missing codeFreeze gracefully', () => {
    const releaseWithoutCodeFreeze = {
      name: 'rhoai-3.2',
      planDate: '2024-11-30',
      codeFreeze: null,
      releaseDate: '2025-01-15'
    }

    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: releaseWithoutCodeFreeze }
    })

    const codeFreeze = wrapper.find('[data-testid="code-freeze"]')
    expect(codeFreeze.text()).toBe('Not set')
  })

  it('handles missing releaseDate gracefully', () => {
    const releaseWithoutReleaseDate = {
      name: 'rhoai-3.2',
      planDate: '2024-11-30',
      codeFreeze: '2024-12-20',
      releaseDate: null
    }

    const wrapper = mount(ReleaseInfoPanel, {
      props: { release: releaseWithoutReleaseDate }
    })

    const releaseDate = wrapper.find('[data-testid="release-date"]')
    expect(releaseDate.text()).toBe('Not set')
  })
})
