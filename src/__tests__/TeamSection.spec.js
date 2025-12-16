/**
 * Tests for TeamSection.vue component
 * Following TDD practices - tests for collapsible team sections
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamSection from '../components/TeamSection.vue'

describe('TeamSection', () => {
  const mockFeatures = [
    {
      key: 'RHOAIENG-123',
      title: 'Add GPU sharing',
      riceScore: 48,
      riceStatus: 'complete',
      team: 'Fine Tuning',
      component: 'Training Ray',
      assignee: 'John Doe',
      linkedRfe: { key: 'RHAIRFE-456', title: 'RFE: GPU sharing' },
      url: 'https://issues.redhat.com/browse/RHOAIENG-123'
    },
    {
      key: 'RHOAIENG-124',
      title: 'Implement Ray autoscaling',
      riceScore: 35,
      riceStatus: 'complete',
      team: 'Fine Tuning',
      component: 'Training Ray',
      assignee: 'Jane Smith',
      linkedRfe: { key: 'RHAIRFE-457', title: 'RFE: Autoscaling' },
      url: 'https://issues.redhat.com/browse/RHOAIENG-124'
    },
    {
      key: 'RHOAIENG-125',
      title: 'Add metrics dashboard',
      riceScore: null,
      riceStatus: 'partial',
      team: 'Fine Tuning',
      component: 'Training Ray',
      assignee: null,
      linkedRfe: { key: 'RHAIRFE-458', title: 'RFE: Metrics' },
      url: 'https://issues.redhat.com/browse/RHOAIENG-125'
    }
  ]

  describe('Header rendering', () => {
    it('displays team name', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      expect(wrapper.text()).toContain('Fine Tuning')
    })

    it('displays "Unassigned Team" when teamName is null', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: null,
          features: mockFeatures
        }
      })

      expect(wrapper.text()).toContain('Unassigned Team')
    })

    it('displays feature count badge', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      expect(wrapper.text()).toContain('3')
    })

    it('shows drag handle', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const dragHandle = wrapper.find('.drag-handle')
      expect(dragHandle.exists()).toBe(true)
    })

    it('shows expand/collapse icon', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const icon = wrapper.find('svg')
      expect(icon.exists()).toBe(true)
    })
  })

  describe('Health indicator', () => {
    it('shows green indicator when top feature has complete RICE', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures // First feature has riceStatus: 'complete'
        }
      })

      const indicator = wrapper.find('.bg-green-500')
      expect(indicator.exists()).toBe(true)
    })

    it('shows yellow indicator when top feature has partial RICE', () => {
      const featuresWithPartial = [
        {
          ...mockFeatures[0],
          riceStatus: 'partial',
          riceScore: null
        },
        ...mockFeatures.slice(1)
      ]

      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: featuresWithPartial
        }
      })

      const indicator = wrapper.find('.bg-yellow-500')
      expect(indicator.exists()).toBe(true)
    })

    it('shows red indicator when top feature has no RICE', () => {
      const featuresWithNoRice = [
        {
          ...mockFeatures[0],
          riceStatus: 'none',
          riceScore: null,
          reach: null,
          impact: null,
          confidence: null,
          effort: null
        },
        ...mockFeatures.slice(1)
      ]

      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: featuresWithNoRice
        }
      })

      const indicator = wrapper.find('.bg-red-500')
      expect(indicator.exists()).toBe(true)
    })

    it('shows red indicator for unassigned team regardless of RICE status', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: null,
          features: mockFeatures // Even though first has complete RICE
        }
      })

      const indicator = wrapper.find('.bg-red-500')
      expect(indicator.exists()).toBe(true)
    })

    it('shows gray indicator when no features exist', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: []
        }
      })

      const indicator = wrapper.find('.bg-gray-300')
      expect(indicator.exists()).toBe(true)
    })

    it('has tooltip for green indicator', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const indicator = wrapper.find('.bg-green-500')
      expect(indicator.attributes('title')).toContain('Ready to plan')
    })

    it('has tooltip for yellow indicator', () => {
      const featuresWithPartial = [
        {
          ...mockFeatures[0],
          riceStatus: 'partial'
        }
      ]

      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: featuresWithPartial
        }
      })

      const indicator = wrapper.find('.bg-yellow-500')
      expect(indicator.attributes('title')).toContain('Needs attention')
    })

    it('has tooltip for red indicator (no RICE)', () => {
      const featuresWithNoRice = [
        {
          ...mockFeatures[0],
          riceStatus: 'none'
        }
      ]

      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: featuresWithNoRice
        }
      })

      const indicator = wrapper.find('.bg-red-500')
      expect(indicator.attributes('title')).toContain('Needs attention')
    })

    it('has tooltip for unassigned team', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: null,
          features: mockFeatures
        }
      })

      const indicator = wrapper.find('.bg-red-500')
      expect(indicator.attributes('title')).toContain('Team not assigned')
    })
  })

  describe('Collapse/expand functionality', () => {
    it('is expanded by default', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      // Features should be visible
      const featureCards = wrapper.findAllComponents({ name: 'IntakeCard' })
      expect(featureCards.length).toBe(3)
    })

    it('collapses when header is clicked', async () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const header = wrapper.find('.cursor-pointer')
      await header.trigger('click')

      // Check if content is hidden (v-show directive)
      const contentDiv = wrapper.find('.p-4.space-y-4')
      expect(contentDiv.attributes('style')).toContain('display: none')
    })

    it('expands when header is clicked again', async () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const header = wrapper.find('.cursor-pointer')

      // Collapse
      await header.trigger('click')
      let contentDiv = wrapper.find('.p-4.space-y-4')
      expect(contentDiv.attributes('style')).toContain('display: none')

      // Expand
      await header.trigger('click')
      contentDiv = wrapper.find('.p-4.space-y-4')
      expect(contentDiv.attributes('style')).not.toContain('display: none')
    })

    it('rotates expand icon when collapsed', async () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      // Initially expanded, so icon SHOULD have rotate class
      const iconsBefore = wrapper.findAll('svg')
      const expandIcon = iconsBefore.find(el => el.classes().includes('transition-transform'))
      expect(expandIcon.classes()).toContain('rotate-180')

      const header = wrapper.find('.cursor-pointer')
      await header.trigger('click')

      // After clicking to collapse, the icon should not be rotated
      const iconsAfter = wrapper.findAll('svg')
      const expandIconAfter = iconsAfter.find(el => el.classes().includes('transition-transform'))
      expect(expandIconAfter.classes()).not.toContain('rotate-180')
    })
  })

  describe('Feature card rendering', () => {
    it('renders all feature cards', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const cards = wrapper.findAllComponents({ name: 'IntakeCard' })
      expect(cards.length).toBe(3)
    })

    it('marks first complete feature as next up', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const cards = wrapper.findAllComponents({ name: 'IntakeCard' })
      expect(cards[0].props('isNextUp')).toBe(true)
      expect(cards[1].props('isNextUp')).toBe(false)
      expect(cards[2].props('isNextUp')).toBe(false)
    })

    it('does not mark partial RICE feature as next up', () => {
      const featuresWithPartialFirst = [
        {
          ...mockFeatures[0],
          riceStatus: 'partial'
        },
        ...mockFeatures.slice(1)
      ]

      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: featuresWithPartialFirst
        }
      })

      const cards = wrapper.findAllComponents({ name: 'IntakeCard' })
      expect(cards[0].props('isNextUp')).toBe(false)
    })

    it('renders empty state when no features', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: []
        }
      })

      const cards = wrapper.findAllComponents({ name: 'IntakeCard' })
      expect(cards.length).toBe(0)
    })
  })

  describe('Styling', () => {
    it('has white background and shadow', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const section = wrapper.find('.team-section')
      expect(section.classes()).toContain('bg-white')
      expect(section.classes()).toContain('rounded-lg')
      expect(section.classes()).toContain('shadow')
    })

    it('has border on header', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const header = wrapper.find('.border-b')
      expect(header.exists()).toBe(true)
    })

    it('header is clickable', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const header = wrapper.find('.cursor-pointer')
      expect(header.exists()).toBe(true)
    })

    it('has spacing between cards', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: mockFeatures
        }
      })

      const content = wrapper.find('.space-y-4')
      expect(content.exists()).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('handles single feature', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: [mockFeatures[0]]
        }
      })

      expect(wrapper.text()).toContain('1')
      const cards = wrapper.findAllComponents({ name: 'IntakeCard' })
      expect(cards.length).toBe(1)
    })

    it('handles very long team name', () => {
      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Really Long Team Name That Should Still Display Properly',
          features: mockFeatures
        }
      })

      expect(wrapper.text()).toContain('Really Long Team Name That Should Still Display Properly')
    })

    it('handles large number of features', () => {
      const manyFeatures = Array(20).fill(null).map((_, i) => ({
        ...mockFeatures[0],
        key: `RHOAIENG-${i}`,
        title: `Feature ${i}`
      }))

      const wrapper = mount(TeamSection, {
        props: {
          teamName: 'Fine Tuning',
          features: manyFeatures
        }
      })

      expect(wrapper.text()).toContain('20')
      const cards = wrapper.findAllComponents({ name: 'IntakeCard' })
      expect(cards.length).toBe(20)
    })
  })
})
