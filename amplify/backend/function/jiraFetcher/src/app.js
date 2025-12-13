/**
 * Jira Fetcher Lambda
 * Fetches issues from Jira API and uploads to S3
 * Requires Firebase authentication token with @redhat.com domain
 */

const express = require('express');
const bodyParser = require('body-parser');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
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

// S3 Client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Configuration constants
 */
const JIRA_HOST = process.env.JIRA_HOST || 'https://issues.redhat.com';
const JIRA_TOKEN = process.env.JIRA_TOKEN;
const S3_BUCKET = process.env.S3_BUCKET;
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
  colorStatus: 'customfield_12320845'
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
  if (!JIRA_TOKEN) {
    throw new Error('JIRA_TOKEN environment variable is not set');
  }

  const jql = buildJqlQuery(targetRelease);
  const fields = [
    'key', 'summary', 'issuetype', 'assignee', 'status', 'created',
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
        'Authorization': `Bearer ${JIRA_TOKEN}`,
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
function transformIssue(issue) {
  const fields = issue.fields;
  const renderedFields = issue.renderedFields || {};

  const statusSummary = renderedFields[CUSTOM_FIELDS.statusSummary] ||
    serializeField(fields[CUSTOM_FIELDS.statusSummary]);

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
    url: `https://issues.redhat.com/browse/${issue.key}`
  };
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
 * Refresh all releases - shared logic for manual and scheduled refreshes
 */
async function refreshAllReleases(releases) {
  const results = [];

  for (const release of releases) {
    console.log(`Fetching issues for ${release.name}...`);

    try {
      const rawIssues = await fetchIssuesFromJira(release.name);
      const transformedIssues = rawIssues.map(transformIssue);

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
