/**
 * Pure filter logic for the priority view.
 */

/**
 * Check if a single issue matches the given filter state.
 *
 * - Empty criteria arrays are ignored (treated as "no filter on this dimension").
 * - Labels uses ALL semantics: issue must have every specified label.
 * - Other dimensions (teams, components, targetReleases) use ANY semantics.
 * - matchMode 'any' (default): issue matches if ANY active dimension matches (OR).
 * - matchMode 'all': issue matches only if ALL active dimensions match (AND).
 */
export function issueMatchesFilter(issue, filterState) {
  const teams = filterState.teams || []
  const components = filterState.components || []
  const targetReleases = filterState.targetReleases || []
  const labels = filterState.labels || []
  const matchMode = filterState.matchMode || 'any'

  const activeDimensions = []

  if (teams.length > 0) {
    activeDimensions.push(teams.includes(issue.team))
  }

  if (components.length > 0) {
    const issueComponents = issue.components || []
    activeDimensions.push(issueComponents.some(c => components.includes(c)))
  }

  if (targetReleases.length > 0) {
    const issueReleases = issue.targetRelease || []
    activeDimensions.push(
      Array.isArray(issueReleases)
        ? issueReleases.some(r => targetReleases.includes(r))
        : false
    )
  }

  if (labels.length > 0) {
    const issueLabels = issue.labels || []
    activeDimensions.push(labels.every(l => issueLabels.includes(l)))
  }

  // No active dimensions means no filter → match everything
  if (activeDimensions.length === 0) return true

  if (matchMode === 'all') {
    return activeDimensions.every(Boolean)
  }

  // 'any' mode
  return activeDimensions.some(Boolean)
}

/**
 * Filter an array of issues using the given filter state.
 */
export function filterIssues(issues, filterState) {
  return issues.filter(issue => issueMatchesFilter(issue, filterState))
}
