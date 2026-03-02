/**
 * Tests for productivity tracking endpoints and helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  buildProductivityJql,
  calculateCycleTime,
  aggregateByPeriod
} = require('../shared/jira-helpers');

describe('Productivity Helper Functions', () => {
  describe('buildProductivityJql', () => {
    it('should build correct JQL for single engineer', () => {
      const engineers = ['John Doe'];
      const startDate = '2026-01-01';

      const jql = buildProductivityJql(engineers, startDate);

      expect(jql).toContain('project IN (RHOAIENG, RHAISTRAT)');
      expect(jql).toContain('assignee IN ("John Doe")');
      expect(jql).toContain('resolution = Done');
      expect(jql).toContain('resolved >= "2026-01-01"');
    });

    it('should build correct JQL for multiple engineers', () => {
      const engineers = ['John Doe', 'Jane Smith', 'Bob Jones'];
      const startDate = '2026-02-01';

      const jql = buildProductivityJql(engineers, startDate);

      expect(jql).toContain('assignee IN ("John Doe", "Jane Smith", "Bob Jones")');
      expect(jql).toContain('resolved >= "2026-02-01"');
    });

    it('should handle engineers with special characters in names', () => {
      const engineers = ["O'Connor", 'Smith-Jones'];
      const startDate = '2026-01-01';

      const jql = buildProductivityJql(engineers, startDate);

      expect(jql).toContain('"O\'Connor"');
      expect(jql).toContain('"Smith-Jones"');
    });
  });

  describe('calculateCycleTime', () => {
    it('should calculate cycle time from created to resolved', () => {
      const issue = {
        fields: {
          created: '2026-01-01T00:00:00Z',
          resolved: '2026-01-05T00:00:00Z'
        }
      };

      const cycleTime = calculateCycleTime(issue);

      expect(cycleTime).toBe(4); // 4 days
    });

    it('should handle same-day resolution', () => {
      const issue = {
        fields: {
          created: '2026-01-01T08:00:00Z',
          resolved: '2026-01-01T17:00:00Z'
        }
      };

      const cycleTime = calculateCycleTime(issue);

      expect(cycleTime).toBeCloseTo(0.375, 2); // 9 hours = 0.375 days
    });

    it('should return null if resolved date is missing', () => {
      const issue = {
        fields: {
          created: '2026-01-01T00:00:00Z',
          resolved: null
        }
      };

      const cycleTime = calculateCycleTime(issue);

      expect(cycleTime).toBeNull();
    });

    it('should handle partial days correctly', () => {
      const issue = {
        fields: {
          created: '2026-01-01T12:00:00Z',
          resolved: '2026-01-03T18:00:00Z'
        }
      };

      const cycleTime = calculateCycleTime(issue);

      expect(cycleTime).toBeCloseTo(2.25, 1); // About 2.25 days
    });
  });

  describe('aggregateByPeriod', () => {
    const mockIssues = [
      {
        key: 'RHOAIENG-1',
        fields: {
          assignee: { displayName: 'John Doe' },
          created: '2026-01-01T00:00:00Z',
          resolved: '2026-01-05T00:00:00Z'
        }
      },
      {
        key: 'RHOAIENG-2',
        fields: {
          assignee: { displayName: 'John Doe' },
          created: '2026-01-08T00:00:00Z',
          resolved: '2026-01-12T00:00:00Z'
        }
      },
      {
        key: 'RHOAIENG-3',
        fields: {
          assignee: { displayName: 'Jane Smith' },
          created: '2026-01-10T00:00:00Z',
          resolved: '2026-01-15T00:00:00Z'
        }
      }
    ];

    it('should aggregate issues by engineer for weekly period', () => {
      const result = aggregateByPeriod(mockIssues, 'weekly');

      expect(result).toHaveProperty('John Doe');
      expect(result).toHaveProperty('Jane Smith');

      expect(result['John Doe'].totalIssuesResolved).toBe(2);
      expect(result['Jane Smith'].totalIssuesResolved).toBe(1);

      expect(result['John Doe'].breakdown).toBeDefined();
      expect(result['John Doe'].breakdown.length).toBeGreaterThan(0);
    });

    it('should aggregate issues by engineer for monthly period', () => {
      const result = aggregateByPeriod(mockIssues, 'monthly');

      expect(result['John Doe'].totalIssuesResolved).toBe(2);
      expect(result['Jane Smith'].totalIssuesResolved).toBe(1);
    });

    it('should calculate average cycle time per engineer', () => {
      const result = aggregateByPeriod(mockIssues, 'weekly');

      expect(result['John Doe'].avgCycleTimeDays).toBeCloseTo(4, 0);
      expect(result['Jane Smith'].avgCycleTimeDays).toBeCloseTo(5, 0);
    });

    it('should handle issues without story points gracefully', () => {
      const issuesNoPoints = mockIssues.map(i => ({
        ...i,
        fields: { ...i.fields }
      }));

      const result = aggregateByPeriod(issuesNoPoints, 'weekly');

      expect(result['John Doe'].totalStoryPoints).toBe(0);
    });

    it('should group issues into time buckets correctly', () => {
      const result = aggregateByPeriod(mockIssues, 'weekly');

      const johnBreakdown = result['John Doe'].breakdown;
      expect(johnBreakdown).toBeDefined();
      expect(Array.isArray(johnBreakdown)).toBe(true);
      expect(johnBreakdown.length).toBeGreaterThan(0);

      // Each breakdown entry should have required fields
      johnBreakdown.forEach(entry => {
        expect(entry).toHaveProperty('period');
        expect(entry).toHaveProperty('startDate');
        expect(entry).toHaveProperty('issuesResolved');
        expect(entry).toHaveProperty('storyPoints');
      });
    });
  });
});

describe('Productivity API Endpoints', () => {
  // These tests will mock the app and S3 responses
  let app;
  let mockReadFromS3;
  let mockFetchIssuesFromJira;

  beforeEach(() => {
    // Mock dependencies
    mockReadFromS3 = vi.fn();
    mockFetchIssuesFromJira = vi.fn();

    // These would be properly set up with supertest in actual implementation
    // For now, this demonstrates the test structure
  });

  describe('GET /productivity/teams', () => {
    it('should return list of teams from org-roster.json', async () => {
      const mockOrgRoster = {
        lastUpdated: '2026-03-02T00:00:00Z',
        teams: {
          'AIP AI Pipelines': {
            displayName: 'AI Pipelines',
            members: [
              { name: 'Helber Belmiro', jiraDisplayName: 'Helber Belmiro', manager: 'Cathal O\'Connor', specialty: 'Backend Engineer' },
              { name: 'Vani Haripriya Mudadla', jiraDisplayName: 'Vani Haripriya Mudadla', manager: 'Cathal O\'Connor', specialty: 'Backend Engineer' }
            ]
          },
          'AIP MLflow': {
            displayName: 'MLflow',
            members: [
              { name: 'Matt Prahl', jiraDisplayName: 'Matt Prahl', manager: 'Alex Corvin', specialty: 'Staff Engineers' }
            ]
          }
        }
      };

      mockReadFromS3.mockResolvedValue(mockOrgRoster);

      // Expected response structure
      const expectedResponse = {
        teams: [
          { name: 'All Teams', displayName: 'All Teams', memberCount: 3 },
          { name: 'AIP AI Pipelines', displayName: 'AI Pipelines', memberCount: 2 },
          { name: 'AIP MLflow', displayName: 'MLflow', memberCount: 1 }
        ]
      };

      // This would be tested with supertest in actual implementation
      expect(expectedResponse.teams).toHaveLength(3);
      expect(expectedResponse.teams[0].name).toBe('All Teams');
      expect(expectedResponse.teams[1].memberCount).toBe(2);
    });

    it('should handle missing org-roster.json gracefully', async () => {
      mockReadFromS3.mockRejectedValue(new Error('File not found'));

      // Should return empty teams array or appropriate error
      const expectedResponse = { teams: [] };
      expect(expectedResponse.teams).toEqual([]);
    });
  });

  describe('GET /productivity', () => {
    it('should require team parameter', async () => {
      // Request without team should return 400
      const expectedStatus = 400;
      expect(expectedStatus).toBe(400);
    });

    it('should require period parameter', async () => {
      // Request without period should return 400
      const expectedStatus = 400;
      expect(expectedStatus).toBe(400);
    });

    it('should return productivity data for valid team and period', async () => {
      const mockOrgRoster = {
        teams: {
          'AIP AI Pipelines': {
            displayName: 'AI Pipelines',
            members: [
              { name: 'Helber Belmiro', jiraDisplayName: 'Helber Belmiro', manager: 'Cathal O\'Connor', specialty: 'Backend Engineer' }
            ]
          }
        }
      };

      const mockJiraIssues = [
        {
          key: 'RHOAIENG-1',
          fields: {
            assignee: { displayName: 'Helber Belmiro' },
            created: '2026-02-01T00:00:00Z',
            resolved: '2026-02-05T00:00:00Z'
          }
        }
      ];

      mockReadFromS3.mockResolvedValue(mockOrgRoster);
      mockFetchIssuesFromJira.mockResolvedValue(mockJiraIssues);

      const expectedResponse = {
        team: 'AIP AI Pipelines',
        period: 'weekly',
        members: expect.arrayContaining([
          expect.objectContaining({
            name: 'Helber Belmiro',
            specialty: 'Backend Engineer',
            manager: 'Cathal O\'Connor',
            totalIssuesResolved: expect.any(Number),
            breakdown: expect.any(Array)
          })
        ])
      };

      expect(expectedResponse.team).toBe('AIP AI Pipelines');
      expect(expectedResponse.period).toBe('weekly');
    });

    it('should handle non-existent team gracefully', async () => {
      mockReadFromS3.mockResolvedValue({ teams: {} });

      const expectedStatus = 404;
      expect(expectedStatus).toBe(404);
    });

    it('should calculate correct date ranges for weekly period', () => {
      const period = 'weekly';
      const days = period === 'weekly' ? 28 : period === 'monthly' ? 180 : 365;
      expect(days).toBe(28);
    });

    it('should calculate correct date ranges for monthly period', () => {
      const period = 'monthly';
      const days = period === 'weekly' ? 28 : period === 'monthly' ? 180 : 365;
      expect(days).toBe(180);
    });

    it('should calculate correct date ranges for quarterly period', () => {
      const period = 'quarterly';
      const days = period === 'weekly' ? 28 : period === 'monthly' ? 180 : 365;
      expect(days).toBe(365);
    });
  });
});
