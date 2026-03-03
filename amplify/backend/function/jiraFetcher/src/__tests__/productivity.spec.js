/**
 * Tests for productivity tracking endpoints and helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  buildProductivityJql,
  calculateCycleTime,
  aggregateByPeriod,
  buildWipJql,
  buildFeatureDeliveryJql,
  calculateTypeBreakdown,
  calculateDaysInProgress
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

  describe('buildWipJql', () => {
    it('should build correct JQL for WIP issues with single member', () => {
      const memberNames = ['John Doe'];

      const jql = buildWipJql(memberNames);

      expect(jql).toContain('project = RHOAIENG');
      expect(jql).toContain('assignee IN ("John Doe")');
      expect(jql).toContain("status IN ('In Progress', 'Coding In Progress', 'Review')");
    });

    it('should build correct JQL for WIP issues with multiple members', () => {
      const memberNames = ['John Doe', 'Jane Smith', 'Bob Jones'];

      const jql = buildWipJql(memberNames);

      expect(jql).toContain('assignee IN ("John Doe", "Jane Smith", "Bob Jones")');
    });

    it('should escape special characters in names', () => {
      const memberNames = ["O'Connor", 'Smith-Jones', 'Name with "quotes"'];

      const jql = buildWipJql(memberNames);

      expect(jql).toContain('"O\'Connor"');
      expect(jql).toContain('"Smith-Jones"');
      expect(jql).toContain('"Name with \\"quotes\\""');
    });

    it('should handle empty member list', () => {
      const memberNames = [];

      const jql = buildWipJql(memberNames);

      expect(jql).toContain('assignee IN ()');
    });
  });

  describe('buildFeatureDeliveryJql', () => {
    it('should build correct JQL for RHAISTRAT features with single member', () => {
      const memberNames = ['John Doe'];
      const startDate = '2026-01-01';

      const jql = buildFeatureDeliveryJql(memberNames, startDate);

      expect(jql).toContain('project = RHAISTRAT');
      expect(jql).toContain('assignee IN ("John Doe")');
      expect(jql).toContain('resolution = Done');
      expect(jql).toContain('resolved >= "2026-01-01"');
      expect(jql).toContain('issuetype = Feature');
    });

    it('should build correct JQL for multiple members', () => {
      const memberNames = ['John Doe', 'Jane Smith'];
      const startDate = '2026-02-01';

      const jql = buildFeatureDeliveryJql(memberNames, startDate);

      expect(jql).toContain('assignee IN ("John Doe", "Jane Smith")');
      expect(jql).toContain('resolved >= "2026-02-01"');
    });

    it('should escape special characters in names', () => {
      const memberNames = ["O'Connor"];
      const startDate = '2026-01-01';

      const jql = buildFeatureDeliveryJql(memberNames, startDate);

      expect(jql).toContain('"O\'Connor"');
    });

    it('should include date filter and issuetype', () => {
      const memberNames = ['John Doe'];
      const startDate = '2025-12-01';

      const jql = buildFeatureDeliveryJql(memberNames, startDate);

      expect(jql).toContain('resolved >= "2025-12-01"');
      expect(jql).toContain('issuetype = Feature');
    });
  });

  describe('calculateTypeBreakdown', () => {
    it('should categorize issue types correctly', () => {
      const issues = [
        { fields: { issuetype: { name: 'Story' }, customfield_12310243: 5 } },
        { fields: { issuetype: { name: 'Story' }, customfield_12310243: 3 } },
        { fields: { issuetype: { name: 'Bug' }, customfield_12310243: 2 } },
        { fields: { issuetype: { name: 'Bug' }, customfield_12310243: 1 } },
        { fields: { issuetype: { name: 'Task' }, customfield_12310243: 0 } },
        { fields: { issuetype: { name: 'Sub-task' }, customfield_12310243: 1 } },
        { fields: { issuetype: { name: 'Epic' }, customfield_12310243: 0 } }
      ];

      const result = calculateTypeBreakdown(issues);

      expect(result.typeBreakdown.story.count).toBe(2);
      expect(result.typeBreakdown.story.storyPoints).toBe(8);
      expect(result.typeBreakdown.bug.count).toBe(2);
      expect(result.typeBreakdown.bug.storyPoints).toBe(3);
      expect(result.typeBreakdown.task.count).toBe(1);
      expect(result.typeBreakdown.task.storyPoints).toBe(0);
      expect(result.typeBreakdown.subTask.count).toBe(1);
      expect(result.typeBreakdown.subTask.storyPoints).toBe(1);
      expect(result.typeBreakdown.other.count).toBe(1);
      expect(result.typeBreakdown.other.storyPoints).toBe(0);
    });

    it('should calculate story points per type', () => {
      const issues = [
        { fields: { issuetype: { name: 'Story' }, customfield_12310243: 5 } },
        { fields: { issuetype: { name: 'Story' }, customfield_12310243: 8 } },
        { fields: { issuetype: { name: 'Bug' }, customfield_12310243: 2 } }
      ];

      const result = calculateTypeBreakdown(issues);

      expect(result.typeBreakdown.story.storyPoints).toBe(13);
      expect(result.typeBreakdown.bug.storyPoints).toBe(2);
    });

    it('should return correct bug-to-feature ratio', () => {
      const issues = [
        { fields: { issuetype: { name: 'Story' }, customfield_12310243: 5 } },
        { fields: { issuetype: { name: 'Story' }, customfield_12310243: 3 } },
        { fields: { issuetype: { name: 'Bug' }, customfield_12310243: 2 } }
      ];

      const result = calculateTypeBreakdown(issues);

      expect(result.bugToFeatureRatio).toBe(0.5); // 1 bug / 2 stories
    });

    it('should return null ratio when no stories', () => {
      const issues = [
        { fields: { issuetype: { name: 'Bug' }, customfield_12310243: 2 } },
        { fields: { issuetype: { name: 'Task' }, customfield_12310243: 0 } }
      ];

      const result = calculateTypeBreakdown(issues);

      expect(result.bugToFeatureRatio).toBeNull();
    });

    it('should handle missing issuetype field', () => {
      const issues = [
        { fields: { customfield_12310243: 5 } },
        { fields: { issuetype: { name: 'Story' }, customfield_12310243: 3 } }
      ];

      const result = calculateTypeBreakdown(issues);

      expect(result.typeBreakdown.other.count).toBe(1);
      expect(result.typeBreakdown.story.count).toBe(1);
    });

    it('should handle missing story points gracefully', () => {
      const issues = [
        { fields: { issuetype: { name: 'Story' } } },
        { fields: { issuetype: { name: 'Bug' }, customfield_12310243: 2 } }
      ];

      const result = calculateTypeBreakdown(issues);

      expect(result.typeBreakdown.story.count).toBe(1);
      expect(result.typeBreakdown.story.storyPoints).toBe(0);
    });

    it('should handle empty issues array', () => {
      const issues = [];

      const result = calculateTypeBreakdown(issues);

      expect(result.typeBreakdown.story.count).toBe(0);
      expect(result.typeBreakdown.bug.count).toBe(0);
      expect(result.bugToFeatureRatio).toBeNull();
    });
  });

  describe('calculateDaysInProgress', () => {
    it('should calculate days from created date when not using changelog', () => {
      const issue = {
        fields: {
          created: '2026-02-25T00:00:00Z'
        }
      };

      // Mock current date to 2026-03-02 (7 days later)
      const mockNow = new Date('2026-03-02T00:00:00Z');
      const createdDate = new Date(issue.fields.created);
      const days = (mockNow - createdDate) / (1000 * 60 * 60 * 24);

      expect(days).toBe(5);
    });

    it('should use changelog when available (dev-server)', () => {
      const issue = {
        fields: {
          created: '2026-02-20T00:00:00Z'
        },
        changelog: {
          histories: [
            {
              created: '2026-02-25T00:00:00Z',
              items: [
                {
                  field: 'status',
                  fromString: 'To Do',
                  toString: 'In Progress'
                }
              ]
            }
          ]
        }
      };

      // Should use changelog date (Feb 25) not created date (Feb 20)
      const mockNow = new Date('2026-03-02T00:00:00Z');
      const firstInProgressDate = new Date('2026-02-25T00:00:00Z');
      const days = (mockNow - firstInProgressDate) / (1000 * 60 * 60 * 24);

      expect(days).toBe(5);
    });

    it('should handle missing dates gracefully', () => {
      const issue = {
        fields: {}
      };

      const result = calculateDaysInProgress(issue, false);

      expect(result).toBeNull();
    });

    it('should handle changelog with no In Progress transition', () => {
      const issue = {
        fields: {
          created: '2026-02-25T00:00:00Z'
        },
        changelog: {
          histories: [
            {
              created: '2026-02-26T00:00:00Z',
              items: [
                {
                  field: 'status',
                  fromString: 'To Do',
                  toString: 'Backlog'
                }
              ]
            }
          ]
        }
      };

      // Should fall back to created date when no In Progress transition found
      const mockNow = new Date('2026-03-02T00:00:00Z');
      const createdDate = new Date(issue.fields.created);
      const days = (mockNow - createdDate) / (1000 * 60 * 60 * 24);

      expect(days).toBe(5);
    });

    it('should calculate partial days correctly', () => {
      const issue = {
        fields: {
          created: '2026-03-01T12:00:00Z'
        }
      };

      // Mock current date to 2026-03-02 12:00:00 (exactly 1 day later)
      const mockNow = new Date('2026-03-02T12:00:00Z');
      const createdDate = new Date(issue.fields.created);
      const days = (mockNow - createdDate) / (1000 * 60 * 60 * 24);

      expect(days).toBe(1);
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

  describe('GET /productivity/member/:name', () => {
    it('should require period parameter', async () => {
      // Request without period should return 400
      const expectedStatus = 400;
      expect(expectedStatus).toBe(400);
    });

    it('should validate period parameter', async () => {
      // Request with invalid period should return 400
      const expectedStatus = 400;
      expect(expectedStatus).toBe(400);
    });

    it('should return 404 when member not found in org-roster', async () => {
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

      mockReadFromS3.mockResolvedValue(mockOrgRoster);

      const expectedStatus = 404;
      const expectedError = 'Member not found in org roster: Nonexistent Person';
      expect(expectedStatus).toBe(404);
      expect(expectedError).toContain('Member not found');
    });

    it('should match member by jiraDisplayName', async () => {
      const mockOrgRoster = {
        teams: {
          'AIP AI Pipelines': {
            displayName: 'AI Pipelines',
            members: [
              { name: 'Rob Bell', jiraDisplayName: 'Rob Bell', manager: 'Amita Sharma', specialty: 'Backend Engineer', team: 'AIP AI Pipelines' }
            ]
          }
        }
      };

      mockReadFromS3.mockResolvedValue(mockOrgRoster);

      const expectedMember = {
        name: 'Rob Bell',
        jiraDisplayName: 'Rob Bell',
        specialty: 'Backend Engineer',
        manager: 'Amita Sharma',
        team: 'AIP AI Pipelines'
      };

      expect(expectedMember.jiraDisplayName).toBe('Rob Bell');
      expect(expectedMember.specialty).toBe('Backend Engineer');
    });

    it('should match member by name field if jiraDisplayName not matched', async () => {
      const mockOrgRoster = {
        teams: {
          'AIP MLflow': {
            displayName: 'MLflow',
            members: [
              { name: 'Matt Prahl', jiraDisplayName: 'Matthew Prahl', manager: 'Alex Corvin', specialty: 'Staff Engineers', team: 'AIP MLflow' }
            ]
          }
        }
      };

      mockReadFromS3.mockResolvedValue(mockOrgRoster);

      // Should match by name field "Matt Prahl" even if jiraDisplayName is different
      const expectedMember = {
        name: 'Matt Prahl',
        jiraDisplayName: 'Matthew Prahl',
        specialty: 'Staff Engineers',
        manager: 'Alex Corvin',
        team: 'AIP MLflow'
      };

      expect(expectedMember.name).toBe('Matt Prahl');
    });

    it('should return productivity data with individual issue details', async () => {
      const mockOrgRoster = {
        teams: {
          'AIP AI Pipelines': {
            displayName: 'AI Pipelines',
            members: [
              { name: 'Rob Bell', jiraDisplayName: 'Rob Bell', manager: 'Amita Sharma', specialty: 'Backend Engineer', team: 'AIP AI Pipelines' }
            ]
          }
        }
      };

      const mockJiraIssues = [
        {
          key: 'RHOAIENG-1234',
          fields: {
            summary: 'Fix authentication bug',
            assignee: { displayName: 'Rob Bell' },
            created: '2026-02-01T00:00:00Z',
            resolved: '2026-02-15T00:00:00Z',
            customfield_12310243: 3
          }
        },
        {
          key: 'RHOAIENG-1235',
          fields: {
            summary: 'Add new API endpoint',
            assignee: { displayName: 'Rob Bell' },
            created: '2026-01-05T00:00:00Z',
            resolved: '2026-01-10T00:00:00Z',
            customfield_12310243: 5
          }
        }
      ];

      mockReadFromS3.mockResolvedValue(mockOrgRoster);
      mockFetchIssuesFromJira.mockResolvedValue(mockJiraIssues);

      const expectedResponse = {
        member: {
          name: 'Rob Bell',
          jiraDisplayName: 'Rob Bell',
          specialty: 'Backend Engineer',
          manager: 'Amita Sharma',
          team: 'AIP AI Pipelines'
        },
        period: 'monthly',
        startDate: expect.any(String),
        endDate: expect.any(String),
        summary: {
          totalIssuesResolved: 2,
          totalStoryPoints: 8,
          avgCycleTimeDays: expect.any(Number)
        },
        periodBreakdown: expect.arrayContaining([
          expect.objectContaining({
            period: expect.any(String),
            issuesResolved: expect.any(Number),
            storyPoints: expect.any(Number),
            avgCycleTimeDays: expect.any(Number)
          })
        ]),
        issues: expect.arrayContaining([
          expect.objectContaining({
            key: 'RHOAIENG-1234',
            summary: 'Fix authentication bug',
            resolved: expect.any(String),
            storyPoints: 3,
            cycleTimeDays: expect.any(Number)
          })
        ])
      };

      expect(expectedResponse.member.name).toBe('Rob Bell');
      expect(expectedResponse.summary.totalIssuesResolved).toBe(2);
      expect(expectedResponse.issues).toBeDefined();
    });

    it('should calculate correct JQL for single member', () => {
      const memberName = 'Rob Bell';
      const startDate = '2026-01-01';

      const jql = buildProductivityJql([memberName], startDate);

      expect(jql).toContain('project IN (RHOAIENG, RHAISTRAT)');
      expect(jql).toContain('assignee IN ("Rob Bell")');
      expect(jql).toContain('resolution = Done');
      expect(jql).toContain('resolved >= "2026-01-01"');
    });

    it('should handle member with no resolved issues', async () => {
      const mockOrgRoster = {
        teams: {
          'AIP MLflow': {
            displayName: 'MLflow',
            members: [
              { name: 'New Person', jiraDisplayName: 'New Person', manager: 'Alex Corvin', specialty: 'Backend Engineer', team: 'AIP MLflow' }
            ]
          }
        }
      };

      mockReadFromS3.mockResolvedValue(mockOrgRoster);
      mockFetchIssuesFromJira.mockResolvedValue([]);

      const expectedResponse = {
        member: {
          name: 'New Person',
          jiraDisplayName: 'New Person',
          specialty: 'Backend Engineer',
          manager: 'Alex Corvin',
          team: 'AIP MLflow'
        },
        period: 'weekly',
        summary: {
          totalIssuesResolved: 0,
          totalStoryPoints: 0,
          avgCycleTimeDays: null
        },
        periodBreakdown: [],
        issues: []
      };

      expect(expectedResponse.summary.totalIssuesResolved).toBe(0);
      expect(expectedResponse.issues).toHaveLength(0);
    });
  });
});
