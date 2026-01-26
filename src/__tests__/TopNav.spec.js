/**
 * Tests for TopNav.vue component - following TDD practices.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TopNav from '../components/TopNav.vue'

describe('TopNav', () => {
  it('renders all three navigation tabs', () => {
    const wrapper = mount(TopNav, {
      props: {
        currentView: 'release-tracking'
      }
    })

    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(3)

    const buttonTexts = buttons.map(btn => btn.text())
    expect(buttonTexts).toContain('Release Tracking')
    expect(buttonTexts.some(text => text.includes('Feature Intake'))).toBe(true)
    expect(buttonTexts).toContain('Feature Roadmap')
  })

  it('highlights the current view tab', () => {
    const wrapper = mount(TopNav, {
      props: {
        currentView: 'roadmap'
      }
    })

    const buttons = wrapper.findAll('button')
    const roadmapTab = buttons.find(btn => btn.text() === 'Feature Roadmap')
    expect(roadmapTab.classes()).toContain('border-primary-500')
  })

  it('emits view-change event with "roadmap" when Feature Roadmap tab clicked', async () => {
    const wrapper = mount(TopNav, {
      props: {
        currentView: 'release-tracking'
      }
    })

    const buttons = wrapper.findAll('button')
    const roadmapTab = buttons.find(btn => btn.text() === 'Feature Roadmap')
    await roadmapTab.trigger('click')

    expect(wrapper.emitted('view-change')).toBeTruthy()
    expect(wrapper.emitted('view-change')[0]).toEqual(['roadmap'])
  })

  it('shows Beta badge on Feature Intake tab', () => {
    const wrapper = mount(TopNav, {
      props: {
        currentView: 'release-tracking'
      }
    })

    const buttons = wrapper.findAll('button')
    const featureIntakeTab = buttons.find(btn => btn.text().includes('Feature Intake'))
    expect(featureIntakeTab.text()).toContain('Beta')
  })
})
