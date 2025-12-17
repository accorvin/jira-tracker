/**
 * Jira Fetcher Lambda
 * Fetches issues from Jira API and uploads to S3
 * Requires Firebase authentication token with @redhat.com domain
 */

const express = require('express');
const bodyParser = require('body-parser');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const fetch = require('node-fetch');
const { verifyFirebaseToken } = require('./verifyToken');

const app = express();
app.use(bodyParser.json());
app.use(awsServerlessExpressMiddleware.eventContext());

// Enable CORS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// AWS Clients
const AWS_REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const ssmClient = new SSMClient({ region: AWS_REGION });

/**
 * Configuration constants
 */
const JIRA_HOST = process.env.JIRA_HOST || 'https://issues.redhat.com';
const S3_BUCKET = process.env.S3_BUCKET;

// Cache for JIRA_TOKEN (fetched from SSM)
let JIRA_TOKEN = null;

/**
 * Fetch JIRA token from SSM Parameter Store
 */
async function getJiraToken() {
  if (JIRA_TOKEN) {
    return JIRA_TOKEN;
  }

  const parameterName = process.env.JIRA_TOKEN_PARAMETER_NAME;
  if (!parameterName) {
    throw new Error('JIRA_TOKEN_PARAMETER_NAME environment variable is not set');
  }

  try {
    const command = new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true
    });
    const response = await ssmClient.send(command);
    JIRA_TOKEN = response.Parameter.Value;
    console.log('Successfully fetched Jira token from SSM Parameter Store');
    return JIRA_TOKEN;
  } catch (error) {
    console.error('Error fetching Jira token from SSM:', error);
    throw new Error(`Failed to fetch Jira token from SSM: ${error.message}`);
  }
}
const PROJECTS = ['RHAISTRAT', 'RHOAIENG'];
const COMPONENTS = [
  'Fine Tuning',
  'KubeRay',
  'Feature Store',
  'Training Ray',
  'Training Kubeflow',
  'AI Pipelines'
];
const ISSUE_TYPES = ['Feature', 'Initiative'];

const CUSTOM_FIELDS = {
  team: 'customfield_12313240',
  releaseType: 'customfield_12320840',
  targetRelease: 'customfield_12319940',
  statusSummary: 'customfield_12320841',
  colorStatus: 'customfield_12320845',
  // RICE scoring fields
  reach: 'customfield_12320846',
  impact: 'customfield_12320740',
  confidence: 'customfield_12320847',
  effort: 'customfield_12320848',
  riceScore: 'customfield_12326242'
};

/**
 * Build JQL query string
 */
function buildJqlQuery(targetRelease) {
  const projectFilter = `project IN (${PROJECTS.join(', ')})`;
  const componentFilter = `component IN (${COMPONENTS.map(c => `'${c}'`).join(', ')})`;
  const issueTypeFilter = `issuetype IN (${ISSUE_TYPES.join(', ')})`;
  const targetVersionFilter = `"Target Version" = ${targetRelease}`;

  return `${projectFilter} AND ${componentFilter} AND ${issueTypeFilter} AND ${targetVersionFilter}`;
}

/**
 * Fetch issues from Jira with pagination
 */
async function fetchIssuesFromJira(targetRelease) {
  const jiraToken = await getJiraToken();

  const jql = buildJqlQuery(targetRelease);
  const fields = [
    'key', 'summary', 'issuetype', 'assignee', 'status', 'created', 'issuelinks',
    CUSTOM_FIELDS.team,
    CUSTOM_FIELDS.releaseType,
    CUSTOM_FIELDS.targetRelease,
    CUSTOM_FIELDS.statusSummary,
    CUSTOM_FIELDS.colorStatus
  ].join(',');

  const issues = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('startAt', startAt.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);
    url.searchParams.set('expand', 'changelog,renderedFields');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (!data.issues || data.issues.length === 0) {
      break;
    }

    issues.push(...data.issues);

    if (data.issues.length < maxResults) {
      break;
    }

    startAt += maxResults;
  }

  return issues;
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
 * Transform raw Jira issue
 */
function transformIssue(issue, rfeMap = {}) {
  const fields = issue.fields;
  const renderedFields = issue.renderedFields || {};

  const statusSummary = renderedFields[CUSTOM_FIELDS.statusSummary] ||
    serializeField(fields[CUSTOM_FIELDS.statusSummary]);

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
    releaseType: serializeField(fields[CUSTOM_FIELDS.releaseType]),
    targetRelease: serializeListField(fields[CUSTOM_FIELDS.targetRelease]),
    statusSummary: statusSummary,
    statusSummaryUpdated: getStatusSummaryUpdatedDate(issue),
    statusEnteredAt: getStatusEnteredAtDate(issue),
    colorStatus: serializeField(fields[CUSTOM_FIELDS.colorStatus]),
    linkedRfeKey: linkedRfeKey,
    linkedRfeApproved: linkedRfeApproved,
    url: `https://issues.redhat.com/browse/${issue.key}`
  };
}

