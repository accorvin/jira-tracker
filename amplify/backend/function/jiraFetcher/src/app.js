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

const {
  CUSTOM_FIELDS,
  buildJqlQuery,
  buildIntakeFeaturesJqlQuery,
  buildPlanJqlQuery,
  buildRfeJql,
  buildRfeFields,
  extractRfeKeys,
  transformIssue,
  transformIntakeFeature,
  buildIssueFields,
  buildIntakeFields,
  buildPlanFields
} = require('./shared/jira-helpers');

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
const PLAN_ID = 2423;

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

/**
 * Fetch issues from Jira with pagination
 */
async function fetchIssuesFromJira(targetRelease) {
  const jiraToken = await getJiraToken();

  const jql = buildJqlQuery(targetRelease);
  const fields = buildIssueFields();

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
 * Fetch specific RFEs by their keys
 * Only returns RFEs that are in approved or post-approval statuses
 * Returns map of RFE key -> RFE data for quick lookup
 */
async function fetchRfesByKeys(rfeKeys) {
  if (!rfeKeys || rfeKeys.length === 0) {
    return {};
  }

  const jiraToken = await getJiraToken();

  const jql = buildRfeJql(rfeKeys);
  const fields = buildRfeFields();

  const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
  url.searchParams.set('jql', jql);
  url.searchParams.set('maxResults', '100');
  url.searchParams.set('fields', fields);

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

  // Transform to map for quick lookup
  const rfeMap = {};
  for (const rfe of data.issues || []) {
    rfeMap[rfe.key] = {
      key: rfe.key,
      title: rfe.fields.summary,
      approvalDate: null,
      status: rfe.fields.status?.name,
      reporter: rfe.fields.reporter?.displayName || null,
      assignee: rfe.fields.assignee?.displayName || null
    };
  }

  return rfeMap;
}

/**
 * Fetch intake features from Jira with issue links
 */
async function fetchIntakeFeatures() {
  const jiraToken = await getJiraToken();
  const jql = buildIntakeFeaturesJqlQuery();
  const fields = buildIntakeFields();

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
async function refreshIntakeFeatures(existingRfeMap) {
  console.log('Fetching intake features...');
  const rawFeatures = await fetchIntakeFeatures();
  console.log(`Found ${rawFeatures.length} features in New status`);

  // Use existing RFE map if provided, otherwise fetch
  let rfeMap = existingRfeMap || {};
  if (!existingRfeMap) {
    const rfeKeys = extractRfeKeys(rawFeatures);
    console.log(`Found ${rfeKeys.length} linked RFEs to check`);
    if (rfeKeys.length > 0) {
      rfeMap = await fetchRfesByKeys(rfeKeys);
      console.log(`${Object.keys(rfeMap).length} of ${rfeKeys.length} RFEs are approved`);
    }
  }

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
 * Fetch plan issues from Jira with pagination
 * Skips changelog to reduce payload for ~1000 issues
 */
async function fetchPlanIssuesFromJira() {
  const jiraToken = await getJiraToken();

  const jql = buildPlanJqlQuery();
  const fields = buildPlanFields();

  const issues = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('startAt', startAt.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);
    url.searchParams.set('expand', 'renderedFields');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${jiraToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Jira API error fetching plan issues (${response.status}): ${errorText}`);
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
 * Refresh plan rankings data
 */
async function refreshPlanRankings(existingRfeMap) {
  console.log('Fetching plan rankings...');
  const rawIssues = await fetchPlanIssuesFromJira();
  console.log(`Found ${rawIssues.length} issues in plan ${PLAN_ID}`);

  // Use existing RFE map if provided, otherwise fetch
  let rfeMap = existingRfeMap || {};
  if (!existingRfeMap) {
    const rfeKeys = extractRfeKeys(rawIssues);
    console.log(`Found ${rfeKeys.length} linked RFEs to check`);
    if (rfeKeys.length > 0) {
      rfeMap = await fetchRfesByKeys(rfeKeys);
      console.log(`${Object.keys(rfeMap).length} of ${rfeKeys.length} RFEs are approved`);
    }
  }

  // Transform issues and add rank (1-based positional index)
  const rankedIssues = rawIssues.map((issue, index) => ({
    ...transformIssue(issue, rfeMap),
    rank: index + 1
  }));

  const output = {
    lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    planId: PLAN_ID,
    totalCount: rankedIssues.length,
    issues: rankedIssues
  };

  await uploadToS3('plan-rankings.json', output);

  return { count: rankedIssues.length };
}

/**
 * Refresh all releases - shared logic for manual and scheduled refreshes
 */
async function refreshAllReleases(releases) {
  const results = [];

  // First, fetch all raw issues for all releases
  const allRawIssues = [];
  const releaseIssuesMap = {};

  for (const release of releases) {
    console.log(`Fetching issues for ${release.name}...`);
    try {
      const rawIssues = await fetchIssuesFromJira(release.name);
      releaseIssuesMap[release.name] = rawIssues;
      allRawIssues.push(...rawIssues);
      console.log(`Found ${rawIssues.length} issues for ${release.name}`);
    } catch (error) {
      console.error(`Error fetching ${release.name}:`, error);
      results.push({
        release: release.name,
        count: 0,
        error: error.message
      });
    }
  }

  // Extract all linked RFE keys and fetch only those
  let rfeMap = {};
  try {
    const rfeKeys = extractRfeKeys(allRawIssues);
    console.log(`Found ${rfeKeys.length} linked RFEs to check`);
    if (rfeKeys.length > 0) {
      rfeMap = await fetchRfesByKeys(rfeKeys);
      console.log(`${Object.keys(rfeMap).length} of ${rfeKeys.length} RFEs are approved`);
    }
  } catch (error) {
    console.warn('Failed to fetch RFEs for hygiene checking:', error);
  }

  // Transform and save each release
  for (const release of releases) {
    if (!releaseIssuesMap[release.name]) continue; // Already errored

    try {
      const rawIssues = releaseIssuesMap[release.name];
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
      console.error(`Error saving ${release.name}:`, error);
      results.push({
        release: release.name,
        count: 0,
        error: error.message
      });
    }
  }

  // Refresh intake features and plan rankings in parallel, reusing rfeMap
  const [intakeOutcome, planOutcome] = await Promise.allSettled([
    refreshIntakeFeatures(rfeMap),
    refreshPlanRankings(rfeMap)
  ]);

  if (intakeOutcome.status === 'fulfilled') {
    results.push({ release: 'intake', count: intakeOutcome.value.count });
  } else {
    console.error('Error refreshing intake features:', intakeOutcome.reason);
    results.push({ release: 'intake', count: 0, error: intakeOutcome.reason.message });
  }

  if (planOutcome.status === 'fulfilled') {
    results.push({ release: 'plan-rankings', count: planOutcome.value.count });
  } else {
    console.error('Error refreshing plan rankings:', planOutcome.reason);
    results.push({ release: 'plan-rankings', count: 0, error: planOutcome.reason.message });
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
