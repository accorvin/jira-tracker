/**
 * URL synchronization utilities for priority view filters.
 */

const FILTER_PARAMS = ['release', 'teams', 'components', 'labels', 'match']

/**
 * Parse priority filter state from a URL search string.
 * Returns null if no filter params are present.
 */
export function parsePriorityUrlParams(searchString) {
  const params = new URLSearchParams(searchString)

  const hasFilterParam = FILTER_PARAMS.some(p => params.has(p))
  if (!hasFilterParam) return null

  return {
    targetReleases: parseList(params.get('release')),
    teams: parseList(params.get('teams')),
    components: parseList(params.get('components')),
    labels: parseList(params.get('labels')),
    matchMode: params.get('match') || 'any'
  }
}

/**
 * Build a URL search string from filter state, preserving non-filter params.
 * Uses manual encoding to keep commas as literal separators.
 */
export function buildPriorityUrlParams(filterState, existingSearch = '') {
  const params = new URLSearchParams(existingSearch)

  // Remove all filter params first
  for (const key of FILTER_PARAMS) {
    params.delete(key)
  }

  // Collect non-filter params as base
  const parts = []
  for (const [key, value] of params.entries()) {
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  }

  // Add filter params with comma-separated values (commas not encoded)
  if (filterState.targetReleases?.length > 0) {
    parts.push(`release=${filterState.targetReleases.map(encodeURIComponent).join(',')}`)
  }
  if (filterState.teams?.length > 0) {
    parts.push(`teams=${filterState.teams.map(encodeURIComponent).join(',')}`)
  }
  if (filterState.components?.length > 0) {
    parts.push(`components=${filterState.components.map(encodeURIComponent).join(',')}`)
  }
  if (filterState.labels?.length > 0) {
    parts.push(`labels=${filterState.labels.map(encodeURIComponent).join(',')}`)
  }
  if (filterState.matchMode === 'all') {
    parts.push('match=all')
  }

  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

function parseList(value) {
  if (!value) return []
  return value.split(',')
}
