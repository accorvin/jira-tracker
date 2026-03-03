/**
 * Tests for HygieneRulesModal.vue component
 * Following TDD practices - tests written before implementation
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HygieneRulesModal from '../components/HygieneRulesModal.vue'
import { hygieneRules } from '../utils/hygieneRules'

describe('HygieneRulesModal', () => {
  describe('Visibility', () => {
    it('does not render when show prop is false', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: false }
      })

      expect(wrapper.find('[data-testid="hygiene-rules-modal"]').exists()).toBe(false)
    })

    it('renders when show prop is true', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      expect(wrapper.find('[data-testid="hygiene-rules-modal"]').exists()).toBe(true)
    })
  })

  describe('Content', () => {
    it('displays all hygiene rules', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      // Should display all rules from hygieneRules
      hygieneRules.forEach(rule => {
        expect(wrapper.text()).toContain(rule.name)
      })
    })

    it('displays rule descriptions', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      // Should display descriptions for each rule
      hygieneRules.forEach(rule => {
        expect(wrapper.text()).toContain(rule.description)
      })
    })

    it('displays a title', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      expect(wrapper.text()).toContain('Hygiene Rules')
    })
  })

  describe('Close interaction', () => {
    it('emits close event when backdrop is clicked', async () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      const backdrop = wrapper.find('[data-testid="modal-backdrop"]')
      await backdrop.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close').length).toBe(1)
    })

    it('emits close event when close button is clicked', async () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      const closeButton = wrapper.find('[data-testid="modal-close"]')
      await closeButton.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close').length).toBe(1)
    })

    it('does not emit close when modal content is clicked', async () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      const content = wrapper.find('[data-testid="modal-content"]')
      await content.trigger('click')

      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('FAQ Section', () => {
    it('displays "What is hygiene enforcement?" section', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      expect(wrapper.text()).toContain('What is hygiene enforcement?')
    })

    it('displays "How does it work?" section', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      expect(wrapper.text()).toContain('How does it work?')
    })

    it('displays "What happens when a rule is enforced?" section', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      expect(wrapper.text()).toContain('What happens when a rule is enforced?')
    })
  })

  describe('Remediation', () => {
    it('displays remediation text for each rule', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      hygieneRules.forEach(rule => {
        expect(wrapper.text()).toContain(rule.remediation)
      })
    })

    it('displays "How to fix" label for remediation sections', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      expect(wrapper.text()).toContain('How to fix')
    })
  })

  describe('Enforcement badges', () => {
    it('displays "Comment Only" badge for comment-only enforcement rules', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      const commentOnlyRules = hygieneRules.filter(r => r.enforcement && r.enforcement.type === 'comment-only')
      expect(commentOnlyRules.length).toBeGreaterThan(0)

      expect(wrapper.text()).toContain('Comment Only')
    })

    it('displays "May move issue" badge for transition enforcement rules', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      const transitionRules = hygieneRules.filter(r => r.enforcement && r.enforcement.type === 'transition')
      expect(transitionRules.length).toBeGreaterThan(0)

      transitionRules.forEach(rule => {
        expect(wrapper.text()).toContain(`May move issue to ${rule.enforcement.targetStatus}`)
      })
    })

    it('displays "Display Only" badge for rules without enforcement', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      const displayOnlyRules = hygieneRules.filter(r => !r.enforcement)
      expect(displayOnlyRules.length).toBeGreaterThan(0)

      expect(wrapper.text()).toContain('Display Only')
    })
  })

  describe('Accessibility', () => {
    it('has role="dialog" on modal', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      const dialog = wrapper.find('[role="dialog"]')
      expect(dialog.exists()).toBe(true)
    })

    it('has aria-labelledby referencing the title', () => {
      const wrapper = mount(HygieneRulesModal, {
        props: { show: true }
      })

      const dialog = wrapper.find('[role="dialog"]')
      expect(dialog.attributes('aria-labelledby')).toBeTruthy()
    })
  })
})
