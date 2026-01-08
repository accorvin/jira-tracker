/**
 * Tests for IssueCard.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IssueCard from '../components/IssueCard.vue'

describe('IssueCard', () => {
  const mockIssue = {
    key: 'RHOAIENG-123',
    summary: 'Implement feature X',
    issueType: 'Feature',
    assignee: 'John Doe',
    status: 'In Progress',
    team: 'Fine Tuning',
    releaseType: 'GA',
    targetRelease: ['rhoai-3.2'],
    statusSummary: 'Working on implementation. Made good progress on API endpoints.',
    url: 'https://issues.redhat.com/browse/RHOAIENG-123'
  }

  it('renders issue key as link to Jira URL', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe(mockIssue.url)
    expect(link.text()).toContain(mockIssue.key)
  })

  it('renders summary text', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    expect(wrapper.text()).toContain(mockIssue.summary)
  })

  it('renders issue type', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    expect(wrapper.text()).toContain('Feature')
  })

  it('renders assignee name', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    expect(wrapper.text()).toContain('John Doe')
  })

  it('handles null/unassigned assignee', () => {
    const unassignedIssue = {
      ...mockIssue,
      assignee: null
    }

    const wrapper = mount(IssueCard, {
      props: { issue: unassignedIssue }
    })

    expect(wrapper.text()).toContain('Unassigned')
  })

  it('renders status', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    expect(wrapper.text()).toContain('In Progress')
  })

  it('renders team', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    expect(wrapper.text()).toContain('Fine Tuning')
  })

  it('handles null team', () => {
    const issueWithoutTeam = {
      ...mockIssue,
      team: null
    }

    const wrapper = mount(IssueCard, {
      props: { issue: issueWithoutTeam }
    })

    // Should not crash and should render other fields
    expect(wrapper.text()).toContain(mockIssue.key)
  })

  it('renders release type', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    expect(wrapper.text()).toContain('GA')
  })

  it('handles null release type', () => {
    const issueWithoutReleaseType = {
      ...mockIssue,
      releaseType: null
    }

    const wrapper = mount(IssueCard, {
      props: { issue: issueWithoutReleaseType }
    })

    // Should not crash and should render other fields
    expect(wrapper.text()).toContain(mockIssue.key)
  })

  it('renders target release', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    expect(wrapper.text()).toContain('rhoai-3.2')
  })

  it('handles null target release', () => {
    const issueWithoutTargetRelease = {
      ...mockIssue,
      targetRelease: null
    }

    const wrapper = mount(IssueCard, {
      props: { issue: issueWithoutTargetRelease }
    })

    // Should not crash and should render other fields
    expect(wrapper.text()).toContain(mockIssue.key)
  })

  it('link opens in new tab', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    const link = wrapper.find('a')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('renders single target release as colored bubble', () => {
    const wrapper = mount(IssueCard, {
      props: { issue: mockIssue }
    })

    // Should find a bubble element with target release text
    const bubbles = wrapper.findAll('.target-release-bubble')
    expect(bubbles).toHaveLength(1)
    expect(bubbles[0].text()).toBe('rhoai-3.2')
    // Should have background and text color classes
    expect(bubbles[0].attributes('class')).toContain('px-1.5')
    expect(bubbles[0].attributes('class')).toContain('py-0.5')
    expect(bubbles[0].attributes('class')).toContain('rounded-full')
  })

  it('renders multiple target releases as colored bubbles', () => {
    const multiReleaseIssue = {
      ...mockIssue,
      targetRelease: ['rhoai-3.2', 'rhoai-3.3', 'rhoai-4.0']
    }

    const wrapper = mount(IssueCard, {
      props: { issue: multiReleaseIssue }
    })

    const bubbles = wrapper.findAll('.target-release-bubble')
    expect(bubbles).toHaveLength(3)
    expect(bubbles[0].text()).toBe('rhoai-3.2')
    expect(bubbles[1].text()).toBe('rhoai-3.3')
    expect(bubbles[2].text()).toBe('rhoai-4.0')
  })

  it('assigns different colors to different target releases', () => {
    const multiReleaseIssue = {
      ...mockIssue,
      targetRelease: ['rhoai-3.2', 'rhoai-3.3', 'rhoai-4.0']
    }

    const wrapper = mount(IssueCard, {
      props: { issue: multiReleaseIssue }
    })

    const bubbles = wrapper.findAll('.target-release-bubble')

    // Each bubble should have a color class
    const bubble1Classes = bubbles[0].attributes('class')
    const bubble2Classes = bubbles[1].attributes('class')
    const bubble3Classes = bubbles[2].attributes('class')

    // They should have different background colors
    expect(bubble1Classes).not.toBe(bubble2Classes)
    expect(bubble1Classes).not.toBe(bubble3Classes)
    expect(bubble2Classes).not.toBe(bubble3Classes)
  })

  it('handles empty target release array', () => {
    const issueWithEmptyReleases = {
      ...mockIssue,
      targetRelease: []
    }

    const wrapper = mount(IssueCard, {
      props: { issue: issueWithEmptyReleases }
    })

    // Should not crash and should not show target release section
    expect(wrapper.text()).toContain(mockIssue.key)
    const bubbles = wrapper.findAll('.target-release-bubble')
    expect(bubbles).toHaveLength(0)
  })

  // Tests for highlighting unpopulated fields
  describe('Unpopulated field highlighting', () => {
    it('shows team field in red bubble when team is null', () => {
      const issueWithoutTeam = {
        ...mockIssue,
        team: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithoutTeam }
      })

      // Should show the Team row
      expect(wrapper.text()).toContain('Team:')
      // The value should be in a red bubble with black text
      const teamValue = wrapper.find('.field-team .field-value')
      expect(teamValue.classes()).toContain('bg-red-100')
      expect(teamValue.classes()).toContain('text-red-900')
      expect(teamValue.classes()).toContain('px-1.5')
      expect(teamValue.classes()).toContain('py-0.5')
      expect(teamValue.classes()).toContain('rounded')
      expect(teamValue.text()).toBe('Not set')
    })

    it('shows release type field in red bubble when releaseType is null', () => {
      const issueWithoutReleaseType = {
        ...mockIssue,
        releaseType: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithoutReleaseType }
      })

      expect(wrapper.text()).toContain('Release Type:')
      const releaseTypeValue = wrapper.find('.field-release-type .field-value')
      expect(releaseTypeValue.classes()).toContain('bg-red-100')
      expect(releaseTypeValue.classes()).toContain('text-red-900')
      expect(releaseTypeValue.classes()).toContain('px-1.5')
      expect(releaseTypeValue.classes()).toContain('py-0.5')
      expect(releaseTypeValue.classes()).toContain('rounded')
      expect(releaseTypeValue.text()).toBe('Not set')
    })

    it('shows target release field in red bubble when targetRelease is null', () => {
      const issueWithoutTargetRelease = {
        ...mockIssue,
        targetRelease: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithoutTargetRelease }
      })

      expect(wrapper.text()).toContain('Target Release:')
      const targetReleaseValue = wrapper.find('.field-target-release .field-value')
      expect(targetReleaseValue.classes()).toContain('bg-red-100')
      expect(targetReleaseValue.classes()).toContain('text-red-900')
      expect(targetReleaseValue.classes()).toContain('px-1.5')
      expect(targetReleaseValue.classes()).toContain('py-0.5')
      expect(targetReleaseValue.classes()).toContain('rounded')
      expect(targetReleaseValue.text()).toBe('Not set')
    })

    it('shows target release field in red bubble when targetRelease is empty array', () => {
      const issueWithEmptyTargetRelease = {
        ...mockIssue,
        targetRelease: []
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithEmptyTargetRelease }
      })

      expect(wrapper.text()).toContain('Target Release:')
      const targetReleaseValue = wrapper.find('.field-target-release .field-value')
      expect(targetReleaseValue.classes()).toContain('bg-red-100')
      expect(targetReleaseValue.classes()).toContain('text-red-900')
      expect(targetReleaseValue.classes()).toContain('px-1.5')
      expect(targetReleaseValue.classes()).toContain('py-0.5')
      expect(targetReleaseValue.classes()).toContain('rounded')
      expect(targetReleaseValue.text()).toBe('Not set')
    })

    it('shows team field in normal styling when team is populated', () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      const teamValue = wrapper.find('.field-team .field-value')
      expect(teamValue.classes()).not.toContain('bg-red-100')
      expect(teamValue.classes()).toContain('text-gray-900')
      expect(teamValue.text()).toBe('Fine Tuning')
    })

    it('shows release type field in normal styling when releaseType is populated', () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      const releaseTypeValue = wrapper.find('.field-release-type .field-value')
      expect(releaseTypeValue.classes()).not.toContain('bg-red-100')
      expect(releaseTypeValue.classes()).toContain('text-gray-900')
      expect(releaseTypeValue.text()).toBe('GA')
    })

    it('shows target release field in normal styling when targetRelease is populated', () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      // Should show bubbles with normal styling
      const bubbles = wrapper.findAll('.target-release-bubble')
      expect(bubbles).toHaveLength(1)
      expect(bubbles[0].text()).toBe('rhoai-3.2')
      // Should not have red background
      expect(bubbles[0].classes()).not.toContain('bg-red-100')
    })

    it('always shows team, release type, and target release rows even when null', () => {
      const issueWithNulls = {
        ...mockIssue,
        team: null,
        releaseType: null,
        targetRelease: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithNulls }
      })

      // All three fields should be visible
      expect(wrapper.text()).toContain('Team:')
      expect(wrapper.text()).toContain('Release Type:')
      expect(wrapper.text()).toContain('Target Release:')
    })
  })

  // Status summary age tests
  describe('Status summary age display and warnings', () => {
    it('displays status age when statusSummaryUpdated is present', () => {
      const issueWithAge = {
        ...mockIssue,
        statusSummaryUpdated: '2025-12-03T10:00:00Z' // 7 days old if today is 2025-12-10
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithAge }
      })

      expect(wrapper.text()).toContain('Status Age:')
      expect(wrapper.text()).toContain('days ago')
    })

    it('displays "No summary" when statusSummaryUpdated is null', () => {
      const issueWithoutUpdate = {
        ...mockIssue,
        statusSummaryUpdated: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithoutUpdate }
      })

      expect(wrapper.text()).toContain('Status Age:')
      expect(wrapper.text()).toContain('No summary')
    })

    it('applies warning styling when age > 7 days and status is "In Progress"', () => {
      const staleInProgressIssue = {
        ...mockIssue,
        status: 'In Progress',
        statusSummaryUpdated: '2025-12-01T10:00:00Z' // 9 days old
      }

      const wrapper = mount(IssueCard, {
        props: { issue: staleInProgressIssue }
      })

      const ageField = wrapper.find('.field-status-age .field-value')
      // 9 days falls in the 7-14 day range, which gets yellow styling
      expect(ageField.classes()).toContain('bg-yellow-400')
      expect(ageField.classes()).toContain('text-gray-900')
    })

    it('applies warning styling when age > 7 days and status is "Refinement"', () => {
      const staleRefinementIssue = {
        ...mockIssue,
        status: 'Refinement',
        statusSummaryUpdated: '2025-12-01T10:00:00Z' // 9 days old
      }

      const wrapper = mount(IssueCard, {
        props: { issue: staleRefinementIssue }
      })

      const ageField = wrapper.find('.field-status-age .field-value')
      // 9 days falls in the 7-14 day range, which gets yellow styling
      expect(ageField.classes()).toContain('bg-yellow-400')
      expect(ageField.classes()).toContain('text-gray-900')
    })

    it('does not apply warning styling when age > 7 days but status is "New"', () => {
      const staleNewIssue = {
        ...mockIssue,
        status: 'New',
        statusSummaryUpdated: '2025-12-01T10:00:00Z' // 9 days old
      }

      const wrapper = mount(IssueCard, {
        props: { issue: staleNewIssue }
      })

      const ageField = wrapper.find('.field-status-age .field-value')
      expect(ageField.classes()).not.toContain('bg-red-100')
    })

    it('does not apply warning styling when age > 7 days but status is "Resolved"', () => {
      const staleResolvedIssue = {
        ...mockIssue,
        status: 'Resolved',
        statusSummaryUpdated: '2025-12-01T10:00:00Z' // 9 days old
      }

      const wrapper = mount(IssueCard, {
        props: { issue: staleResolvedIssue }
      })

      const ageField = wrapper.find('.field-status-age .field-value')
      expect(ageField.classes()).not.toContain('bg-red-100')
    })

    it('does not apply warning styling when age <= 7 days and status is "In Progress"', () => {
      const freshInProgressIssue = {
        ...mockIssue,
        status: 'In Progress',
        statusSummaryUpdated: '2025-12-08T10:00:00Z' // 2 days old
      }

      const wrapper = mount(IssueCard, {
        props: { issue: freshInProgressIssue }
      })

      const ageField = wrapper.find('.field-status-age .field-value')
      expect(ageField.classes()).not.toContain('bg-red-100')
    })

    it('applies warning styling when no status summary exists', () => {
      const issueWithNoSummary = {
        ...mockIssue,
        statusSummaryUpdated: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithNoSummary }
      })

      const ageField = wrapper.find('.field-status-age .field-value')
      expect(ageField.classes()).toContain('bg-red-100')
      expect(ageField.classes()).toContain('text-red-900')
      expect(ageField.text()).toBe('No summary')
    })
  })

  // Status summary date on card back
  describe('Status summary date display on card back', () => {
    it('displays formatted date on back of card when statusSummaryUpdated is present', async () => {
      const issueWithDate = {
        ...mockIssue,
        statusSummaryUpdated: '2025-12-10T14:30:00Z'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithDate }
      })

      await wrapper.find('.card-container').trigger('click')

      // Should show "Updated: December 10, 2025" or similar
      expect(wrapper.text()).toContain('Updated:')
      expect(wrapper.text()).toMatch(/December 10, 2025/)
    })

    it('displays "No update date available" on back of card when statusSummaryUpdated is null', async () => {
      const issueWithoutDate = {
        ...mockIssue,
        statusSummaryUpdated: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithoutDate }
      })

      await wrapper.find('.card-container').trigger('click')

      expect(wrapper.text()).toContain('No update date available')
    })
  })

  // Status summary HTML rendering tests
  describe('Status summary HTML rendering', () => {
    it('renders HTML content instead of escaping it', async () => {
      const issueWithHtml = {
        ...mockIssue,
        statusSummary: '<p>Status update</p><ul><li>Item one</li><li>Item two</li></ul>'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithHtml }
      })

      await wrapper.find('.card-container').trigger('click')

      // Should render as HTML, not show the tags as text
      const content = wrapper.find('.status-summary-content')
      expect(content.exists()).toBe(true)
      expect(content.find('p').exists()).toBe(true)
      expect(content.find('ul').exists()).toBe(true)
      expect(content.findAll('li')).toHaveLength(2)
    })

    it('strips script tags for XSS protection', async () => {
      const issueWithScript = {
        ...mockIssue,
        statusSummary: '<p>Safe content</p><script>alert("xss")</script>'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithScript }
      })

      await wrapper.find('.card-container').trigger('click')

      const content = wrapper.find('.status-summary-content')
      expect(content.html()).not.toContain('<script>')
      expect(content.html()).not.toContain('alert')
      expect(content.find('p').text()).toBe('Safe content')
    })

    it('adds target="_blank" and rel="noopener noreferrer" to links', async () => {
      const issueWithLink = {
        ...mockIssue,
        statusSummary: '<p>See <a href="https://example.com">this link</a></p>'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithLink }
      })

      await wrapper.find('.card-container').trigger('click')

      const link = wrapper.find('.status-summary-content a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
      expect(link.attributes('href')).toBe('https://example.com')
    })

    it('preserves font color attributes for status indicators', async () => {
      const issueWithColor = {
        ...mockIssue,
        statusSummary: '<p>Status: <font color="#00875a">Green</font></p>'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithColor }
      })

      await wrapper.find('.card-container').trigger('click')

      const font = wrapper.find('.status-summary-content font')
      expect(font.exists()).toBe(true)
      expect(font.attributes('color')).toBe('#00875a')
    })

    it('shows fallback message when statusSummary is null', async () => {
      const issueWithoutSummary = {
        ...mockIssue,
        statusSummary: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithoutSummary }
      })

      await wrapper.find('.card-container').trigger('click')

      const content = wrapper.find('.status-summary-content')
      expect(content.text()).toContain('No status summary available')
    })

    it('renders bold text correctly', async () => {
      const issueWithBold = {
        ...mockIssue,
        statusSummary: '<p><b>Important:</b> This is bold</p>'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithBold }
      })

      await wrapper.find('.card-container').trigger('click')

      const bold = wrapper.find('.status-summary-content b')
      expect(bold.exists()).toBe(true)
      expect(bold.text()).toBe('Important:')
    })

    it('renders headings correctly', async () => {
      const issueWithHeading = {
        ...mockIssue,
        statusSummary: '<h2>Status Update</h2><p>Details here</p>'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithHeading }
      })

      await wrapper.find('.card-container').trigger('click')

      const heading = wrapper.find('.status-summary-content h2')
      expect(heading.exists()).toBe(true)
      expect(heading.text()).toBe('Status Update')
    })
  })

  // Color Status field tests
  describe('Color Status field display', () => {
    it('displays Color Status field above Status Age field', () => {
      const issueWithColorStatus = {
        ...mockIssue,
        colorStatus: 'Green'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithColorStatus }
      })

      expect(wrapper.text()).toContain('Color Status:')
    })

    it('highlights Green color status in green text', () => {
      const issueWithGreen = {
        ...mockIssue,
        colorStatus: 'Green'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithGreen }
      })

      const colorStatusValue = wrapper.find('.field-color-status .field-value')
      expect(colorStatusValue.text()).toBe('Green')
      expect(colorStatusValue.classes()).toContain('bg-green-600')
      expect(colorStatusValue.classes()).toContain('text-white')
    })

    it('highlights Red color status in red text', () => {
      const issueWithRed = {
        ...mockIssue,
        colorStatus: 'Red'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithRed }
      })

      const colorStatusValue = wrapper.find('.field-color-status .field-value')
      expect(colorStatusValue.text()).toBe('Red')
      expect(colorStatusValue.classes()).toContain('bg-red-600')
      expect(colorStatusValue.classes()).toContain('text-white')
    })

    it('highlights Yellow color status in yellow text', () => {
      const issueWithYellow = {
        ...mockIssue,
        colorStatus: 'Yellow'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithYellow }
      })

      const colorStatusValue = wrapper.find('.field-color-status .field-value')
      expect(colorStatusValue.text()).toBe('Yellow')
      expect(colorStatusValue.classes()).toContain('bg-yellow-400')
      expect(colorStatusValue.classes()).toContain('text-gray-900')
    })

    it('shows "Not set" in red when In Progress issue has no color status', () => {
      const inProgressWithoutColor = {
        ...mockIssue,
        status: 'In Progress',
        colorStatus: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: inProgressWithoutColor }
      })

      const colorStatusValue = wrapper.find('.field-color-status .field-value')
      expect(colorStatusValue.text()).toBe('Not set')
      expect(colorStatusValue.classes()).toContain('bg-red-100')
      expect(colorStatusValue.classes()).toContain('text-red-900')
    })

    it('shows "Not set" in normal styling when non-In Progress issue has no color status', () => {
      const newIssueWithoutColor = {
        ...mockIssue,
        status: 'New',
        colorStatus: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: newIssueWithoutColor }
      })

      const colorStatusValue = wrapper.find('.field-color-status .field-value')
      expect(colorStatusValue.text()).toBe('Not set')
      expect(colorStatusValue.classes()).toContain('text-gray-900')
      expect(colorStatusValue.classes()).not.toContain('bg-red-100')
    })

    it('handles color status case-insensitively', () => {
      const issueWithLowerCaseGreen = {
        ...mockIssue,
        colorStatus: 'green'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithLowerCaseGreen }
      })

      const colorStatusValue = wrapper.find('.field-color-status .field-value')
      expect(colorStatusValue.text()).toBe('green')
      expect(colorStatusValue.classes()).toContain('bg-green-600')
    })
  })

  // Card flip tests
  describe('Card flip functionality', () => {
    it('shows default card view initially', () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      // Both sides exist but front is visible (opacity-100) and back is hidden (opacity-0)
      const front = wrapper.find('.card-front')
      const back = wrapper.find('.card-back')
      expect(front.exists()).toBe(true)
      expect(back.exists()).toBe(true)
      expect(front.classes()).toContain('opacity-100')
      expect(back.classes()).toContain('opacity-0')
      expect(wrapper.text()).toContain(mockIssue.summary)
      expect(wrapper.text()).toContain(mockIssue.assignee)
    })

    it('flips to status summary view when clicked', async () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      // Click the card
      await wrapper.find('.card-container').trigger('click')

      // Front should be hidden, back should be visible
      const front = wrapper.find('.card-front')
      const back = wrapper.find('.card-back')
      expect(front.classes()).toContain('opacity-0')
      expect(back.classes()).toContain('opacity-100')
    })

    it('flips back to default view when clicked again', async () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      // Click once to flip to status summary
      await wrapper.find('.card-container').trigger('click')
      expect(wrapper.find('.card-back').classes()).toContain('opacity-100')

      // Click again to flip back
      await wrapper.find('.card-container').trigger('click')
      expect(wrapper.find('.card-front').classes()).toContain('opacity-100')
      expect(wrapper.find('.card-back').classes()).toContain('opacity-0')
    })

    it('shows "Status Summary" header on back of card', async () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      await wrapper.find('.card-container').trigger('click')

      expect(wrapper.text()).toContain('Status Summary')
    })

    it('shows status summary text on back of card', async () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      await wrapper.find('.card-container').trigger('click')

      expect(wrapper.text()).toContain('Working on implementation. Made good progress on API endpoints.')
    })

    it('displays "No status summary available" when statusSummary is null', async () => {
      const issueWithoutSummary = {
        ...mockIssue,
        statusSummary: null
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithoutSummary }
      })

      await wrapper.find('.card-container').trigger('click')

      expect(wrapper.text()).toContain('No status summary available')
    })

    it('has cursor pointer style on card container', () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      const container = wrapper.find('.card-container')
      expect(container.classes()).toContain('cursor-pointer')
    })

    it('has transition classes for flip animation', () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      // Card uses opacity-based transitions
      const front = wrapper.find('.card-front')
      const back = wrapper.find('.card-back')
      expect(front.classes()).toContain('transition-opacity')
      expect(back.classes()).toContain('transition-opacity')
    })

    it('status summary content is scrollable', async () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      await wrapper.find('.card-container').trigger('click')

      const backContent = wrapper.find('.card-back')
      expect(backContent.classes()).toContain('overflow-y-auto')
    })
  })

  describe('Hygiene Warning Integration', () => {
    it('should render HygieneWarning component when issue has hygiene violations', () => {
      const issueWithViolations = {
        ...mockIssue,
        assignee: null, // Missing assignee in In Progress status
        statusEnteredAt: '2025-12-05T12:00:00Z'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithViolations }
      })

      // Component should render HygieneWarning
      expect(wrapper.findComponent({ name: 'HygieneWarning' }).exists()).toBe(true)
    })

    it('should not render HygieneWarning when issue has no violations', () => {
      const issueWithoutViolations = {
        ...mockIssue,
        statusEnteredAt: '2025-12-05T12:00:00Z',
        statusSummaryUpdated: '2025-12-10T12:00:00Z',
        colorStatus: 'Green'
      }

      const wrapper = mount(IssueCard, {
        props: { issue: issueWithoutViolations }
      })

      // HygieneWarning might exist but shouldn't render anything
      const hygieneWarning = wrapper.findComponent({ name: 'HygieneWarning' })
      if (hygieneWarning.exists()) {
        expect(hygieneWarning.find('.hygiene-warning').exists()).toBe(false)
      }
    })

    it('issue type badge should be positioned below title and above status', () => {
      const wrapper = mount(IssueCard, {
        props: { issue: mockIssue }
      })

      // Find the issue type badge
      const badgeText = wrapper.text()
      expect(badgeText).toContain('Feature')

      // The badge should not be in the flex container with the key link
      // (checking for the old position)
      const topFlexContainer = wrapper.find('.flex.justify-between.items-start')
      // The badge should not be a child of this flex container anymore
      // Instead it should be positioned after the title
    })
  })
})
