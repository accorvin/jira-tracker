/**
 * Hygiene Rules Engine
 * Evaluates issues against project management hygiene policies.
 *
 * NOTE: A CommonJS copy of this file exists at
 *   amplify/backend/function/jiraFetcher/src/shared/hygieneRules.cjs
 * for Lambda and dev-server consumption. Keep both files in sync
 * when modifying rule definitions.
 */

// Status group constants
const REFINEMENT_STATUSES = ['Refinement']
const IN_PROGRESS_STATUSES = ['In Progress', 'Review', 'Testing']

function isInRefinement(issue) {
  return REFINEMENT_STATUSES.includes(issue.status)
}

function isInProgress(issue) {
  return IN_PROGRESS_STATUSES.includes(issue.status)
}

function getDaysSince(dateString) {
  if (!dateString) return 0
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  return diffDays
}

function getDaysInStatus(issue) {
  return getDaysSince(issue.statusEnteredAt)
}

function getDaysSinceStatusSummaryUpdate(issue) {
  if (!issue.statusSummaryUpdated) return null
  return getDaysSince(issue.statusSummaryUpdated)
}

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

function isGrandfatheredRelease(release) {
  const parsed = parseReleaseVersion(release)
  if (!parsed) return false
  if (parsed.major < 3) return true
  if (parsed.major === 3 && parsed.minor < 3) return true
  if (parsed.major === 3 && parsed.minor === 3) return true
  if (parsed.major === 3 && parsed.minor === 4 && parsed.suffix === 'ea1') return true
  return false
}

export const hygieneRules = [
  {
    id: 'stale-refinement',
    name: 'Stale Refinement',
    description: 'Issues shouldn\'t linger in Refinement. If an issue has been in Refinement for more than 21 days, it\'s likely blocked or needs to be descoped. Move it back to Backlog or escalate blockers.',
    remediation: 'Review the issue and either move it forward to In Progress, return it to Backlog, or escalate any blockers.',
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
    remediation: 'Open the issue in Jira and set the Assignee field to the person responsible for this work.',
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
    remediation: 'Open the issue in Jira and set the Team field to your team name.',
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
    remediation: 'Open the issue in Jira and update the Status Summary field with current progress information.',
    check: (issue) => {
      if (!isInRefinement(issue) && !isInProgress(issue)) {
        return false
      }

      if (issue.statusSummary) {
        const daysSinceUpdate = getDaysSinceStatusSummaryUpdate(issue)
        return daysSinceUpdate !== null && daysSinceUpdate > 7
      } else {
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
    remediation: 'Open the issue in Jira and set the Color Status field to Green, Yellow, or Red based on current health.',
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
    remediation: 'Open the issue in Jira and set the Release Type field to GA, Tech Preview, or Dev Preview.',
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
    remediation: 'Ensure your feature is cloned from an RFE that is in Approved status. Use the "clones" link type when linking to the RFE.',
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
    remediation: 'Remove the target release from this issue until it has been through refinement and scope/effort are confirmed.',
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
    remediation: 'Open the issue in Jira and set the "Product Documentation Required" field to Yes or No.',
    check: (issue) => {
      if (issue.issueType !== 'Feature') {
        return false
      }
      if (!isInProgress(issue)) {
        return false
      }
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
    remediation: 'Open the issue in Jira and set the Target End date field.',
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
    remediation: 'Open the issue in Jira and complete the RICE scoring by setting Reach, Impact, Confidence, and Effort values.',
    check: (issue) => {
      if (issue.issueType !== 'Feature') return false

      const hasRiceScore = issue.riceStatus === 'complete'
      if (hasRiceScore) return false

      if (isInRefinement(issue)) return true

      if (isInProgress(issue)) {
        const targetRelease = issue.targetRelease && issue.targetRelease[0]
        if (isGrandfatheredRelease(targetRelease)) return false
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

export function evaluateHygiene(issue) {
  return hygieneRules
    .filter(rule => rule.check(issue))
    .map(rule => ({
      id: rule.id,
      name: rule.name,
      message: rule.message(issue)
    }))
}

export function getEnforceableRules() {
  return hygieneRules.filter(rule => rule.enforcement)
}
