/**
 * Tests for HelpBubble.vue component
 * Following TDD practices - tests written before implementation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HelpBubble from '../components/HelpBubble.vue'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()

global.localStorage = localStorageMock

describe('HelpBubble', () => {
  const defaultProps = {
    storageKey: 'test-help-dismissed',
    title: 'Test Help',
    content: 'This is test help content.'
  }

  beforeEach(() => {
    localStorage.clear()
  })

  describe('Initial rendering', () => {
    it('renders the question mark icon button', () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('?')
    })

    it('positions in bottom-right corner with fixed positioning', () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const container = wrapper.find('[data-testid="help-bubble"]')
      expect(container.classes()).toContain('fixed')
      expect(container.classes()).toContain('bottom-4')
      expect(container.classes()).toContain('right-4')
    })

    it('does not show help content by default', () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      expect(wrapper.text()).not.toContain(defaultProps.content)
    })

    it('is visible when not dismissed', () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      expect(wrapper.find('[data-testid="help-bubble"]').exists()).toBe(true)
    })
  })

  describe('Click interaction', () => {
    it('shows help content when icon is clicked', async () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.text()).toContain(defaultProps.content)
    })

    it('shows the title in the expanded view', async () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.text()).toContain(defaultProps.title)
    })

    it('hides help content when clicked again', async () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      await button.trigger('click')
      expect(wrapper.text()).toContain(defaultProps.content)

      // Click the close button or toggle
      const closeButton = wrapper.find('[data-testid="help-close"]')
      await closeButton.trigger('click')

      expect(wrapper.text()).not.toContain(defaultProps.content)
    })
  })

  describe('Dismiss permanently', () => {
    it('shows dismiss button in expanded view', async () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      await button.trigger('click')

      const dismissButton = wrapper.find('[data-testid="help-dismiss"]')
      expect(dismissButton.exists()).toBe(true)
      expect(dismissButton.text()).toContain("Don't show again")
    })

    it('hides entire component when dismissed', async () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      // Open the help
      const button = wrapper.find('button')
      await button.trigger('click')

      // Click dismiss
      const dismissButton = wrapper.find('[data-testid="help-dismiss"]')
      await dismissButton.trigger('click')

      // Component should be hidden
      expect(wrapper.find('[data-testid="help-bubble"]').exists()).toBe(false)
    })

    it('saves dismissed state to localStorage', async () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      await button.trigger('click')

      const dismissButton = wrapper.find('[data-testid="help-dismiss"]')
      await dismissButton.trigger('click')

      expect(localStorage.getItem(defaultProps.storageKey)).toBe('true')
    })

    it('stays hidden on remount when previously dismissed', async () => {
      localStorage.setItem(defaultProps.storageKey, 'true')

      const wrapper = mount(HelpBubble, { props: defaultProps })
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="help-bubble"]').exists()).toBe(false)
    })
  })

  describe('Props', () => {
    it('uses custom storageKey for localStorage', async () => {
      const customKey = 'my-custom-help-key'
      const wrapper = mount(HelpBubble, {
        props: { ...defaultProps, storageKey: customKey }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      const dismissButton = wrapper.find('[data-testid="help-dismiss"]')
      await dismissButton.trigger('click')

      expect(localStorage.getItem(customKey)).toBe('true')
    })

    it('renders custom title', async () => {
      const wrapper = mount(HelpBubble, {
        props: { ...defaultProps, title: 'Custom Title' }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.text()).toContain('Custom Title')
    })

    it('renders custom content', async () => {
      const wrapper = mount(HelpBubble, {
        props: { ...defaultProps, content: 'Custom help text here.' }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      expect(wrapper.text()).toContain('Custom help text here.')
    })
  })

  describe('Accessibility', () => {
    it('has accessible button with aria-label', () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      expect(button.attributes('aria-label')).toBeTruthy()
    })

    it('has role="dialog" on expanded content', async () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      await button.trigger('click')

      const dialog = wrapper.find('[role="dialog"]')
      expect(dialog.exists()).toBe(true)
    })
  })
})
