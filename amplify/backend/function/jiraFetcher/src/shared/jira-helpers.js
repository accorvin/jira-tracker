/**
 * Shared Jira helpers — pure functions with no AWS/Firebase dependencies.
 * Used by both the Lambda (app.js) and the local dev server.
 */

const JIRA_HOST = process.env.JIRA_HOST || 'https://issues.redhat.com';
const PLAN_ID = 2423;

const PROJECTS = ['RHAISTRAT', 'RHOAIENG'];
const ISSUE_TYPES = ['Feature', 'Initiative'];

const CUSTOM_FIELDS = {
  team: 'customfield_12313240',
  releaseType: 'customfield_12320840',
  targetRelease: 'customfield_12319940',
  statusSummary: 'customfield_12320841',
  colorStatus: 'customfield_12320845',
  docsRequired: 'customfield_12324040',
  targetEnd: 'customfield_12313942',
  // RICE scoring fields
  reach: 'customfield_12320846',
  impact: 'customfield_12320740',
  confidence: 'customfield_12320847',
  effort: 'customfield_12320848',
  riceScore: 'customfield_12326242'
};

/**
 * Build JQL query string
 * Fetches all features/initiatives for the project and release (no component filter)
 */
function buildJqlQuery(targetRelease) {
  const projectFilter = `project IN (${PROJECTS.join(', ')})`;
  const issueTypeFilter = `issuetype IN (${ISSUE_TYPES.join(', ')})`;
  const targetVersionFilter = `"Target Version" = ${targetRelease}`;

  return `${projectFilter} AND ${issueTypeFilter} AND ${targetVersionFilter}`;
}

/**
 * Build JQL query for intake features (New status, no target release)
 * Fetches all features/initiatives in New status (no component filter)
 */
function buildIntakeFeaturesJqlQuery() {
  const projectFilter = `project IN (${PROJECTS.join(', ')})`;
  const issueTypeFilter = `issuetype IN (${ISSUE_TYPES.join(', ')})`;
  const statusFilter = 'status = New';
  const noTargetRelease = '"Target Version" IS EMPTY';

  return `${projectFilter} AND ${issueTypeFilter} AND ${statusFilter} AND ${noTargetRelease}`;
}

/**
 * Build JQL query for plan rankings
 */
function buildPlanJqlQuery() {
  return `issuekey in issuesInPlan(${PLAN_ID}) ORDER BY Rank ASC`;
}

/**
 * Serialize field value
 */
function serializeField(fieldValue) {
  if (fieldValue === null || fieldValue === undefined) {
    return null;
  }
  if (typeof fieldValue === 'string') {
    return fieldValue;
  }
  if (Array.isArray(fieldValue)) {
    if (fieldValue.length === 0) {
      return null;
    }
    const firstItem = fieldValue[0];
    if (firstItem && firstItem.name) {
      return firstItem.name;
    }
    return String(firstItem);
  }
  if (fieldValue.name) {
    return fieldValue.name;
  }
  if (fieldValue.value) {
    return fieldValue.value;
  }
  return String(fieldValue);
}

/**
 * Serialize list field
 */
function serializeListField(fieldValue) {
  if (fieldValue === null || fieldValue === undefined) {
    return null;
  }
  if (typeof fieldValue === 'string') {
    return [fieldValue];
  }
  if (Array.isArray(fieldValue)) {
    if (fieldValue.length === 0) {
      return null;
    }
    return fieldValue.map(item => {
      if (item && item.name) {
        return item.name;
      }
      return String(item);
    });
  }
  if (fieldValue.name) {
    return [fieldValue.name];
  }
  if (fieldValue.value) {
    return [fieldValue.value];
  }
  return [String(fieldValue)];
}

/**
 * Get Status Summary update date from changelog
 */
function getStatusSummaryUpdatedDate(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }

  let mostRecentDate = null;

  for (const history of issue.changelog.histories) {
    for (const item of history.items) {
      if (item.field === 'Status Summary' || item.field === CUSTOM_FIELDS.statusSummary) {
        let timestamp = history.created;
        if (timestamp.includes('+')) {
          timestamp = timestamp.split('.')[0] + 'Z';
        } else if (timestamp.includes('T') && timestamp.length > 19) {
          timestamp = timestamp.substring(0, 19) + 'Z';
        }
        mostRecentDate = timestamp;
      }
    }
  }

  return mostRecentDate;
}

