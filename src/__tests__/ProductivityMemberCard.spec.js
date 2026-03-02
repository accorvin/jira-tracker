import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductivityMemberCard from '../components/ProductivityMemberCard.vue';

describe('ProductivityMemberCard', () => {
  const mockMember = {
    name: 'John Doe',
    specialty: 'Backend Engineer',
    manager: 'Jane Smith',
    totalIssuesResolved: 15,
    totalStoryPoints: 42,
    avgCycleTimeDays: 3.5
  };

  it('should render member name prominently', () => {
    const wrapper = mount(ProductivityMemberCard, {
      props: { member: mockMember }
    });

    expect(wrapper.find('h3').text()).toBe('John Doe');
  });

  it('should display role badge with correct color', () => {
    const wrapper = mount(ProductivityMemberCard, {
      props: { member: mockMember }
    });

    const badge = wrapper.find('.bg-blue-100');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('Backend Engineer');
  });

  it('should show manager name', () => {
    const wrapper = mount(ProductivityMemberCard, {
      props: { member: mockMember }
    });

    expect(wrapper.text()).toContain('Manager: Jane Smith');
  });

  it('should display issues resolved count', () => {
    const wrapper = mount(ProductivityMemberCard, {
      props: { member: mockMember }
    });

    expect(wrapper.text()).toContain('Issues Resolved');
    expect(wrapper.text()).toContain('15');
  });

  it('should display story points', () => {
    const wrapper = mount(ProductivityMemberCard, {
      props: { member: mockMember }
    });

    expect(wrapper.text()).toContain('Story Points');
    expect(wrapper.text()).toContain('42');
  });

  it('should display avg cycle time', () => {
    const wrapper = mount(ProductivityMemberCard, {
      props: { member: mockMember }
    });

    expect(wrapper.text()).toContain('Avg Cycle Time');
    expect(wrapper.text()).toContain('3.5');
    expect(wrapper.text()).toContain('days');
  });

  it('should display N/A for missing story points', () => {
    const memberWithoutPoints = {
      ...mockMember,
      totalStoryPoints: null
    };

    const wrapper = mount(ProductivityMemberCard, {
      props: { member: memberWithoutPoints }
    });

    expect(wrapper.text()).toContain('Story Points');
    expect(wrapper.text()).toContain('N/A');
  });

  it('should display N/A for missing cycle time', () => {
    const memberWithoutCycleTime = {
      ...mockMember,
      avgCycleTimeDays: null
    };

    const wrapper = mount(ProductivityMemberCard, {
      props: { member: memberWithoutCycleTime }
    });

    expect(wrapper.text()).toContain('Avg Cycle Time');
    expect(wrapper.text()).toContain('N/A');
  });

  it('should apply correct role badge classes for QE', () => {
    const qeMember = {
      ...mockMember,
      specialty: 'QE'
    };

    const wrapper = mount(ProductivityMemberCard, {
      props: { member: qeMember }
    });

    const badge = wrapper.find('.bg-purple-100');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('QE');
  });

  it('should apply correct role badge classes for Manager', () => {
    const managerMember = {
      ...mockMember,
      specialty: 'Manager'
    };

    const wrapper = mount(ProductivityMemberCard, {
      props: { member: managerMember }
    });

    const badge = wrapper.find('.bg-green-100');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('Manager');
  });

  it('should handle missing data gracefully', () => {
    const minimalMember = {
      name: 'Minimal User',
      specialty: 'Unknown',
      manager: 'Unknown',
      totalIssuesResolved: 0,
      totalStoryPoints: null,
      avgCycleTimeDays: null
    };

    const wrapper = mount(ProductivityMemberCard, {
      props: { member: minimalMember }
    });

    expect(wrapper.find('h3').text()).toBe('Minimal User');
    expect(wrapper.text()).toContain('Unknown');
    expect(wrapper.text()).toContain('0');
  });
});
