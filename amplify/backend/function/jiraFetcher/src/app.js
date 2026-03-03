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
  buildPlanFields,
  buildProductivityJql,
  calculateCycleTime,
  aggregateByPeriod,
  getPeriodBucket,
  buildWipJql,
  buildFeatureDeliveryJql,
  calculateTypeBreakdown,
  calculateDaysInProgress
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
 * Generic function to fetch issues from Jira with pagination
 * @param {string} jql - JQL query string
 * @param {string} fields - Comma-separated field list
 * @param {Object} options - Optional expand, etc.
 * @returns {Array} Array of issues
 */
async function fetchJiraIssues(jql, fields, options = {}) {
  const jiraToken = await getJiraToken();
  const issues = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('startAt', startAt.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);
    if (options.expand) {
      url.searchParams.set('expand', options.expand);
    }

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

/**
 * GET /productivity/teams - Get list of available teams
 */
app.get('/productivity/teams', async function(req, res) {
  try {
    // Read org-roster.json from S3
    const orgRoster = await readFromS3('org-roster.json');

    // Transform to teams array
    const teams = Object.entries(orgRoster.teams || {}).map(([name, data]) => ({
      name: name,
      displayName: data.displayName || name,
      memberCount: data.members?.length || 0
    }));

    // Add "All Teams" option at the top
    const totalMembers = teams.reduce((sum, t) => sum + t.memberCount, 0);
    teams.unshift({
      name: 'All Teams',
      displayName: 'All Teams',
      memberCount: totalMembers
    });

    res.json({ teams });

  } catch (error) {
    console.error('Get productivity teams error:', error);

    if (error.message?.includes('not found') || error.message?.includes('NoSuchKey')) {
      return res.status(404).json({
        error: 'Org roster data not found. Please contact administrator.'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to fetch teams'
    });
  }
});

/**
 * GET /productivity?team=<name>&period=<weekly|monthly|quarterly>
 * Get productivity metrics for a team
 */
app.get('/productivity', async function(req, res) {
  try {
    const { team, period } = req.query;

    // Validate parameters
    if (!team) {
      return res.status(400).json({
        error: 'Missing required parameter: team'
      });
    }

    if (!period || !['weekly', 'monthly', 'quarterly'].includes(period)) {
      return res.status(400).json({
        error: 'Invalid or missing period. Must be: weekly, monthly, or quarterly'
      });
    }

    // Read org-roster.json from S3
    const orgRoster = await readFromS3('org-roster.json');

    // Collect member names and metadata
    let memberNames = [];
    const memberMetadata = {};

    if (team === 'All Teams') {
      // Aggregate across all teams
      Object.entries(orgRoster.teams || {}).forEach(([teamName, teamData]) => {
        (teamData.members || []).forEach(m => {
          memberNames.push(m.jiraDisplayName);
          memberMetadata[m.jiraDisplayName] = {
            specialty: m.specialty || 'Unknown',
            manager: m.manager || 'Unknown',
            team: teamName
          };
        });
      });
    } else {
      // Single team
      const teamData = orgRoster.teams?.[team];
      if (!teamData) {
        return res.status(404).json({
          error: `Team not found: ${team}`
        });
      }

      // Extract member names and metadata
      (teamData.members || []).forEach(m => {
        memberNames.push(m.jiraDisplayName);
        memberMetadata[m.jiraDisplayName] = {
          specialty: m.specialty || 'Unknown',
          manager: m.manager || 'Unknown',
          team: team
        };
      });
    }

    if (memberNames.length === 0) {
      return res.json({
        team,
        period,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        members: []
      });
    }

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    if (period === 'weekly') {
      startDate.setDate(endDate.getDate() - 28); // Last 4 weeks
    } else if (period === 'monthly') {
      startDate.setDate(endDate.getDate() - 180); // Last 6 months
    } else if (period === 'quarterly') {
      startDate.setDate(endDate.getDate() - 365); // Last 4 quarters
    }

    // Format start date for JQL (YYYY-MM-DD)
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const startDateStr = `${year}-${month}-${day}`;

    // Build JQL query
    const jql = buildProductivityJql(memberNames, startDateStr);

    // Fetch issues from Jira
    const jiraToken = await getJiraToken();
    const issues = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
      url.searchParams.set('jql', jql);
      url.searchParams.set('startAt', startAt.toString());
      url.searchParams.set('maxResults', maxResults.toString());
      url.searchParams.set('fields', 'key,assignee,created,resolved,issuetype,customfield_12310243,customfield_12310920,storyPoints');

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

    console.log(`Fetched ${issues.length} resolved issues for team ${team}`);

    // Fetch WIP issues (current in-progress work)
    const wipJql = buildWipJql(memberNames);
    const wipIssues = await fetchJiraIssues(wipJql, 'key,summary,assignee,status,created');
    console.log(`Fetched ${wipIssues.length} WIP issues for team ${team}`);

    // Fetch RHAISTRAT features delivered
    const featuresJql = buildFeatureDeliveryJql(memberNames, startDateStr);
    const featureIssues = await fetchJiraIssues(featuresJql, 'key,summary,assignee,resolved');
    console.log(`Fetched ${featureIssues.length} RHAISTRAT features for team ${team}`);

    // Calculate headcount
    const headcount = memberNames.length;

    // Calculate type breakdown for resolved issues
    const { typeBreakdown, bugToFeatureRatio } = calculateTypeBreakdown(issues);

    // Calculate total metrics across all members
    let totalIssues = issues.length;
    let totalStoryPoints = 0;
    for (const issue of issues) {
      const storyPoints = issue.fields.customfield_12310243 ||
                         issue.fields.customfield_12310920 ||
                         issue.fields.storyPoints || 0;
      totalStoryPoints += Number(storyPoints);
    }

    // Calculate normalized per-capita metrics
    const normalized = {
      issuesPerCapita: headcount > 0 ? totalIssues / headcount : 0,
      storyPointsPerCapita: headcount > 0 ? totalStoryPoints / headcount : 0
    };

    // Calculate WIP by member
    const wipByMember = {};
    for (const issue of wipIssues) {
      const assignee = issue.fields.assignee?.displayName;
      if (assignee) {
        wipByMember[assignee] = (wipByMember[assignee] || 0) + 1;
      }
    }

    const wipByMemberArray = Object.entries(wipByMember).map(([name, count]) => ({
      name,
      count
    }));

    // Aggregate by member and period
    const aggregated = aggregateByPeriod(issues, period);

    // Convert to array format and enrich with metadata
    const members = Object.values(aggregated).map(member => ({
      ...member,
      specialty: memberMetadata[member.name]?.specialty || 'Unknown',
      manager: memberMetadata[member.name]?.manager || 'Unknown',
      team: memberMetadata[member.name]?.team || team
    }));

    res.json({
      team,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      headcount,
      normalized,
      typeBreakdown,
      bugToFeatureRatio,
      wipCount: wipIssues.length,
      wipByMember: wipByMemberArray,
      features: {
        delivered: featureIssues.length,
        list: featureIssues.map(f => ({
          key: f.key,
          summary: f.fields.summary,
          resolved: f.fields.resolved
        }))
      },
      members
    });

  } catch (error) {
    console.error('Get productivity data error:', error);

    if (error.message?.includes('not found') || error.message?.includes('NoSuchKey')) {
      return res.status(404).json({
        error: 'Org roster data not found. Please contact administrator.'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to fetch productivity data'
    });
  }
});

/**
 * GET /productivity/member/:name?period=<weekly|monthly|quarterly>
 * Get productivity metrics for an individual member
 */
app.get('/productivity/member/:name', async function(req, res) {
  try {
    const { name } = req.params;
    const { period } = req.query;

    // Validate period parameter
    if (!period || !['weekly', 'monthly', 'quarterly'].includes(period)) {
      return res.status(400).json({
        error: 'Invalid or missing period. Must be: weekly, monthly, or quarterly'
      });
    }

    // Read org-roster.json from S3
    const orgRoster = await readFromS3('org-roster.json');

    // Find the member by name or jiraDisplayName across all teams
    let foundMember = null;
    let foundTeam = null;

    for (const [teamName, teamData] of Object.entries(orgRoster.teams || {})) {
      const member = (teamData.members || []).find(m =>
        m.jiraDisplayName === name || m.name === name
      );

      if (member) {
        foundMember = member;
        foundTeam = teamName;
        break;
      }
    }

    if (!foundMember) {
      return res.status(404).json({
        error: `Member not found in org roster: ${name}`
      });
    }

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();

    if (period === 'weekly') {
      startDate.setDate(endDate.getDate() - 28); // Last 4 weeks
    } else if (period === 'monthly') {
      startDate.setDate(endDate.getDate() - 180); // Last 6 months
    } else if (period === 'quarterly') {
      startDate.setDate(endDate.getDate() - 365); // Last 4 quarters
    }

    // Format start date for JQL (YYYY-MM-DD)
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const startDateStr = `${year}-${month}-${day}`;

    // Build JQL query for this single member
    const jql = buildProductivityJql([foundMember.jiraDisplayName], startDateStr);

    // Fetch issues from Jira
    const jiraToken = await getJiraToken();
    const issues = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const url = new URL(`${JIRA_HOST}/rest/api/2/search`);
      url.searchParams.set('jql', jql);
      url.searchParams.set('startAt', startAt.toString());
      url.searchParams.set('maxResults', maxResults.toString());
      url.searchParams.set('fields', 'key,summary,assignee,created,resolved,issuetype,customfield_12310243,customfield_12310920,storyPoints');

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

    console.log(`Fetched ${issues.length} resolved issues for member ${name}`);

    // Fetch WIP issues for this member
    const wipJql = buildWipJql([foundMember.jiraDisplayName]);
    const wipIssues = await fetchJiraIssues(wipJql, 'key,summary,assignee,status,created');
    console.log(`Fetched ${wipIssues.length} WIP issues for member ${name}`);

    // Fetch RHAISTRAT features delivered by this member
    const featuresJql = buildFeatureDeliveryJql([foundMember.jiraDisplayName], startDateStr);
    const featureIssues = await fetchJiraIssues(featuresJql, 'key,summary,assignee,resolved');
    console.log(`Fetched ${featureIssues.length} RHAISTRAT features for member ${name}`);

    // Calculate type breakdown for resolved issues
    const { typeBreakdown, bugToFeatureRatio } = calculateTypeBreakdown(issues);

    // Calculate summary statistics
    let totalIssuesResolved = issues.length;
    let totalStoryPoints = 0;
    let cycleTimes = [];

    // Build period breakdown and detailed issue list
    const periodBuckets = {};
    const issueDetails = [];

    for (const issue of issues) {
      const cycleTime = calculateCycleTime(issue);
      if (cycleTime !== null) {
        cycleTimes.push(cycleTime);
      }

      // Get story points
      const storyPoints = issue.fields.customfield_12310243 ||
                         issue.fields.customfield_12310920 ||
                         issue.fields.storyPoints || 0;
      totalStoryPoints += Number(storyPoints);

      // Add to detailed issue list
      issueDetails.push({
        key: issue.key,
        summary: issue.fields.summary,
        resolved: issue.fields.resolved,
        storyPoints: Number(storyPoints),
        cycleTimeDays: cycleTime !== null ? Math.round(cycleTime * 10) / 10 : null
      });

      // Aggregate into period buckets
      if (issue.fields.resolved) {
        const bucket = getPeriodBucket(issue.fields.resolved, period);
        if (!periodBuckets[bucket]) {
          periodBuckets[bucket] = {
            period: bucket,
            issuesResolved: 0,
            storyPoints: 0,
            cycleTimes: []
          };
        }

        periodBuckets[bucket].issuesResolved++;
        periodBuckets[bucket].storyPoints += Number(storyPoints);
        if (cycleTime !== null) {
          periodBuckets[bucket].cycleTimes.push(cycleTime);
        }
      }
    }

    // Calculate average cycle time
    const avgCycleTimeDays = cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : null;

    // Convert period buckets to array and calculate averages
    const periodBreakdown = Object.values(periodBuckets).map(bucket => {
      const avgCycleTime = bucket.cycleTimes.length > 0
        ? bucket.cycleTimes.reduce((a, b) => a + b, 0) / bucket.cycleTimes.length
        : null;

      return {
        period: bucket.period,
        issuesResolved: bucket.issuesResolved,
        storyPoints: bucket.storyPoints,
        avgCycleTimeDays: avgCycleTime !== null ? Math.round(avgCycleTime * 10) / 10 : null
      };
    });

    // Sort issues by resolved date (most recent first)
    issueDetails.sort((a, b) => {
      if (!a.resolved || !b.resolved) return 0;
      return new Date(b.resolved) - new Date(a.resolved);
    });

    // Build WIP details with daysInProgress (using created date in Lambda - simpler)
    const wipDetails = wipIssues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      assignee: issue.fields.assignee?.displayName || 'Unknown',
      daysInProgress: calculateDaysInProgress(issue, false) // false = use created date, not changelog
    }));

    res.json({
      member: {
        name: foundMember.name,
        jiraDisplayName: foundMember.jiraDisplayName,
        specialty: foundMember.specialty || 'Unknown',
        manager: foundMember.manager || 'Unknown',
        team: foundTeam,
        miroTeam: foundMember.miroTeam || null,
        jiraComponent: foundMember.jiraComponent || null
      },
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        totalIssuesResolved,
        totalStoryPoints,
        avgCycleTimeDays: avgCycleTimeDays !== null ? Math.round(avgCycleTimeDays * 10) / 10 : null
      },
      typeBreakdown,
      bugToFeatureRatio,
      wip: {
        count: wipIssues.length,
        issues: wipDetails
      },
      features: {
        delivered: featureIssues.length,
        list: featureIssues.map(f => ({
          key: f.key,
          summary: f.fields.summary,
          resolved: f.fields.resolved
        }))
      },
      periodBreakdown,
      issues: issueDetails
    });

  } catch (error) {
    console.error('Get member productivity data error:', error);

    if (error.message?.includes('not found') || error.message?.includes('NoSuchKey')) {
      return res.status(404).json({
        error: 'Org roster data not found. Please contact administrator.'
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to fetch member productivity data'
    });
  }
});

// Handle OPTIONS for CORS preflight
app.options('/productivity/teams', function(req, res) {
  res.status(200).end();
});

app.options('/productivity', function(req, res) {
  res.status(200).end();
});

app.options('/productivity/member/*', function(req, res) {
  res.status(200).end();
});

app.listen(3000, function() {
  console.log("App started");
});

module.exports = app;
module.exports.readFromS3 = readFromS3;
module.exports.refreshAllReleases = refreshAllReleases;