/**
 * Build JQL query for RFEs in approved or post-approval statuses
 */
function buildRfeJqlQuery() {
  const projectFilter = 'project = RHAIRFE';
  const issueTypeFilter = 'issuetype = "Feature Request"';
  // Include Approved and all post-approval statuses
  const statusFilter = 'status IN (Approved, "In Progress", Review, Resolved, Closed)';
  const componentFilter = `component IN (${COMPONENTS.map(c => `'${c}'`).join(', ')})`;

  return `${projectFilter} AND ${issueTypeFilter} AND ${statusFilter} AND ${componentFilter}`;
}

/**
 * Get the date when RFE status changed to "Approved"
 */
function getApprovalDateFromChangelog(issue) {
  if (!issue.changelog || !issue.changelog.histories) {
    return null;
  }

  // Iterate in reverse to find most recent transition TO "Approved"
  const histories = [...issue.changelog.histories].reverse();
  for (const history of histories) {
    for (const item of history.items) {
      if (item.field === 'status' && item.toString === 'Approved') {
        let timestamp = history.created;
        if (timestamp.includes('+')) {
          timestamp = timestamp.split('.')[0] + 'Z';
        } else if (timestamp.includes('T') && timestamp.length > 19) {
          timestamp = timestamp.substring(0, 19) + 'Z';
        }
        return timestamp;
      }
    }
  }

  return null;
}

/**
 * Fetch approved RFEs from Jira
 * Returns map of RFE key -> RFE data for quick lookup
 */
async function fetchApprovedRfes() {
  const jiraToken = await getJiraToken();
  const jql = buildRfeJqlQuery();

  const fields = ['key', 'summary', 'status', 'components', 'reporter', 'assignee'].join(',');
  const rfes = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('startAt', startAt.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);
    url.searchParams.set('expand', 'changelog');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error fetching RFEs (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.issues || data.issues.length === 0) break;
    rfes.push(...data.issues);
    if (data.issues.length < maxResults) break;
    startAt += maxResults;
  }

  // Transform to map for quick lookup
  // Only include RFEs that are currently Approved or were previously approved
  const rfeMap = {};
  for (const rfe of rfes) {
    const currentStatus = rfe.fields.status?.name;
    const approvalDate = getApprovalDateFromChangelog(rfe);

    // Include if currently Approved, or if in post-approval status AND was previously approved
    const isCurrentlyApproved = currentStatus === 'Approved';
    const wasApproved = approvalDate !== null;

    if (isCurrentlyApproved || wasApproved) {
      rfeMap[rfe.key] = {
        key: rfe.key,
        title: rfe.fields.summary,
        approvalDate: approvalDate,
        status: currentStatus,
        reporter: rfe.fields.reporter?.displayName || null,
        assignee: rfe.fields.assignee?.displayName || null
      };
    }
  }

  return rfeMap;
}

/**
 * Build JQL query for intake features (New status, no target release)
 */
function buildIntakeFeaturesJqlQuery() {
  const projectFilter = `project IN (${PROJECTS.join(', ')})`;
  const componentFilter = `component IN (${COMPONENTS.map(c => `'${c}'`).join(', ')})`;
  const issueTypeFilter = `issuetype IN (${ISSUE_TYPES.join(', ')})`;
  const statusFilter = 'status = New';
  const noTargetRelease = '"Target Version" IS EMPTY';

  return `${projectFilter} AND ${componentFilter} AND ${issueTypeFilter} AND ${statusFilter} AND ${noTargetRelease}`;
}

/**
 * Get "clones" links from a feature (links to RFEs)
 */
