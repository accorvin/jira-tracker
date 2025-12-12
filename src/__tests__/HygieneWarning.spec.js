/**
 * Tests for HygieneWarning.vue - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HygieneWarning from '../components/HygieneWarning.vue'

describe('HygieneWarning', () => {
  const mockViolations = [
    {
      id: 'missing-assignee',
      name: 'Missing Assignee',
      message: 'This issue is in Refinement but has no assignee. Assign someone to take ownership.'
    },
    {
      id: 'missing-team',
      name: 'Missing Team',
      message: 'This issue is in Refinement but has no team assigned. Set the team field to track ownership.'
    }
  ]

  it('should not render when violations array is empty', () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: [] }
    })

    expect(wrapper.find('.hygiene-warning').exists()).toBe(false)
  })

  it('should render warning icon when violations exist', () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations }
    })

    expect(wrapper.find('.hygiene-warning').exists()).toBe(true)
    expect(wrapper.find('.warning-icon').exists()).toBe(true)
  })

  it('should have pulse animation class on warning icon', () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations }
    })

    const icon = wrapper.find('.warning-icon')
    expect(icon.classes()).toContain('pulse')
  })

  it('should not show popup initially', () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations }
    })

    expect(wrapper.find('.popup').exists()).toBe(false)
  })

  it('should show popup when warning icon is clicked', async () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations }
    })

    await wrapper.find('.warning-icon').trigger('click')

    expect(wrapper.find('.popup').exists()).toBe(true)
  })

  it('should hide popup when clicked again', async () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations }
    })

    const icon = wrapper.find('.warning-icon')

    // First click - show popup
    await icon.trigger('click')
    expect(wrapper.find('.popup').exists()).toBe(true)

    // Second click - hide popup
    await icon.trigger('click')
    expect(wrapper.find('.popup').exists()).toBe(false)
  })

  it('should display violation count in popup header', async () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations }
    })

    await wrapper.find('.warning-icon').trigger('click')

    expect(wrapper.text()).toContain('2')
  })

  it('should display all violation messages in popup', async () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations }
    })

    await wrapper.find('.warning-icon').trigger('click')

    expect(wrapper.text()).toContain('no assignee')
    expect(wrapper.text()).toContain('no team assigned')
  })

  it('should display violations as list items', async () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations }
    })

    await wrapper.find('.warning-icon').trigger('click')

    const listItems = wrapper.findAll('li')
    expect(listItems).toHaveLength(2)
  })

  it('should close popup when clicking outside', async () => {
    const wrapper = mount(HygieneWarning, {
      props: { violations: mockViolations },
      attachTo: document.body // Needed for click outside detection
    })

    // Open popup
    await wrapper.find('.warning-icon').trigger('click')
    expect(wrapper.find('.popup').exists()).toBe(true)

    // Click outside (on document body)
    document.body.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.popup').exists()).toBe(false)

    wrapper.unmount()
  })
})
