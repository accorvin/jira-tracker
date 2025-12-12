/**
 * Tests for jiraFetcher.js - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { getStatusEnteredAtDate } from '../jiraFetcher.js'

// Mock issue structures based on Jira API response format
const createMockIssueWithChangelog = (histories) => ({
  key: 'TEST-123',
  fields: {
    created: '2025-11-01T10:00:00Z',
    summary: 'Test Issue',
    status: { name: 'In Progress' },
    issuetype: { name: 'Feature' }
  },
  changelog: {
    histories: histories || []
  }
})

describe('getStatusEnteredAtDate', () => {
  // We'll need to export this function from jiraFetcher.js
  // For now, we're writing the tests first (TDD)

  it('should return the most recent status change timestamp', () => {
    const issue = createMockIssueWithChangelog([
      {
        created: '2025-11-05T14:30:00.123+0000',
        items: [
          { field: 'status', fromString: 'New', toString: 'Refinement' }
        ]
      },
      {
        created: '2025-11-15T09:15:00.456+0000',
        items: [
          { field: 'status', fromString: 'Refinement', toString: 'In Progress' }
        ]
      }
    ])

    const result = getStatusEnteredAtDate(issue)
    expect(result).toBe('2025-11-15T09:15:00Z')
  })

  it('should handle multiple changelog items and only consider status changes', () => {
    const issue = createMockIssueWithChangelog([
      {
        created: '2025-11-05T14:30:00.123+0000',
        items: [
          { field: 'assignee', fromString: null, toString: 'John Doe' },
          { field: 'status', fromString: 'New', toString: 'Refinement' }
        ]
      },
      {
        created: '2025-11-10T10:00:00.789+0000',
        items: [
          { field: 'summary', fromString: 'Old summary', toString: 'New summary' }
        ]
      },
      {
        created: '2025-11-15T09:15:00.456+0000',
        items: [
          { field: 'status', fromString: 'Refinement', toString: 'In Progress' }
        ]
      }
    ])

    const result = getStatusEnteredAtDate(issue)
    expect(result).toBe('2025-11-15T09:15:00Z')
  })

  it('should fall back to issue created date when no status changes in changelog', () => {
    const issue = createMockIssueWithChangelog([
      {
        created: '2025-11-05T14:30:00.123+0000',
        items: [
          { field: 'assignee', fromString: null, toString: 'John Doe' }
        ]
      }
    ])

    const result = getStatusEnteredAtDate(issue)
    expect(result).toBe('2025-11-01T10:00:00Z')
  })

  it('should fall back to created date when changelog is empty', () => {
    const issue = createMockIssueWithChangelog([])

    const result = getStatusEnteredAtDate(issue)
    expect(result).toBe('2025-11-01T10:00:00Z')
  })

  it('should fall back to created date when changelog is missing', () => {
    const issue = {
      key: 'TEST-123',
      fields: {
        created: '2025-11-01T10:00:00Z',
        summary: 'Test Issue',
        status: { name: 'New' }
      }
      // No changelog property
    }

    const result = getStatusEnteredAtDate(issue)
    expect(result).toBe('2025-11-01T10:00:00Z')
  })

  it('should normalize Jira timestamp format to ISO 8601 with Z', () => {
    const issue = createMockIssueWithChangelog([
      {
        created: '2025-11-15T09:15:00.456+0000',
        items: [
          { field: 'status', fromString: 'New', toString: 'In Progress' }
        ]
      }
    ])

    const result = getStatusEnteredAtDate(issue)
    // Should convert '2025-11-15T09:15:00.456+0000' to '2025-11-15T09:15:00Z'
    expect(result).toBe('2025-11-15T09:15:00Z')
  })

  it('should handle changelog with only the most recent status change', () => {
    const issue = createMockIssueWithChangelog([
      {
        created: '2025-11-20T16:45:30.789+0000',
        items: [
          { field: 'status', fromString: 'In Progress', toString: 'Review' }
        ]
      }
    ])

    const result = getStatusEnteredAtDate(issue)
    expect(result).toBe('2025-11-20T16:45:30Z')
  })
})

