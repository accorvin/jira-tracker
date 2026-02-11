/**
 * Tests for PriorityAlerts.vue component - following TDD practices.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PriorityAlerts from '../components/PriorityAlerts.vue'

describe('PriorityAlerts', () => {
  it('shows green banner when no violations and no low priority in progress', () => {
    const wrapper = mount(PriorityAlerts, {
      props: { violations: [], lowPriorityInProgress: [] }
    })
    expect(wrapper.text()).toContain('No priority violations')
  })

  it('shows violation cards with team name and issue keys', () => {
    const violations = [{
      team: 'Fine Tuning',
      inProgressIssue: { key: 'RHOAIENG-456', rank: 85 },
      higherRankedIdleIssue: { key: 'RHOAIENG-123', rank: 12 },
      inProgressRank: 85,
      idleRank: 12,
      rankGap: 73
    }]
    const wrapper = mount(PriorityAlerts, {
      props: { violations, lowPriorityInProgress: [] }
    })
    expect(wrapper.text()).toContain('Fine Tuning')
    expect(wrapper.text()).toContain('RHOAIENG-456')
    expect(wrapper.text()).toContain('RHOAIENG-123')
    expect(wrapper.text()).toContain('#85')
    expect(wrapper.text()).toContain('#12')
  })

  it('shows low priority in progress alerts', () => {
    const lowPriorityInProgress = [
      { key: 'RHOAIENG-789', rank: 142, status: 'In Progress' }
    ]
    const wrapper = mount(PriorityAlerts, {
      props: { violations: [], lowPriorityInProgress }
    })
    expect(wrapper.text()).toContain('RHOAIENG-789')
    expect(wrapper.text()).toContain('#142')
  })

  it('shows alert count in header', () => {
    const violations = [{
      team: 'Team A',
      inProgressIssue: { key: 'A-2', rank: 50 },
      higherRankedIdleIssue: { key: 'A-1', rank: 5 },
      inProgressRank: 50,
      idleRank: 5,
      rankGap: 45
    }]
    const lowPriorityInProgress = [
      { key: 'B-1', rank: 150, status: 'In Progress' }
    ]
    const wrapper = mount(PriorityAlerts, {
      props: { violations, lowPriorityInProgress }
    })
    // Should show total count (1 violation + 1 low priority = 2)
    expect(wrapper.text()).toContain('2')
  })

  it('uses red styling for violations with rank gap > 50', () => {
    const violations = [{
      team: 'Team A',
      inProgressIssue: { key: 'A-2', rank: 100 },
      higherRankedIdleIssue: { key: 'A-1', rank: 5 },
      inProgressRank: 100,
      idleRank: 5,
      rankGap: 95
    }]
    const wrapper = mount(PriorityAlerts, {
      props: { violations, lowPriorityInProgress: [] }
    })
    const card = wrapper.find('[data-testid="violation-card"]')
    expect(card.classes()).toContain('border-red-500')
  })

  it('uses amber styling for violations with rank gap <= 50', () => {
    const violations = [{
      team: 'Team A',
      inProgressIssue: { key: 'A-2', rank: 30 },
      higherRankedIdleIssue: { key: 'A-1', rank: 5 },
      inProgressRank: 30,
      idleRank: 5,
      rankGap: 25
    }]
    const wrapper = mount(PriorityAlerts, {
      props: { violations, lowPriorityInProgress: [] }
    })
    const card = wrapper.find('[data-testid="violation-card"]')
    expect(card.classes()).toContain('border-amber-500')
  })

  it('can collapse and expand the alerts section', async () => {
    const violations = [{
      team: 'Team A',
      inProgressIssue: { key: 'A-2', rank: 50 },
      higherRankedIdleIssue: { key: 'A-1', rank: 5 },
      inProgressRank: 50,
      idleRank: 5,
      rankGap: 45
    }]
    const wrapper = mount(PriorityAlerts, {
      props: { violations, lowPriorityInProgress: [] }
    })

    // Initially expanded (alerts exist)
    expect(wrapper.find('[data-testid="alerts-content"]').exists()).toBe(true)

    // Click to collapse
    await wrapper.find('[data-testid="alerts-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="alerts-content"]').exists()).toBe(false)

    // Click to expand again
    await wrapper.find('[data-testid="alerts-toggle"]').trigger('click')
    expect(wrapper.find('[data-testid="alerts-content"]').exists()).toBe(true)
  })
})
