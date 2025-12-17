/**
 * Tests for HelpBubble.vue component
 * Following TDD practices - tests written before implementation
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import HelpBubble from '../components/HelpBubble.vue'

describe('HelpBubble', () => {
  const defaultProps = {
    title: 'Test Help',
    content: 'This is test help content.'
  }

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

    it('is always visible', () => {
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

  describe('Props', () => {
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

  describe('Action button', () => {
    it('does not show action button when actionLabel not provided', async () => {
      const wrapper = mount(HelpBubble, { props: defaultProps })

      const button = wrapper.find('button')
      await button.trigger('click')

      const actionButton = wrapper.find('[data-testid="help-action"]')
      expect(actionButton.exists()).toBe(false)
    })

    it('shows action button when actionLabel is provided', async () => {
      const wrapper = mount(HelpBubble, {
        props: { ...defaultProps, actionLabel: 'View Details' }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      const actionButton = wrapper.find('[data-testid="help-action"]')
      expect(actionButton.exists()).toBe(true)
      expect(actionButton.text()).toContain('View Details')
    })

    it('emits action event when action button is clicked', async () => {
      const wrapper = mount(HelpBubble, {
        props: { ...defaultProps, actionLabel: 'View Details' }
      })

      const button = wrapper.find('button')
      await button.trigger('click')

      const actionButton = wrapper.find('[data-testid="help-action"]')
      await actionButton.trigger('click')

      expect(wrapper.emitted('action')).toBeTruthy()
      expect(wrapper.emitted('action').length).toBe(1)
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
