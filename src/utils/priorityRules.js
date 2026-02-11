/**
 * Priority Rules Engine
 * Detects priority violations and rank tier classification
 */

const IN_PROGRESS_STATUSES = ['In Progress', 'Review', 'Testing']
const DONE_STATUSES = ['Resolved', 'Closed']

/**
 * Get rank tier for a given rank position
 * @param {number} rank - 1-based rank position
 * @returns {'top'|'high'|'low'}
 */
export function getRankTier(rank) {
  if (rank <= 25) return 'top'
  if (rank <= 100) return 'high'
  return 'low'
}

/**
 * Detect priority violations across teams.
 * A violation occurs when a team has an in-progress feature ranked lower
 * than an idle feature assigned to the same team.
 * @param {Array} issues - Array of issues with rank, status, and team
 * @returns {Array<{team, inProgressIssue, higherRankedIdleIssue, inProgressRank, idleRank, rankGap}>}
 */
export function detectPriorityViolations(issues) {
  // Group issues by team (skip issues without a team or done issues)
  const teamIssues = {}
  for (const issue of issues) {
    if (!issue.team) continue
    if (DONE_STATUSES.includes(issue.status)) continue
    if (!teamIssues[issue.team]) {
      teamIssues[issue.team] = []
    }
    teamIssues[issue.team].push(issue)
  }

  const violations = []

  for (const [team, teamItems] of Object.entries(teamIssues)) {
    const inProgressItems = teamItems.filter(i => IN_PROGRESS_STATUSES.includes(i.status))
    const idleItems = teamItems.filter(i => !IN_PROGRESS_STATUSES.includes(i.status))

    for (const ipItem of inProgressItems) {
      // Find the highest-ranked idle item for this team
      const higherRankedIdle = idleItems
        .filter(idle => idle.rank < ipItem.rank)
        .sort((a, b) => a.rank - b.rank)[0]

      if (higherRankedIdle) {
        violations.push({
          team,
          inProgressIssue: ipItem,
          higherRankedIdleIssue: higherRankedIdle,
          inProgressRank: ipItem.rank,
          idleRank: higherRankedIdle.rank,
          rankGap: ipItem.rank - higherRankedIdle.rank
        })
      }
    }
  }

  // Sort by rank gap descending
  violations.sort((a, b) => b.rankGap - a.rankGap)

  return violations
}

/**
 * Get issues ranked >100 that are in progress
 * @param {Array} issues - Array of issues with rank and status
 * @returns {Array} Issues ranked >100 and in progress
 */
export function getLowPriorityInProgress(issues) {
  return issues.filter(issue =>
    issue.rank > 100 && IN_PROGRESS_STATUSES.includes(issue.status)
  )
}
