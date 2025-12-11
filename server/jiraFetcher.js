/**
 * Jira Issue Fetcher
 * Fetches issues from Jira REST API and writes to public/issues.json
 */
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Configuration constants matching the Python script
 */
const JIRA_HOST = 'https://issues.redhat.com'
const PROJECTS = ['RHAISTRAT', 'RHOAIENG']
const COMPONENTS = [
  'Fine Tuning',
  'KubeRay',
  'Feature Store',
  'Training Ray',
  'Training Kubeflow',
  'AI Pipelines'
]
const ISSUE_TYPES = ['Feature', 'Initiative']

/**
 * Custom field mappings (Jira internal ID -> human readable name)
 */
const CUSTOM_FIELDS = {
  team: 'customfield_12313240',
  releaseType: 'customfield_12320840',
  targetRelease: 'customfield_12319940',
  statusSummary: 'customfield_12320841',
  colorStatus: 'customfield_12320845'
}

/**
 * Read Jira authentication token from ~/.jira-token
 * @returns {Promise<string>} The token string
 * @throws {Error} If token file doesn't exist
 */
async function readJiraToken() {
  const tokenPath = path.join(os.homedir(), '.jira-token')
  try {
    const token = await fs.readFile(tokenPath, 'utf-8')
    return token.trim()
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Token file not found: ${tokenPath}. Please create ~/.jira-token with your Jira API token.`)
    }
    throw error
  }
}

/**
 * Build JQL query string matching Python script logic
 * @param {string} targetRelease - Target release version (e.g., 'rhoai-3.2')
 * @returns {string} JQL query
 */
function buildJqlQuery(targetRelease) {
  const projectFilter = `project IN (${PROJECTS.join(', ')})`
  const componentFilter = `component IN (${COMPONENTS.map(c => `'${c}'`).join(', ')})`
  const issueTypeFilter = `issuetype IN (${ISSUE_TYPES.join(', ')})`
  const targetVersionFilter = `"Target Version" = ${targetRelease}`

  return `${projectFilter} AND ${componentFilter} AND ${issueTypeFilter} AND ${targetVersionFilter}`
}

/**
 * Fetch issues from Jira REST API with pagination
 * @param {string} token - Jira API token
 * @param {string} targetRelease - Target release version (e.g., 'rhoai-3.2')
 * @returns {Promise<Array>} Array of raw issue objects
 */
async function fetchIssuesFromJira(token, targetRelease) {
  const jql = buildJqlQuery(targetRelease)
  const fields = [
    'key',
    'summary',
    'issuetype',
    'assignee',
    'status',
    CUSTOM_FIELDS.team,
    CUSTOM_FIELDS.releaseType,
    CUSTOM_FIELDS.targetRelease,
    CUSTOM_FIELDS.statusSummary,
    CUSTOM_FIELDS.colorStatus
  ].join(',')

  const issues = []
  let startAt = 0
  const maxResults = 100

  while (true) {
    const url = new URL(`${JIRA_HOST}/rest/api/2/search`)
    url.searchParams.set('jql', jql)
    url.searchParams.set('startAt', startAt.toString())
    url.searchParams.set('maxResults', maxResults.toString())
    url.searchParams.set('fields', fields)
    url.searchParams.set('expand', 'changelog,renderedFields')

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Jira API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    if (!data.issues || data.issues.length === 0) {
      break
    }

    issues.push(...data.issues)

    if (data.issues.length < maxResults) {
      break
    }

    startAt += maxResults
  }

  return issues
}

/**
 * Extract the most recent Status Summary update date from changelog
 * @param {Object} issue - Raw Jira issue with changelog
 * @returns {string|null} ISO 8601 timestamp or null
 */
function getStatusSummaryUpdatedDate(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null
  }

  let mostRecentDate = null

  for (const history of issue.changelog.histories) {
    for (const item of history.items) {
      if (item.field === 'Status Summary' || item.field === CUSTOM_FIELDS.statusSummary) {
        // Convert Jira timestamp format to ISO 8601 with Z
        // Jira format: '2025-12-10T16:45:30.123+0000'
        let timestamp = history.created
        if (timestamp.includes('+')) {
          timestamp = timestamp.split('.')[0] + 'Z'
        } else if (timestamp.includes('T') && timestamp.length > 19) {
          timestamp = timestamp.substring(0, 19) + 'Z'
        }
        mostRecentDate = timestamp
      }
    }
  }

  return mostRecentDate
}

/**
 * Extract field value, handling Jira's nested object structure
 * @param {*} fieldValue - Raw field value from Jira
 * @returns {string|null} Serialized string value
 */
function serializeField(fieldValue) {
  if (fieldValue === null || fieldValue === undefined) {
    return null
  }
  if (typeof fieldValue === 'string') {
    return fieldValue
  }
  if (Array.isArray(fieldValue)) {
    if (fieldValue.length === 0) {
      return null
    }
    const firstItem = fieldValue[0]
    if (firstItem && firstItem.name) {
      return firstItem.name
    }
    return String(firstItem)
  }
  if (fieldValue.name) {
    return fieldValue.name
  }
  if (fieldValue.value) {
    return fieldValue.value
  }
  return String(fieldValue)
}

/**
 * Extract field value as array of strings
 * @param {*} fieldValue - Raw field value from Jira
 * @returns {string[]|null} Array of string values
 */
function serializeListField(fieldValue) {
  if (fieldValue === null || fieldValue === undefined) {
    return null
  }
  if (typeof fieldValue === 'string') {
    return [fieldValue]
  }
  if (Array.isArray(fieldValue)) {
    if (fieldValue.length === 0) {
      return null
    }
    return fieldValue.map(item => {
      if (item && item.name) {
        return item.name
      }
      return String(item)
    })
  }
  if (fieldValue.name) {
    return [fieldValue.name]
  }
  if (fieldValue.value) {
    return [fieldValue.value]
  }
  return [String(fieldValue)]
}

/**
 * Transform raw Jira issue to our JSON schema
 * @param {Object} issue - Raw Jira issue
 * @returns {Object} Transformed issue matching public/issues.json schema
 */
function transformIssue(issue) {
  const fields = issue.fields
  const renderedFields = issue.renderedFields || {}

  // Use rendered HTML for status summary if available, otherwise fall back to raw
  const statusSummary = renderedFields[CUSTOM_FIELDS.statusSummary] ||
    serializeField(fields[CUSTOM_FIELDS.statusSummary])

  return {
    key: issue.key,
    summary: fields.summary,
    issueType: fields.issuetype?.name || null,
    assignee: fields.assignee?.displayName || null,
    status: fields.status?.name || null,
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    releaseType: serializeField(fields[CUSTOM_FIELDS.releaseType]),
    targetRelease: serializeListField(fields[CUSTOM_FIELDS.targetRelease]),
    statusSummary: statusSummary,
    statusSummaryUpdated: getStatusSummaryUpdatedDate(issue),
    colorStatus: serializeField(fields[CUSTOM_FIELDS.colorStatus]),
    url: `https://issues.redhat.com/browse/${issue.key}`
  }
}

