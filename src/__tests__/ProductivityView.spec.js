/**
 * Tests for ProductivityView component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductivityView from '../components/ProductivityView.vue';
import * as api from '../services/api';

vi.mock('../services/api');

describe('ProductivityView', () => {
  let wrapper;

  const mockTeams = [
    { name: 'All Teams', displayName: 'All Teams', memberCount: 20 },
    { name: 'AIP AI Pipelines', displayName: 'AI Pipelines', memberCount: 5 },
    { name: 'AIP MLflow', displayName: 'MLflow', memberCount: 3 },
    { name: 'RHOAI Dashboard', displayName: 'Dashboard', memberCount: 12 }
  ];

  const mockProductivityData = {
    team: 'AIP AI Pipelines',
    period: 'weekly',
    startDate: '2026-02-03T00:00:00Z',
    endDate: '2026-03-02T23:59:59Z',
    members: [
      {
        name: 'Helber Belmiro',
        specialty: 'Backend Engineer',
        manager: 'Cathal O\'Connor',
        team: 'AIP AI Pipelines',
        totalIssuesResolved: 12,
        totalStoryPoints: 34,
        avgCycleTimeDays: 4.2,
        breakdown: [
          { period: 'Week of 2026-02-24', startDate: '2026-02-24', issuesResolved: 3, storyPoints: 8, avgCycleTimeDays: 3.5 },
          { period: 'Week of 2026-02-17', startDate: '2026-02-17', issuesResolved: 4, storyPoints: 11, avgCycleTimeDays: 4.1 }
        ]
      },
      {
        name: 'Vani Haripriya Mudadla',
        specialty: 'Backend Engineer',
        manager: 'Cathal O\'Connor',
        team: 'AIP AI Pipelines',
        totalIssuesResolved: 8,
        totalStoryPoints: 21,
        avgCycleTimeDays: 5.1,
        breakdown: []
      },
      {
        name: 'John Manager',
        specialty: 'Manager',
        manager: 'Alex Corvin',
        team: 'AIP AI Pipelines',
        totalIssuesResolved: 2,
        totalStoryPoints: null,
        avgCycleTimeDays: 3.0,
        breakdown: []
      }
    ]
  };

  beforeEach(() => {
    // Clear mocks
    vi.clearAllMocks();

    // Setup default mock responses
    api.getProductivityTeams.mockResolvedValue({ teams: mockTeams });
    api.getProductivityData.mockResolvedValue(mockProductivityData);

    // Clear localStorage
    localStorage.clear();

    // Reset URL
    window.history.replaceState({}, '', '/');
  });

  describe('Component Mounting and Initialization', () => {
    it('should fetch teams list on mount', async () => {
      wrapper = mount(ProductivityView);

      // Wait for async operations
      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(api.getProductivityTeams).toHaveBeenCalled();
      expect(wrapper.vm.availableTeams).toEqual(mockTeams);
    });

    it('should auto-select first team if none selected', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.vm.selectedTeam).toBe('All Teams');
    });

    it('should not auto-select if team is in localStorage', async () => {
      localStorage.setItem('productivity-filters', JSON.stringify({
        team: 'AIP MLflow',
        period: 'monthly'
      }));

      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();

      expect(wrapper.vm.selectedTeam).toBe('AIP MLflow');
      expect(wrapper.vm.timePeriod).toBe('monthly');
    });

    it('should restore filters from URL parameters', async () => {
      window.history.replaceState({}, '', '/?team=AIP%20MLflow&period=quarterly');

      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();

      expect(wrapper.vm.selectedTeam).toBe('AIP MLflow');
      expect(wrapper.vm.timePeriod).toBe('quarterly');
    });
  });

  describe('Data Fetching', () => {
    it('should fetch productivity data when team is selected', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(api.getProductivityData).toHaveBeenCalledWith('All Teams', 'weekly');
      expect(wrapper.vm.productivityData).toEqual(mockProductivityData.members);
    });

    it('should refetch data when time period changes', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Clear previous calls
      api.getProductivityData.mockClear();

      // Change time period
      wrapper.vm.$data.timePeriod = 'monthly';
      await wrapper.vm.$nextTick();

      expect(api.getProductivityData).toHaveBeenCalledWith('All Teams', 'monthly');
    });

    it('should refetch data when selected team changes', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Clear previous calls
      api.getProductivityData.mockClear();

      // Select different team
      wrapper.vm.selectTeam('AIP MLflow');
      await wrapper.vm.$nextTick();

      expect(api.getProductivityData).toHaveBeenCalledWith('AIP MLflow', 'weekly');
    });

    it('should show loading overlay while fetching', async () => {
      // Make the API call hang
      let resolvePromise;
      const hangingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });
      api.getProductivityData.mockReturnValue(hangingPromise);

      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.vm.isLoading).toBe(true);

      // Resolve the hanging promise
      resolvePromise(mockProductivityData);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.isLoading).toBe(false);
    });

    it('should refetch data when isRefreshing prop changes from true to false', async () => {
      wrapper = mount(ProductivityView, {
        props: {
          isRefreshing: false
        }
      });

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Clear previous calls
      api.getProductivityData.mockClear();

      // Simulate refresh cycle
      await wrapper.setProps({ isRefreshing: true });
      await wrapper.vm.$nextTick();

      // Should not fetch while refreshing
      expect(api.getProductivityData).not.toHaveBeenCalled();

      // Complete refresh
      await wrapper.setProps({ isRefreshing: false });
      await wrapper.vm.$nextTick();

      // Should fetch after refresh completes
      expect(api.getProductivityData).toHaveBeenCalled();
    });
  });

  describe('UI Rendering', () => {
    it('should render team sidebar with all teams', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      const teamButtons = wrapper.findAll('button').filter(btn =>
        btn.text().includes('AI Pipelines') ||
        btn.text().includes('MLflow') ||
        btn.text().includes('Dashboard')
      );

      expect(teamButtons.length).toBeGreaterThan(0);
    });

    it('should highlight selected team in sidebar', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Find the selected team button (should be "All Teams")
      const buttons = wrapper.findAll('button');
      const selectedButton = buttons.find(btn => btn.text().includes('All Teams'));

      expect(selectedButton.classes()).toContain('bg-blue-100');
    });

    it('should display summary cards with correct totals', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.vm.totalIssuesResolved).toBe(22); // 12 + 8 + 2
      expect(wrapper.vm.avgIssuesPerMember).toBe('7.3'); // 22 / 3
    });

    it('should display member metrics table', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Set view mode to table
      wrapper.vm.$data.viewMode = 'table';
      await wrapper.vm.$nextTick();

      const table = wrapper.find('table');
      expect(table.exists()).toBe(true);

      // Should have rows for each member
      const rows = wrapper.findAll('tbody tr');
      expect(rows.length).toBe(3);
    });

    it('should show empty state when no team selected', async () => {
      api.getProductivityTeams.mockResolvedValue({ teams: [] });

      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      const emptyMessage = wrapper.text();
      expect(emptyMessage).toContain('Select a team');
    });

    it('should show empty state when no data for selected period', async () => {
      api.getProductivityData.mockResolvedValue({
        team: 'AIP AI Pipelines',
        period: 'weekly',
        members: []
      });

      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      const emptyMessage = wrapper.text();
      expect(emptyMessage).toContain('No resolved issues found');
    });
  });

  describe('Computed Properties', () => {
    it('should calculate totalIssuesResolved correctly', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.vm.totalIssuesResolved).toBe(22);
    });

    it('should calculate avgIssuesPerMember correctly', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.vm.avgIssuesPerMember).toBe('7.3');
    });

    it('should calculate avgCycleTime correctly', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // (4.2 + 5.1 + 3.0) / 3 = 4.1
      expect(wrapper.vm.avgCycleTime).toBe('4.1');
    });

    it('should sort members by issues resolved for chart', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      const sorted = wrapper.vm.sortedByIssues;
      expect(sorted[0].name).toBe('Helber Belmiro'); // 12 issues
      expect(sorted[1].name).toBe('Vani Haripriya Mudadla'); // 8 issues
      expect(sorted[2].name).toBe('John Manager'); // 2 issues
    });
  });

  describe('Filter Persistence', () => {
    it('should save filters to localStorage on change', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      wrapper.vm.selectTeam('AIP MLflow');
      await wrapper.vm.$nextTick();

      const saved = JSON.parse(localStorage.getItem('productivity-filters'));
      expect(saved.team).toBe('AIP MLflow');
    });

    it('should sync filters to URL parameters', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      wrapper.vm.selectTeam('AIP MLflow');
      wrapper.vm.$data.timePeriod = 'monthly';
      await wrapper.vm.$nextTick();

      // URL encoding can be %20 or %2520 depending on environment
      const search = window.location.search;
      expect(search).toMatch(/team=AIP(%20|%2520)MLflow/);
      expect(search).toContain('period=monthly');
    });

    it('should restore both localStorage and URL (URL takes precedence)', async () => {
      localStorage.setItem('productivity-filters', JSON.stringify({
        team: 'AIP AI Pipelines',
        period: 'weekly'
      }));

      window.history.replaceState({}, '', '/?team=AIP%20MLflow&period=quarterly');

      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();

      // URL should take precedence
      expect(wrapper.vm.selectedTeam).toBe('AIP MLflow');
      expect(wrapper.vm.timePeriod).toBe('quarterly');
    });
  });

  describe('View Mode and Role Filtering', () => {
    it('should default to cards view mode', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();

      expect(wrapper.vm.viewMode).toBe('cards');
    });

    it('should toggle between cards and table view', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();

      wrapper.vm.$data.viewMode = 'table';
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.viewMode).toBe('table');
    });

    it('should extract available roles from productivity data', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      const roles = wrapper.vm.availableRoles;
      expect(roles).toContain('Backend Engineer');
      expect(roles).toContain('Manager');
      expect(roles.length).toBe(2);
    });

    it('should filter members by selected roles', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      // Filter by Backend Engineer only
      wrapper.vm.$data.selectedRoles = ['Backend Engineer'];
      await wrapper.vm.$nextTick();

      const filtered = wrapper.vm.filteredData;
      expect(filtered.length).toBe(2); // Only Helber and Vani
      expect(filtered.every(m => m.specialty === 'Backend Engineer')).toBe(true);
    });

    it('should show all members when no role filter is selected', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      wrapper.vm.$data.selectedRoles = [];
      await wrapper.vm.$nextTick();

      const filtered = wrapper.vm.filteredData;
      expect(filtered.length).toBe(3); // All members
    });

    it('should persist viewMode to localStorage', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      wrapper.vm.$data.viewMode = 'table';
      wrapper.vm.saveToLocalStorage();

      const saved = JSON.parse(localStorage.getItem('productivity-filters'));
      expect(saved.viewMode).toBe('table');
    });

    it('should persist selectedRoles to localStorage', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      wrapper.vm.$data.selectedRoles = ['Backend Engineer', 'Manager'];
      wrapper.vm.saveToLocalStorage();

      const saved = JSON.parse(localStorage.getItem('productivity-filters'));
      expect(saved.roles).toEqual(['Backend Engineer', 'Manager']);
    });

    it('should sync viewMode and roles to URL parameters', async () => {
      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      wrapper.vm.$data.viewMode = 'table';
      wrapper.vm.$data.selectedRoles = ['Backend Engineer'];
      wrapper.vm.updateUrlParams();

      const search = window.location.search;
      expect(search).toContain('viewMode=table');
      expect(search).toContain('roles=Backend');
    });

    it('should return correct role badge classes', () => {
      wrapper = mount(ProductivityView);

      expect(wrapper.vm.getRoleBadgeClass('Backend Engineer')).toContain('bg-blue-100');
      expect(wrapper.vm.getRoleBadgeClass('QE')).toContain('bg-purple-100');
      expect(wrapper.vm.getRoleBadgeClass('Manager')).toContain('bg-green-100');
      expect(wrapper.vm.getRoleBadgeClass('Unknown')).toContain('bg-gray-100');
    });
  });

  describe('Error Handling', () => {
    it('should handle team fetch errors gracefully', async () => {
      api.getProductivityTeams.mockRejectedValue(new Error('Network error'));

      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.vm.availableTeams).toEqual([]);
    });

    it('should handle productivity data fetch errors gracefully', async () => {
      api.getProductivityData.mockRejectedValue(new Error('Network error'));

      wrapper = mount(ProductivityView);

      await wrapper.vm.$nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(wrapper.vm.productivityData).toEqual([]);
      expect(wrapper.vm.isLoading).toBe(false);
    });
  });
});