function getClonesLinks(issue) {
  if (!issue.fields.issuelinks) return [];

  return issue.fields.issuelinks
    .filter(link => {
      // "clones" link type - the Feature clones the RFE
      // So we look for outwardIssue with type name "Cloners" or similar
      // The link type name is typically "Cloners" and relation is "clones"
      return link.type &&
             link.type.outward === 'clones' &&
             link.outwardIssue;
    })
    .map(link => link.outwardIssue.key);
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
 * Fetch intake features from Jira with issue links
 */
async function fetchIntakeFeatures() {
  const jiraToken = await getJiraToken();
  const jql = buildIntakeFeaturesJqlQuery();

  const fields = [
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

  const issues = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('startAt', startAt.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error fetching intake features (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.issues || data.issues.length === 0) break;
    issues.push(...data.issues);
    if (data.issues.length < maxResults) break;
    startAt += maxResults;
  }

  return issues;
}

/**
 * Upload JSON to S3
 */
async function uploadToS3(key, data) {
  if (!S3_BUCKET) {
    throw new Error('S3_BUCKET environment variable is not set');
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);
}

/**
 * Convert stream to string
 */
async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

/**
 * Read JSON from S3
 */
async function readFromS3(key) {
  if (!S3_BUCKET) {
    throw new Error('S3_BUCKET environment variable is not set');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key
    });

    const response = await s3Client.send(command);
    const bodyContents = await streamToString(response.Body);
    return JSON.parse(bodyContents);
  } catch (error) {
    console.error(`Error reading ${key} from S3:`, error);
    throw error;
  }
}

/**
 * Refresh intake features data
 */
async function refreshIntakeFeatures() {
  console.log('Fetching approved RFEs...');
  const rfeMap = await fetchApprovedRfes();
  console.log(`Found ${Object.keys(rfeMap).length} approved RFEs`);

  console.log('Fetching intake features...');
  const rawFeatures = await fetchIntakeFeatures();
  console.log(`Found ${rawFeatures.length} features in New status`);

  // Transform and filter to only features linked to approved RFEs
  const intakeFeatures = rawFeatures
    .map(issue => transformIntakeFeature(issue, rfeMap))
    .filter(feature => feature.linkedRfe !== null);

  console.log(`${intakeFeatures.length} features linked to approved RFEs`);

  const output = {
    lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    features: intakeFeatures
  };

  await uploadToS3('intake-features.json', output);

  return { count: intakeFeatures.length };
}

/**
 * Refresh all releases - shared logic for manual and scheduled refreshes
 */
async function refreshAllReleases(releases) {
  const results = [];

  // Fetch RFE map once for all releases to check RFE links
  let rfeMap = {};
  try {
    rfeMap = await fetchApprovedRfes();
    console.log(`Fetched ${Object.keys(rfeMap).length} approved RFEs for hygiene checking`);
  } catch (error) {
    console.warn('Failed to fetch RFEs for hygiene checking:', error);
    // Continue without RFE data - hygiene checks will show missing links
  }

  for (const release of releases) {
    console.log(`Fetching issues for ${release.name}...`);

    try {
      const rawIssues = await fetchIssuesFromJira(release.name);
      const transformedIssues = rawIssues.map(issue => transformIssue(issue, rfeMap));

      const output = {
        lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        issues: transformedIssues
      };

      const s3Key = `issues-${release.name}.json`;
      await uploadToS3(s3Key, output);

      console.log(`Uploaded ${transformedIssues.length} issues for ${release.name}`);

      results.push({
        release: release.name,
        count: transformedIssues.length
      });
    } catch (error) {
      console.error(`Error fetching ${release.name}:`, error);
      results.push({
        release: release.name,
        count: 0,
        error: error.message
      });
    }
  }

  // Also refresh intake features
  try {
    const intakeResult = await refreshIntakeFeatures();
    results.push({
      release: 'intake',
      count: intakeResult.count
    });
  } catch (error) {
    console.error('Error refreshing intake features:', error);
    results.push({
      release: 'intake',
      count: 0,
      error: error.message
    });
  }

  const allSucceeded = results.every(r => !r.error);
  const totalCount = results.reduce((sum, r) => sum + r.count, 0);

  return { success: allSucceeded, results, totalCount };
}

/**
 * POST /refresh - Fetch issues and upload to S3
 */
app.post('/refresh', async function(req, res) {
  try {
    // Verify Firebase token
    const authHeader = req.headers.authorization;
    const verification = await verifyFirebaseToken(authHeader);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        error: verification.error
      });
    }

    console.log(`Refresh request from: ${verification.email}`);

    // Get releases from request body
    const { releases } = req.body;
    if (!releases || !Array.isArray(releases) || releases.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request must include "releases" array with at least one release'
      });
    }

    // Use shared refresh logic
    const result = await refreshAllReleases(releases);
    res.json(result);

  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Handle OPTIONS for CORS preflight
app.options('/refresh', function(req, res) {
  res.status(200).end();
});

app.listen(3000, function() {
  console.log("App started");
});

module.exports = app;
module.exports.readFromS3 = readFromS3;
module.exports.refreshAllReleases = refreshAllReleases;