/**
 * Fetch issues for all releases and write to per-release JSON files
 * @param {Array<{name: string}>} releases - Array of release objects
 * @returns {Promise<{success: boolean, results: Array<{release: string, count: number, error?: string}>}>}
 */
export async function fetchAndWriteAllReleases(releases) {
  const results = []

  for (const release of releases) {
    console.log(`\nFetching issues for ${release.name}...`)
    const result = await fetchAndWriteIssues(release.name)
    results.push({
      release: release.name,
      count: result.count,
      error: result.error
    })
  }

  const allSucceeded = results.every(r => !r.error)
  const totalCount = results.reduce((sum, r) => sum + r.count, 0)

  return {
    success: allSucceeded,
    results,
    totalCount
  }
}

/**
 * Main function: Fetch issues from Jira and write to public/issues-{release}.json
 * @param {string} targetRelease - Target release version (e.g., 'rhoai-3.2')
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
export async function fetchAndWriteIssues(targetRelease) {
  try {
    if (!targetRelease) {
      throw new Error('targetRelease parameter is required')
    }

    // Read token
    const token = await readJiraToken()

    // Fetch issues
    console.log(`Fetching issues from Jira for ${targetRelease}...`)
    const rawIssues = await fetchIssuesFromJira(token, targetRelease)

    // Transform issues
    const transformedIssues = rawIssues.map(transformIssue)

    // Build output object
    const output = {
      lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      issues: transformedIssues
    }

    // Write to file
    const outputPath = path.join(__dirname, '..', 'public', `issues-${targetRelease}.json`)
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2))

    console.log(`Wrote ${transformedIssues.length} issues to public/issues-${targetRelease}.json`)

    return { success: true, count: transformedIssues.length }
  } catch (error) {
    console.error('Error fetching issues:', error.message)
    return { success: false, count: 0, error: error.message }
  }
}
