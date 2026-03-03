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

/**
 * Build JQL for productivity tracking queries
 * @param {Array<string>} engineerNames - List of engineer display names
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @returns {string} JQL query
 */
function buildProductivityJql(engineerNames, startDate) {
  // Escape quotes in names and wrap in quotes
  const escapedNames = engineerNames.map(name => {
    const escaped = name.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  const assigneeFilter = `assignee IN (${escapedNames.join(', ')})`;
  const projectFilter = 'project IN (RHOAIENG, RHAISTRAT)';
  const resolutionFilter = 'resolution = Done';
  const dateFilter = `resolved >= "${startDate}"`;

  return `${projectFilter} AND ${assigneeFilter} AND ${resolutionFilter} AND ${dateFilter}`;
}

/**
 * Calculate cycle time for an issue (created -> resolved)
 * @param {Object} issue - Jira issue object
 * @returns {number|null} Cycle time in days, or null if not resolved
 */
function calculateCycleTime(issue) {
  const created = issue.fields.created;
  const resolved = issue.fields.resolved;

  if (!resolved) {
    return null;
  }

  const createdDate = new Date(created);
  const resolvedDate = new Date(resolved);

  const diffMs = resolvedDate - createdDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays;
}

/**
 * Get the start of week for a given date (Monday)
 * @param {Date} date
 * @returns {Date}
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  return new Date(d.setDate(diff));
}

/**
 * Get the start of month for a given date
 * @param {Date} date
 * @returns {Date}
 */
function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get the start of quarter for a given date
 * @param {Date} date
 * @returns {Date}
 */
function getQuarterStart(date) {
  const month = date.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get period bucket key for an issue
 * @param {Date} resolvedDate
 * @param {string} period - 'weekly' | 'monthly' | 'quarterly'
 * @returns {string} Bucket key
 */
function getPeriodBucket(resolvedDate, period) {
  const d = new Date(resolvedDate);

  if (period === 'weekly') {
    const weekStart = getWeekStart(d);
    return `Week of ${formatDate(weekStart)}`;
  } else if (period === 'monthly') {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
  } else if (period === 'quarterly') {
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    return `Q${quarter} ${d.getFullYear()}`;
  }

  return 'Unknown';
}

/**
 * Aggregate issues by engineer and time period
 * @param {Array} issues - Raw Jira issues
 * @param {string} period - 'weekly' | 'monthly' | 'quarterly'
 * @returns {Object} Map of engineer name to aggregated data
 */
function aggregateByPeriod(issues, period) {
  const engineerData = {};

  for (const issue of issues) {
    const engineerName = issue.fields.assignee?.displayName;
    if (!engineerName) continue;

    // Initialize engineer data if not exists
    if (!engineerData[engineerName]) {
      engineerData[engineerName] = {
        name: engineerName,
        totalIssuesResolved: 0,
        totalStoryPoints: 0,
        cycleTimes: [],
        breakdown: {}
      };
    }

    const engineer = engineerData[engineerName];
    const resolvedDate = issue.fields.resolved;
    const cycleTime = calculateCycleTime(issue);

    // Aggregate totals
    engineer.totalIssuesResolved++;
    if (cycleTime !== null) {
      engineer.cycleTimes.push(cycleTime);
    }

    // Story points (if available) - check common custom fields
    const storyPoints = issue.fields.customfield_12310243 ||
                       issue.fields.customfield_12310920 ||
                       issue.fields.storyPoints;
    if (storyPoints) {
      engineer.totalStoryPoints += Number(storyPoints);
    }

    // Breakdown by period
    if (resolvedDate) {
      const bucket = getPeriodBucket(resolvedDate, period);
      if (!engineer.breakdown[bucket]) {
        engineer.breakdown[bucket] = {
          period: bucket,
          startDate: null,
          issuesResolved: 0,
          storyPoints: 0,
          cycleTimes: []
        };
      }

      const bucketData = engineer.breakdown[bucket];
      bucketData.issuesResolved++;
      if (storyPoints) {
        bucketData.storyPoints += Number(storyPoints);
      }
      if (cycleTime !== null) {
        bucketData.cycleTimes.push(cycleTime);
      }

      // Set start date for bucket
      if (!bucketData.startDate) {
        const d = new Date(resolvedDate);
        if (period === 'weekly') {
          bucketData.startDate = formatDate(getWeekStart(d));
        } else if (period === 'monthly') {
          bucketData.startDate = formatDate(getMonthStart(d));
        } else if (period === 'quarterly') {
          bucketData.startDate = formatDate(getQuarterStart(d));
        }
      }
    }
  }

  // Convert breakdown to arrays and calculate averages
  for (const engineerName in engineerData) {
    const engineer = engineerData[engineerName];

    // Calculate average cycle time
    if (engineer.cycleTimes.length > 0) {
      const sum = engineer.cycleTimes.reduce((a, b) => a + b, 0);
      engineer.avgCycleTimeDays = sum / engineer.cycleTimes.length;
    } else {
      engineer.avgCycleTimeDays = null;
    }
    delete engineer.cycleTimes;

    // Convert breakdown to array and calculate bucket averages
    const breakdownArray = Object.values(engineer.breakdown).map(bucket => {
      const avgCycleTime = bucket.cycleTimes.length > 0
        ? bucket.cycleTimes.reduce((a, b) => a + b, 0) / bucket.cycleTimes.length
        : null;

      return {
        period: bucket.period,
        startDate: bucket.startDate,
        issuesResolved: bucket.issuesResolved,
        storyPoints: bucket.storyPoints,
        avgCycleTimeDays: avgCycleTime
      };
    });

    // Sort by start date
    breakdownArray.sort((a, b) => {
      if (!a.startDate || !b.startDate) return 0;
      return new Date(a.startDate) - new Date(b.startDate);
    });

    engineer.breakdown = breakdownArray;
  }

  return engineerData;
}

/**
 * Build JQL for Work In Progress (WIP) issues
 * @param {Array<string>} memberNames - List of member display names
 * @returns {string} JQL query
 */
function buildWipJql(memberNames) {
  // Escape quotes in names and wrap in quotes
  const escapedNames = memberNames.map(name => {
    const escaped = name.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  const assigneeFilter = `assignee IN (${escapedNames.join(', ')})`;
  const projectFilter = 'project = RHOAIENG';
  const statusFilter = "status IN ('In Progress', 'Coding In Progress', 'Review')";

  return `${projectFilter} AND ${assigneeFilter} AND ${statusFilter}`;
}

/**
 * Build JQL for RHAISTRAT feature delivery tracking
 * @param {Array<string>} memberNames - List of member display names
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @returns {string} JQL query
 */
function buildFeatureDeliveryJql(memberNames, startDate) {
  // Escape quotes in names and wrap in quotes
  const escapedNames = memberNames.map(name => {
    const escaped = name.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  const assigneeFilter = `assignee IN (${escapedNames.join(', ')})`;
  const projectFilter = 'project = RHAISTRAT';
  const resolutionFilter = 'resolution = Done';
  const dateFilter = `resolved >= "${startDate}"`;
  const typeFilter = 'issuetype = Feature';

  return `${projectFilter} AND ${assigneeFilter} AND ${resolutionFilter} AND ${dateFilter} AND ${typeFilter}`;
}

/**
 * Calculate issue type breakdown and bug-to-feature ratio
 * @param {Array} issues - Raw Jira issues
 * @returns {Object} Type breakdown and ratio
 */
function calculateTypeBreakdown(issues) {
  const typeBreakdown = {
    story: { count: 0, storyPoints: 0 },
    bug: { count: 0, storyPoints: 0 },
    task: { count: 0, storyPoints: 0 },
    subTask: { count: 0, storyPoints: 0 },
    other: { count: 0, storyPoints: 0 }
  };

  for (const issue of issues) {
    const issueTypeName = issue.fields.issuetype?.name;
    const storyPoints = issue.fields.customfield_12310243 ||
                       issue.fields.customfield_12310920 ||
                       issue.fields.storyPoints ||
                       0;

    // Map Jira issue types to our categories
    let category = 'other';
    if (issueTypeName === 'Story') {
      category = 'story';
    } else if (issueTypeName === 'Bug') {
      category = 'bug';
    } else if (issueTypeName === 'Task') {
      category = 'task';
    } else if (issueTypeName === 'Sub-task') {
      category = 'subTask';
    }

    typeBreakdown[category].count++;
    typeBreakdown[category].storyPoints += Number(storyPoints);
  }

  // Calculate bug-to-feature ratio
  const bugToFeatureRatio = typeBreakdown.story.count > 0
    ? typeBreakdown.bug.count / typeBreakdown.story.count
    : null;

  return { typeBreakdown, bugToFeatureRatio };
}

/**
 * Calculate days an issue has been in progress
 * @param {Object} issue - Jira issue object
 * @param {boolean} useChangelog - If true, use changelog to find first In Progress transition (dev-server)
 * @returns {number|null} Days in progress, or null if cannot determine
 */
function calculateDaysInProgress(issue, useChangelog = false) {
  let startDate = null;

  if (useChangelog && issue.changelog && issue.changelog.histories) {
    // Search for first In Progress status transition
    for (const history of issue.changelog.histories) {
      for (const item of history.items) {
        if (item.field === 'status' &&
            (item.toString === 'In Progress' ||
             item.toString === 'Coding In Progress' ||
             item.toString === 'Review')) {
          let timestamp = history.created;
          // Normalize timestamp
          if (timestamp.includes('+')) {
            timestamp = timestamp.split('.')[0] + 'Z';
          } else if (timestamp.includes('T') && timestamp.length > 19) {
            timestamp = timestamp.substring(0, 19) + 'Z';
          }
          startDate = new Date(timestamp);
          break;
        }
      }
      if (startDate) break;
    }
  }

  // Fall back to created date if no changelog or no In Progress transition found
  if (!startDate && issue.fields.created) {
    startDate = new Date(issue.fields.created);
  }

  if (!startDate) {
    return null;
  }

  const now = new Date();
  const diffMs = now - startDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays;
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
  buildPlanFields,
  buildProductivityJql,
  calculateCycleTime,
  aggregateByPeriod,
  getPeriodBucket,
  buildWipJql,
  buildFeatureDeliveryJql,
  calculateTypeBreakdown,
  calculateDaysInProgress
};
