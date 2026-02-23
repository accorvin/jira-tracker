/**
 * Hygiene Rules Engine (Shared Module)
 * Evaluates issues against project management hygiene policies.
 * Used by both frontend (via ESM wrapper) and backend Lambda functions.
 *
 * CommonJS format for Lambda compatibility.
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
 * Parse release version string into comparable parts
 * @param {string} release - e.g., "rhoai-3.4-ea1", "rhoai-3.3"
 * @returns {{ major: number, minor: number, suffix: string } | null}
 */
function parseReleaseVersion(release) {
  if (!release) return null
  const match = release.match(/rhoai-(\d+)\.(\d+)(?:-([A-Za-z0-9]+))?/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    suffix: match[3] || ''
  }
}

/**
 * Check if a release is <= 3.4-ea1 (grandfathered for RICE requirement)
 * Grandfathered releases: 3.3 and earlier, 3.4-ea1
 * @param {string} release
 * @returns {boolean}
 */
function isGrandfatheredRelease(release) {
  const parsed = parseReleaseVersion(release)
  if (!parsed) return false

  // Anything before 3.3 is grandfathered
  if (parsed.major < 3) return true
  if (parsed.major === 3 && parsed.minor < 3) return true

  // 3.3.x is grandfathered (any suffix)
  if (parsed.major === 3 && parsed.minor === 3) return true

  // 3.4-ea1 specifically is grandfathered
  if (parsed.major === 3 && parsed.minor === 4 && parsed.suffix === 'ea1') return true

  // Everything else (3.4 GA, 3.5+, etc.) is not grandfathered
  return false
}

/**
 * Hygiene Rules Configuration
 * Each rule has:
 * - id: unique identifier
 * - name: short descriptive name
 * - description: detailed explanation
 * - check: function(issue) => boolean (true if violation exists)
 * - message: function(issue) => string (detailed, actionable message)
 * - enforcement: optional object describing automated enforcement action
 *   - type: 'transition' | 'comment-only'
 *   - targetStatus: target status for transitions
 *   - commentTemplate: comment text to post on the Jira issue
 */
const hygieneRules = [
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
    },
    enforcement: {
      type: 'comment-only',
      commentTemplate: 'This issue has been in Refinement for over 21 days. Please review whether it should move forward, be returned to Backlog, or have blockers escalated.'
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
    },
    enforcement: {
      type: 'transition',
      targetStatus: 'Refinement',
      commentTemplate: 'This issue was moved back to Refinement because it has no assignee. Please assign an owner before progressing.'
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
    },
    enforcement: {
      type: 'comment-only',
      commentTemplate: 'This issue is missing a team assignment. Please set the Team field to ensure proper ownership tracking.'
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
    },
    enforcement: {
      type: 'comment-only',
      commentTemplate: 'The status summary for this issue is missing or stale. Please update the Status Summary field with current progress information.'
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
    },
    enforcement: {
      type: 'comment-only',
      commentTemplate: 'This issue is missing a Color Status (health indicator). Please set it to Green, Yellow, or Red to communicate current health.'
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
    },
    enforcement: {
      type: 'comment-only',
      commentTemplate: 'This feature is missing a Release Type value. Please set it to GA, Tech Preview, or Dev Preview for accurate release planning.'
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
    },
    enforcement: {
      type: 'transition',
      targetStatus: 'Refinement',
      commentTemplate: 'This feature was moved back to Refinement because it is not linked to an approved RFE. Please ensure the feature is cloned from an approved RFE before progressing.'
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
    // No enforcement — display-only rule
  },
  {
    id: 'missing-docs-required',
    name: 'Missing Docs Required',
    description: 'Features In Progress need to specify whether product documentation is required so docs team can plan accordingly.',
    check: (issue) => {
      // Only check for Features in In Progress statuses
      if (issue.issueType !== 'Feature') {
        return false
      }
      if (!isInProgress(issue)) {
        return false
      }
      // Trigger if docsRequired is null, undefined, or "None"
      return !issue.docsRequired || issue.docsRequired === 'None'
    },
    message: (issue) => {
      return `This feature is in ${issue.status} but has no "Product Documentation Required" value set. Set this field to Yes or No.`
    },
    enforcement: {
      type: 'comment-only',
      commentTemplate: 'This feature is missing the "Product Documentation Required" field value. Please set it to Yes or No so the docs team can plan accordingly.'
    }
  },
  {
    id: 'missing-target-end',
    name: 'Missing Target End',
    description: 'Features in Refinement or In Progress must have a Target End date set for planning and tracking purposes.',
    check: (issue) => {
      if (issue.issueType !== 'Feature') return false
      if (!isInRefinement(issue) && !isInProgress(issue)) return false
      return !issue.targetEnd
    },
    message: (issue) => {
      return `This feature is in ${issue.status} but has no Target End date. Set the target end date for planning.`
    },
    enforcement: {
      type: 'comment-only',
      commentTemplate: 'This feature is missing a Target End date. Please set the Target End field for planning and tracking purposes.'
    }
  },
  {
    id: 'missing-rice-score',
    name: 'Missing RICE Score',
    description: 'Features in Refinement must have RICE score set. Features In Progress for releases after 3.4-ea1 also require RICE score.',
    check: (issue) => {
      if (issue.issueType !== 'Feature') return false

      // RICE score is set if riceStatus is 'complete'
      const hasRiceScore = issue.riceStatus === 'complete'
      if (hasRiceScore) return false

      // In Refinement - always required
      if (isInRefinement(issue)) return true

      // In Progress - check grandfathering
      if (isInProgress(issue)) {
        // Get the first target release
        const targetRelease = issue.targetRelease && issue.targetRelease[0]
        // If grandfathered release, no violation
        if (isGrandfatheredRelease(targetRelease)) return false
        // Not grandfathered - violation
        return true
      }

      return false
    },
    message: (issue) => {
      if (isInRefinement(issue)) {
        return 'This feature is in Refinement but has no RICE score. Set Reach, Impact, Confidence, and Effort values.'
      }
      return `This feature is in ${issue.status} and requires RICE score for releases after 3.4-ea1. Set Reach, Impact, Confidence, and Effort values.`
    },
    enforcement: {
      type: 'transition',
      targetStatus: 'Refinement',
      commentTemplate: 'This feature was moved back to Refinement because it is missing a complete RICE score. Please set Reach, Impact, Confidence, and Effort values before progressing.'
    }
  }
]

/**
 * Evaluate all hygiene rules for an issue
 * @param {Object} issue - Issue object with all required fields
 * @returns {Array<{id: string, name: string, message: string}>} Array of violations
 */
function evaluateHygiene(issue) {
  return hygieneRules
    .filter(rule => rule.check(issue))
    .map(rule => ({
      id: rule.id,
      name: rule.name,
      message: rule.message(issue)
    }))
}

/**
 * Get only the rules that have enforcement configured
 * @returns {Array} Rules with enforcement metadata
 */
function getEnforceableRules() {
  return hygieneRules.filter(rule => rule.enforcement)
}

module.exports = {
  hygieneRules,
  evaluateHygiene,
  getEnforceableRules
}