/**
 * Get most recent status change date from changelog
 */
function getStatusEnteredAtDate(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return issue.fields.created;
  }

  let mostRecentStatusChange = null;

  for (const history of issue.changelog.histories) {
    for (const item of history.items) {
      if (item.field === 'status') {
        let timestamp = history.created;
        if (timestamp.includes('+')) {
          timestamp = timestamp.split('.')[0] + 'Z';
        } else if (timestamp.includes('T') && timestamp.length > 19) {
          timestamp = timestamp.substring(0, 19) + 'Z';
        }
        mostRecentStatusChange = timestamp;
      }
    }
  }

  return mostRecentStatusChange || issue.fields.created;
}

/**
 * Get "clones" links from a feature (links to RFEs)
 */
function getClonesLinks(issue) {
  if (!issue.fields.issuelinks) return [];

  return issue.fields.issuelinks
    .filter(link => {
      return link.type &&
             link.type.outward === 'clones' &&
             link.outwardIssue;
    })
    .map(link => link.outwardIssue.key);
}

/**
 * Extract all RHAIRFE keys from a list of raw issues
 */
function extractRfeKeys(rawIssues) {
  const rfeKeys = new Set();
  for (const issue of rawIssues) {
    const clonesLinks = getClonesLinks(issue);
    for (const key of clonesLinks) {
      if (key.startsWith('RHAIRFE-')) {
        rfeKeys.add(key);
      }
    }
  }
  return Array.from(rfeKeys);
}

/**
 * Compute RICE status for a feature
 * @returns 'complete' | 'partial' | 'none'
 */
function computeRiceStatus(fields) {
  const reach = fields[CUSTOM_FIELDS.reach];
  const impact = fields[CUSTOM_FIELDS.impact];
  const confidence = fields[CUSTOM_FIELDS.confidence];
  const effort = fields[CUSTOM_FIELDS.effort];

  const filledCount = [reach, impact, confidence, effort].filter(v => v != null).length;

  if (filledCount === 4) return 'complete';
  if (filledCount > 0) return 'partial';
  return 'none';
}

/**
 * Transform raw Jira issue
 */
function transformIssue(issue, rfeMap = {}) {
  const fields = issue.fields;
  const renderedFields = issue.renderedFields || {};

  const statusSummary = renderedFields[CUSTOM_FIELDS.statusSummary] ||
    serializeField(fields[CUSTOM_FIELDS.statusSummary]);

  // Extract components as an array of names
  const components = fields.components && Array.isArray(fields.components)
    ? fields.components.map(c => c.name).filter(Boolean)
    : [];

  // Extract labels as an array of strings
  const labels = Array.isArray(fields.labels) ? fields.labels : [];

  // Get clones links for RFE checking
  // Only consider issues from RHAIRFE project as actual RFEs
  const clonesLinks = getClonesLinks(issue);
  let linkedRfeKey = null;
  let linkedRfeApproved = false;

  for (const key of clonesLinks) {
    // Only treat RHAIRFE issues as RFEs
    if (!key.startsWith('RHAIRFE-')) {
      continue;
    }
    linkedRfeKey = key;
    // RFE is in rfeMap only if it was approved (currently or previously)
    if (rfeMap[key]) {
      linkedRfeApproved = true;
      break;
    }
  }

  return {
    key: issue.key,
    summary: fields.summary,
    issueType: fields.issuetype?.name || null,
    assignee: fields.assignee?.displayName || null,
    status: fields.status?.name || null,
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    components: components,
    labels: labels,
    releaseType: serializeField(fields[CUSTOM_FIELDS.releaseType]),
    targetRelease: serializeListField(fields[CUSTOM_FIELDS.targetRelease]),
    statusSummary: statusSummary,
    statusSummaryUpdated: getStatusSummaryUpdatedDate(issue),
    statusEnteredAt: getStatusEnteredAtDate(issue),
    colorStatus: serializeField(fields[CUSTOM_FIELDS.colorStatus]),
    docsRequired: serializeField(fields[CUSTOM_FIELDS.docsRequired]),
    targetEnd: fields[CUSTOM_FIELDS.targetEnd] || null,
    riceScore: fields[CUSTOM_FIELDS.riceScore] || null,
    riceStatus: computeRiceStatus(fields),
    linkedRfeKey: linkedRfeKey,
    linkedRfeApproved: linkedRfeApproved,
    url: `https://issues.redhat.com/browse/${issue.key}`
  };
}

