/**
 * Tests for IntakeCard.vue component
 * Following TDD practices - comprehensive tests for feature intake cards
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IntakeCard from '../components/IntakeCard.vue'

describe('IntakeCard', () => {
  const mockFeature = {
    key: 'RHOAIENG-123',
    title: 'Add GPU sharing for training workloads',
    issueType: 'Feature',
    assignee: 'John Doe',
    status: 'New',
    component: 'Training Ray',
    team: 'Fine Tuning',
    reach: 100,
    impact: 3,
    confidence: 80,
    effort: 5,
    riceScore: 48,
    riceStatus: 'complete',
    linkedRfe: {
      key: 'RHAIRFE-456',
      title: 'RFE: Support GPU sharing',
      approvalDate: '2025-12-01T10:00:00Z',
      status: 'Approved'
    },
    url: 'https://issues.redhat.com/browse/RHOAIENG-123'
  }

  describe('Basic rendering', () => {
    it('renders feature key as link to Jira', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      const link = wrapper.find('a[href*="RHOAIENG-123"]')
      expect(link.exists()).toBe(true)
      expect(link.text()).toBe('RHOAIENG-123')
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    })

    it('renders feature title', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      expect(wrapper.text()).toContain('Add GPU sharing for training workloads')
    })

    it('renders component name', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      expect(wrapper.text()).toContain('Component:')
      expect(wrapper.text()).toContain('Training Ray')
    })

    it('renders "Not set" when component is null', () => {
      const featureWithoutComponent = {
        ...mockFeature,
        component: null
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: featureWithoutComponent }
      })

      expect(wrapper.text()).toContain('Not set')
    })

    it('renders assignee name', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      expect(wrapper.text()).toContain('Assignee:')
      expect(wrapper.text()).toContain('John Doe')
    })

    it('renders "Unassigned" when assignee is null', () => {
      const featureWithoutAssignee = {
        ...mockFeature,
        assignee: null
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: featureWithoutAssignee }
      })

      expect(wrapper.text()).toContain('Unassigned')
    })
  })

  describe('RICE Score display', () => {
    it('displays complete RICE score with green background', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      expect(wrapper.text()).toContain('RICE Score')
      expect(wrapper.text()).toContain('48')

      const riceSection = wrapper.find('.bg-green-50')
      expect(riceSection.exists()).toBe(true)
    })

    it('displays RICE score breakdown when complete', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      expect(wrapper.text()).toContain('Reach')
      expect(wrapper.text()).toContain('100')
      expect(wrapper.text()).toContain('Impact')
      expect(wrapper.text()).toContain('3')
      expect(wrapper.text()).toContain('Confidence')
      expect(wrapper.text()).toContain('80%')
      expect(wrapper.text()).toContain('Effort')
      expect(wrapper.text()).toContain('5')
    })

    it('displays partial RICE score with yellow background', () => {
      const partialFeature = {
        ...mockFeature,
        reach: 100,
        impact: 3,
        confidence: null,
        effort: null,
        riceScore: null,
        riceStatus: 'partial'
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: partialFeature }
      })

      expect(wrapper.text()).toContain('Incomplete RICE')

      const riceSection = wrapper.find('.bg-yellow-50')
      expect(riceSection.exists()).toBe(true)
    })

    it('displays missing RICE with red background', () => {
      const noRiceFeature = {
        ...mockFeature,
        reach: null,
        impact: null,
        confidence: null,
        effort: null,
        riceScore: null,
        riceStatus: 'none'
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: noRiceFeature }
      })

      expect(wrapper.text()).toContain('No RICE')

      const riceSection = wrapper.find('.bg-red-50')
      expect(riceSection.exists()).toBe(true)
    })

    it('shows "-" for missing RICE values in breakdown', () => {
      const partialFeature = {
        ...mockFeature,
        reach: 100,
        impact: null,
        confidence: 80,
        effort: null,
        riceScore: null,
        riceStatus: 'partial'
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: partialFeature }
      })

      const html = wrapper.html()
      expect(wrapper.text()).toContain('100') // reach is set
      expect(wrapper.text()).toContain('80%') // confidence is set
      // Impact and effort should show "-"
      expect(html).toContain('-')
    })

    it('highlights missing RICE values in red', () => {
      const partialFeature = {
        ...mockFeature,
        reach: null,
        impact: 3,
        confidence: null,
        effort: 5,
        riceScore: null,
        riceStatus: 'partial'
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: partialFeature }
      })

      const missingValues = wrapper.findAll('.text-red-500')
      expect(missingValues.length).toBeGreaterThan(0)
    })
  })

  describe('Next Up badge', () => {
    it('shows "NEXT UP" badge when isNextUp is true', () => {
      const wrapper = mount(IntakeCard, {
        props: {
          feature: mockFeature,
          isNextUp: true
        }
      })

      expect(wrapper.text()).toContain('NEXT UP')
    })

    it('applies ring styling when isNextUp is true', () => {
      const wrapper = mount(IntakeCard, {
        props: {
          feature: mockFeature,
          isNextUp: true
        }
      })

      const card = wrapper.find('.ring-2')
      expect(card.exists()).toBe(true)
      expect(card.classes()).toContain('ring-primary-500')
    })

    it('does not show badge when isNextUp is false', () => {
      const wrapper = mount(IntakeCard, {
        props: {
          feature: mockFeature,
          isNextUp: false
        }
      })

      expect(wrapper.text()).not.toContain('NEXT UP')
    })

    it('does not apply ring styling when isNextUp is false', () => {
      const wrapper = mount(IntakeCard, {
        props: {
          feature: mockFeature,
          isNextUp: false
        }
      })

      const ringElements = wrapper.findAll('.ring-2')
      expect(ringElements.length).toBe(0)
    })
  })

  describe('Linked RFE display', () => {
    it('displays linked RFE information', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      expect(wrapper.text()).toContain('Linked RFE')
      expect(wrapper.text()).toContain('RHAIRFE-456')
      expect(wrapper.text()).toContain('RFE: Support GPU sharing')
    })

    it('displays RFE approval date', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      expect(wrapper.text()).toContain('Approved:')
      expect(wrapper.text()).toMatch(/Dec 1, 2025/)
    })

    it('creates link to RFE with correct URL', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      const rfeLink = wrapper.find('a[href*="RHAIRFE-456"]')
      expect(rfeLink.exists()).toBe(true)
      expect(rfeLink.attributes('href')).toBe('https://issues.redhat.com/browse/RHAIRFE-456')
      expect(rfeLink.attributes('target')).toBe('_blank')
    })

    it('does not show RFE section when linkedRfe is null', () => {
      const featureWithoutRfe = {
        ...mockFeature,
        linkedRfe: null
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: featureWithoutRfe }
      })

      expect(wrapper.text()).not.toContain('Linked RFE')
    })

    it('handles RFE without approval date gracefully', () => {
      const featureWithRfeNoDate = {
        ...mockFeature,
        linkedRfe: {
          key: 'RHAIRFE-456',
          title: 'RFE: Support GPU sharing',
          approvalDate: null,
          status: 'Approved'
        }
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: featureWithRfeNoDate }
      })

      expect(wrapper.text()).toContain('RHAIRFE-456')
      expect(wrapper.text()).not.toContain('Approved:')
    })
  })

  describe('External links', () => {
    it('provides View Feature link', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      const links = wrapper.findAll('a')
      const viewFeatureLink = links.find(link => link.text().includes('View Feature'))
      expect(viewFeatureLink).toBeDefined()
      expect(viewFeatureLink.attributes('href')).toBe(mockFeature.url)
    })

    it('provides View RFE link when RFE is linked', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      const links = wrapper.findAll('a')
      const viewRfeLink = links.find(link => link.text().includes('View RFE'))
      expect(viewRfeLink).toBeDefined()
    })

    it('does not show View RFE link when no RFE is linked', () => {
      const featureWithoutRfe = {
        ...mockFeature,
        linkedRfe: null
      }

      const wrapper = mount(IntakeCard, {
        props: { feature: featureWithoutRfe }
      })

      const links = wrapper.findAll('a')
      const viewRfeLink = links.find(link => link.text().includes('View RFE'))
      expect(viewRfeLink).toBeUndefined()
    })
  })

  describe('Styling and layout', () => {
    it('has rounded corners and border', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      const card = wrapper.find('.rounded-lg')
      expect(card.exists()).toBe(true)
      expect(card.classes()).toContain('border')
    })

    it('has hover shadow effect', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      const card = wrapper.find('.hover\\:shadow-md')
      expect(card.exists()).toBe(true)
    })

    it('uses grid layout for feature details', () => {
      const wrapper = mount(IntakeCard, {
        props: { feature: mockFeature }
      })

      const grid = wrapper.find('.grid-cols-2')
      expect(grid.exists()).toBe(true)
    })
  })
})
