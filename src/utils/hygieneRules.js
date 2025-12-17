/**
 * Hygiene Rules Engine
 * Evaluates issues against project management hygiene policies
 */

// Status group constants
const REFINEMENT_STATUSES = ['Refinement']
const IN_PROGRESS_STATUSES = ['In Progress', 'Review', 'Testing']

/**
 * Check if issue is in Refinement status
 * @param {Object} issue
 * @returns {boolean}
 */
function isInRefinement(issue) {
  return REFINEMENT_STATUSES.includes(issue.status)
}

/**
 * Check if issue is in any In Progress status
 * @param {Object} issue
 * @returns {boolean}
 */
function isInProgress(issue) {
  return IN_PROGRESS_STATUSES.includes(issue.status)
}

/**
 * Calculate days between a date and now
 * @param {string} dateString - ISO 8601 date string
 * @returns {number} Days elapsed (rounded down)
 */
function getDaysSince(dateString) {
  if (!dateString) return 0
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Get days since issue entered current status
 * @param {Object} issue
 * @returns {number}
 */
function getDaysInStatus(issue) {
  return getDaysSince(issue.statusEnteredAt)
}

/**
 * Get days since status summary was last updated
 * @param {Object} issue
 * @returns {number|null}
 */
function getDaysSinceStatusSummaryUpdate(issue) {
  if (!issue.statusSummaryUpdated) return null
  return getDaysSince(issue.statusSummaryUpdated)
}

/**
 * Hygiene Rules Configuration
 * Each rule has:
 * - id: unique identifier
 * - name: short descriptive name
 * - check: function(issue) => boolean (true if violation exists)
 * - message: function(issue) => string (detailed, actionable message)
 */
export const hygieneRules = [
  {
    id: 'stale-refinement',
    name: 'Stale Refinement',
    description: 'Issues shouldn\'t linger in Refinement. If an issue has been in Refinement for more than 21 days, it\'s likely blocked or needs to be descoped. Move it back to Backlog or escalate blockers.',
    check: (issue) => {
      return isInRefinement(issue) && getDaysInStatus(issue) > 21
    },
    message: (issue) => {
      const days = getDaysInStatus(issue)
      return `This issue has been in refinement for ${days} days (max: 21 days). Consider moving it forward or back to backlog.`
    }
  },
  {
    id: 'missing-assignee',
    name: 'Missing Assignee',
    description: 'Every issue in active work (Refinement or In Progress) needs an owner. Assign someone to ensure accountability and clear communication.',
    check: (issue) => {
      return (isInRefinement(issue) || isInProgress(issue)) && !issue.assignee
    },
    message: (issue) => {
      return `This issue is in ${issue.status} but has no assignee. Assign someone to take ownership.`
    }
  },
  {
    id: 'missing-team',
    name: 'Missing Team',
    description: 'Issues in active work must have a team assigned for tracking ownership and workload distribution across the organization.',
    check: (issue) => {
      return (isInRefinement(issue) || isInProgress(issue)) && !issue.team
    },
    message: (issue) => {
      return `This issue is in ${issue.status} but has no team assigned. Set the team field to track ownership.`
    }
  },
  {
    id: 'stale-status-summary',
    name: 'Stale or Missing Status Summary',
    description: 'Status summaries keep stakeholders informed. Update the summary at least weekly.',
    check: (issue) => {
      if (!isInRefinement(issue) && !isInProgress(issue)) {
        return false
      }

      if (issue.statusSummary) {
        // Has summary - check if stale
        const daysSinceUpdate = getDaysSinceStatusSummaryUpdate(issue)
        return daysSinceUpdate !== null && daysSinceUpdate > 7
      } else {
        // No summary - check if been in status > 7 days
        return getDaysInStatus(issue) > 7
      }
    },
    message: (issue) => {
      if (issue.statusSummary) {
        const daysSinceUpdate = getDaysSinceStatusSummaryUpdate(issue)
        return `Status summary hasn't been updated in ${daysSinceUpdate} days. Please provide a recent update on progress.`
      } else {
        const daysInStatus = getDaysInStatus(issue)
        return `This issue has been in ${issue.status} for ${daysInStatus} days without a status summary. Add a summary to communicate progress.`
      }
    }
  },
  {
    id: 'missing-color-status',
    name: 'Missing Color Status',
    description: 'Issues In Progress need a health indicator (Green/Yellow/Red) so leadership can quickly identify items needing attention.',
    check: (issue) => {
      return isInProgress(issue) && !issue.colorStatus
    },
    message: (issue) => {
      return `This issue is in ${issue.status} but has no color status set. Set the color status to indicate health (Red/Yellow/Green).`
    }
  },
  {
    id: 'missing-release-type',
    name: 'Missing Release Type',
    description: 'Features In Progress must specify their release type (GA, Tech Preview, Dev Preview) for accurate release planning and documentation.',
    check: (issue) => {
      return isInProgress(issue) && issue.issueType === 'Feature' && !issue.releaseType
    },
    message: (issue) => {
      return `This feature is in ${issue.status} but has no release type set. Set the release type (GA, Tech Preview, etc.) for planning.`
    }
  },
  {
    id: 'missing-rfe-link',
    name: 'Missing RFE Link',
    description: 'Features should be cloned from an approved RFE to ensure proper product management review and customer traceability. The feature must use a "clones" link type to the RFE; other link types will still trigger this warning.',
    check: (issue) => {
      if (issue.issueType !== 'Feature') return false
      if (!isInRefinement(issue) && !isInProgress(issue)) return false
      return !issue.linkedRfeApproved
    },
    message: (issue) => {
      if (!issue.linkedRfeKey) {
        return 'This feature is not linked to an RFE. Features should be cloned from an approved RFE.'
      }
      return `This feature is linked to RFE ${issue.linkedRfeKey} which is not in Approved status.`
    }
  },
  {
    id: 'premature-release-target',
    name: 'Premature Release Target',
    description: 'Issues in New status shouldn\'t have a target release yet. Target release should only be set after refinement confirms the scope and effort.',
    check: (issue) => {
      return issue.status === 'New' &&
             issue.targetRelease &&
             issue.targetRelease.length > 0
    },
    message: (issue) => {
      return `This feature is in New status but already has a target release set. Target release should only be set after refinement is complete.`
    }
  }
]

/**
 * Evaluate all hygiene rules for an issue
 * @param {Object} issue - Issue object with all required fields
 * @returns {Array<{id: string, name: string, message: string}>} Array of violations
 */
export function evaluateHygiene(issue) {
  return hygieneRules
    .filter(rule => rule.check(issue))
    .map(rule => ({
      id: rule.id,
      name: rule.name,
      message: rule.message(issue)
    }))
}