/**
 * Transform a feature for the intake view
 */
function transformIntakeFeature(issue, rfeMap) {
  const fields = issue.fields;
  const clonesLinks = getClonesLinks(issue);

  // Find linked RFE info
  let linkedRfe = null;
  for (const rfeKey of clonesLinks) {
    if (rfeMap[rfeKey]) {
      linkedRfe = rfeMap[rfeKey];
      break; // Use first matching approved RFE
    }
  }

  // Get component (first one)
  const component = fields.components && fields.components.length > 0
    ? fields.components[0].name
    : null;

  return {
    key: issue.key,
    title: fields.summary,
    issueType: fields.issuetype?.name || null,
    assignee: fields.assignee?.displayName || null,
    status: fields.status?.name || null,
    component: component,
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    reach: fields[CUSTOM_FIELDS.reach],
    impact: fields[CUSTOM_FIELDS.impact],
    confidence: fields[CUSTOM_FIELDS.confidence],
    effort: fields[CUSTOM_FIELDS.effort],
    riceScore: fields[CUSTOM_FIELDS.riceScore],
    riceStatus: computeRiceStatus(fields),
    linkedRfe: linkedRfe,
    url: `https://issues.redhat.com/browse/${issue.key}`
  };
}

/**
 * Build the fields list for Jira API queries (release issues)
 */
function buildIssueFields() {
  return [
    'key', 'summary', 'issuetype', 'assignee', 'status', 'created', 'issuelinks', 'components', 'labels',
    CUSTOM_FIELDS.team,
    CUSTOM_FIELDS.releaseType,
    CUSTOM_FIELDS.targetRelease,
    CUSTOM_FIELDS.statusSummary,
    CUSTOM_FIELDS.colorStatus,
    CUSTOM_FIELDS.docsRequired,
    CUSTOM_FIELDS.targetEnd,
    CUSTOM_FIELDS.reach,
    CUSTOM_FIELDS.impact,
    CUSTOM_FIELDS.confidence,
    CUSTOM_FIELDS.effort,
    CUSTOM_FIELDS.riceScore
  ].join(',');
}

/**
 * Build the fields list for intake feature queries
 */
function buildIntakeFields() {
  return [
    'key', 'summary', 'issuetype', 'assignee', 'status', 'created', 'issuelinks', 'components',
    CUSTOM_FIELDS.team,
    CUSTOM_FIELDS.releaseType,
    CUSTOM_FIELDS.targetRelease,
    CUSTOM_FIELDS.reach,
    CUSTOM_FIELDS.impact,
    CUSTOM_FIELDS.confidence,
    CUSTOM_FIELDS.effort,
    CUSTOM_FIELDS.riceScore
  ].join(',');
}

/**
 * Build the fields list for plan ranking queries (same as issue fields)
 */
function buildPlanFields() {
  return buildIssueFields();
}

/**
 * Build the JQL and status filter for fetching approved RFEs by keys
 */
function buildRfeJql(rfeKeys) {
  const keysFilter = `key IN (${rfeKeys.join(', ')})`;
  const statusFilter = 'status IN (Approved, "In Progress", Review, Resolved, Closed)';
  return `project = RHAIRFE AND ${keysFilter} AND ${statusFilter}`;
}

/**
 * Fields to fetch for RFE queries
 */
function buildRfeFields() {
  return ['key', 'summary', 'status', 'components', 'reporter', 'assignee'].join(',');
}

module.exports = {
  JIRA_HOST,
  PLAN_ID,
  PROJECTS,
  ISSUE_TYPES,
  CUSTOM_FIELDS,
  buildJqlQuery,
  buildIntakeFeaturesJqlQuery,
  buildPlanJqlQuery,
  buildRfeJql,
  buildRfeFields,
  serializeField,
  serializeListField,
  getStatusSummaryUpdatedDate,
  getStatusEnteredAtDate,
  getClonesLinks,
  extractRfeKeys,
  computeRiceStatus,
  transformIssue,
  transformIntakeFeature,
  buildIssueFields,
  buildIntakeFields,
  buildPlanFields
};
