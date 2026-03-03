/**
 * Local development server
 * Replaces AWS Lambda + API Gateway + S3 with Express + local JSON files.
 * No Firebase auth required — all routes are open for local dev.
 */

const express = require('express');
const fetch = require('node-fetch');
const { readFromStorage, writeToStorage } = require('./storage');

const {
  JIRA_HOST,
  PLAN_ID,
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
  calculateCycleTime: _calculateCycleTime,
  aggregateByPeriod,
  getPeriodBucket,
  buildWipJql,
  buildFeatureDeliveryJql,
  calculateTypeBreakdown,
  calculateDaysInProgress: _calculateDaysInProgress
} = require('../amplify/backend/function/jiraFetcher/src/shared/jira-helpers');

// ============================================================================
// Productivity Data Caching
// ============================================================================

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate cache key for productivity data
 */
function getProductivityCacheKey(type, params) {
  if (type === 'productivity') {
    return `productivity-cache-${params.team}-${params.period}.json`;
  } else if (type === 'summary') {
    return `productivity-cache-summary-${params.period}.json`;
  } else if (type === 'member') {
    return `productivity-cache-member-${params.name}-${params.period}.json`;
  }
  throw new Error(`Unknown cache type: ${type}`);
}

/**
 * Check if cache entry is valid (not expired)
 */
function isProductivityCacheValid(cacheEntry) {
  if (!cacheEntry || !cacheEntry.cachedAt) {
    return false;
  }
  const age = Date.now() - new Date(cacheEntry.cachedAt).getTime();
  return age < CACHE_TTL_MS;
}

/**
 * Get cached productivity data if available and valid
 */
function getCachedProductivityData(type, params, forceRefresh = false) {
  if (forceRefresh) {
    return null;
  }

  const key = getProductivityCacheKey(type, params);
  const cacheEntry = readFromStorage(key);

  if (!isProductivityCacheValid(cacheEntry)) {
    return null;
  }

  console.log(`[CACHE HIT] ${key}`);
  return cacheEntry.data;
}

/**
 * Store productivity data in cache
 */
function setCachedProductivityData(type, params, data) {
  const key = getProductivityCacheKey(type, params);
  const cacheEntry = {
    cachedAt: new Date().toISOString(),
    data
  };

  writeToStorage(key, cacheEntry);
  console.log(`[CACHE WRITE] ${key}`);
}

// ============================================================================
// End Productivity Data Caching
// ============================================================================

// Calculate cycle time using changelog (In Progress → Resolved) when available,
// falling back to created → resolved if no status transitions found.
function calculateCycleTime(issue) {
  const resolved = issue.fields.resolutiondate || issue.fields.resolved;
  if (!resolved) return null;

  const resolvedDate = new Date(resolved);

  // Look for first transition to an active status in the changelog
  const activeStatuses = ['In Progress', 'Coding In Progress'];
  const histories = issue.changelog?.histories || [];

  let firstInProgressDate = null;
  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field === 'status' && activeStatuses.includes(item.toString)) {
        firstInProgressDate = new Date(history.created);
        break;
      }
    }
    if (firstInProgressDate) break;
  }

  const startDate = firstInProgressDate || new Date(issue.fields.created);
  const diffMs = resolvedDate - startDate;
  return diffMs / (1000 * 60 * 60 * 24);
}

// Calculate days in progress using changelog (first In Progress transition) when available,
// falling back to created date if no status transitions found.
function calculateDaysInProgress(issue) {
  return _calculateDaysInProgress(issue, true); // Use changelog
}

const { evaluateHygiene, getEnforceableRules } = require('../amplify/backend/function/jiraFetcher/src/shared/hygieneRules.cjs');
const { processViolations } = require('../amplify/backend/function/jiraFetcher/src/shared/enforcementLogic.cjs');

const app = express();
app.use(express.json());

// CORS
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

const PORT = process.env.API_PORT || 3001;
const JIRA_TOKEN = process.env.JIRA_TOKEN;
const jiraHost = process.env.JIRA_HOST || JIRA_HOST;

// ---------------------------------------------------------------------------
// Reader routes (read JSON from data/ directory)
// ---------------------------------------------------------------------------

app.get('/api/issues/:release', function(req, res) {
  const data = readFromStorage(`issues-${req.params.release}.json`);
  if (!data) {
    return res.status(500).json({ error: `No data found for ${req.params.release}. Please refresh to fetch data from Jira.` });
  }
  res.json(data);
});

app.get('/api/issues', function(req, res) {
  const release = req.query.release;
  if (!release) {
    return res.status(400).json({ error: 'Release query parameter is required' });
  }
  const data = readFromStorage(`issues-${release}.json`);
  if (!data) {
    return res.status(500).json({ error: `No data found for ${release}. Please refresh to fetch data from Jira.` });
  }
  res.json(data);
});

app.get('/api/releases', function(req, res) {
  const data = readFromStorage('releases.json');
  if (!data) {
    return res.json({ releases: [] });
  }
  res.json(data);
});

app.post('/api/releases', function(req, res) {
  const { releases } = req.body;
  if (!releases || !Array.isArray(releases)) {
    return res.status(400).json({ error: 'Request must include "releases" array' });
  }
  writeToStorage('releases.json', { releases });
  res.json({ success: true, releases });
});

app.get('/api/intake', function(req, res) {
  const data = readFromStorage('intake-features.json');
  if (!data) {
    return res.status(500).json({ error: 'Intake features data not found. Please refresh to fetch data from Jira.' });
  }
  res.json(data);
});

app.get('/api/plan-rankings', function(req, res) {
  const data = readFromStorage('plan-rankings.json');
  if (!data) {
    return res.status(500).json({ error: 'Plan rankings data not found. Please refresh to fetch data from Jira.' });
  }
  res.json(data);
});

// ---------------------------------------------------------------------------
// Hygiene enforcement routes (mock for local dev)
// ---------------------------------------------------------------------------

app.get('/api/hygiene/config', function(req, res) {
  const data = readFromStorage('hygiene-config.json');
  if (!data) {
    return res.json({ rules: {} });
  }
  res.json(data);
});

app.post('/api/hygiene/config', function(req, res) {
  const { rules } = req.body;
  if (!rules || typeof rules !== 'object') {
    return res.status(400).json({ error: 'Request must include "rules" object' });
  }

  const config = {
    rules,
    updatedAt: new Date().toISOString(),
    updatedBy: 'dev@redhat.com'
  };

  writeToStorage('hygiene-config.json', config);
  res.json({ success: true, ...config });
});

app.get('/api/hygiene/pending', function(req, res) {
  const data = readFromStorage('hygiene-pending.json');
  if (!data) {
    return res.json({ proposals: [], lastRunAt: null });
  }
  res.json(data);
});

app.get('/api/hygiene/history', function(req, res) {
  const data = readFromStorage('hygiene-history.json');
  if (!data) {
    return res.json({ runs: [] });
  }
  res.json(data);
});

app.post('/api/hygiene/approve', function(req, res) {
  const { proposalIds } = req.body;
  if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length === 0) {
    return res.status(400).json({ error: 'Request must include "proposalIds" array' });
  }

  const data = readFromStorage('hygiene-pending.json');
  if (!data || !data.proposals) {
    return res.status(404).json({ error: 'No pending proposals found' });
  }

  const results = [];
  for (const proposal of data.proposals) {
    if (proposalIds.includes(proposal.id) && proposal.status === 'pending') {
      proposal.status = 'applied';
      proposal.appliedAt = new Date().toISOString();
      results.push({ id: proposal.id, status: 'applied' });
    }
  }

  writeToStorage('hygiene-pending.json', data);
  res.json({ results });
});

app.post('/api/hygiene/dismiss', function(req, res) {
  const { proposalIds } = req.body;
  if (!proposalIds || !Array.isArray(proposalIds) || proposalIds.length === 0) {
    return res.status(400).json({ error: 'Request must include "proposalIds" array' });
  }

  const data = readFromStorage('hygiene-pending.json');
  if (!data || !data.proposals) {
    return res.status(404).json({ error: 'No pending proposals found' });
  }

  const dismissed = [];
  for (const proposal of data.proposals) {
    if (proposalIds.includes(proposal.id) && proposal.status === 'pending') {
      proposal.status = 'dismissed';
      proposal.dismissedAt = new Date().toISOString();
      proposal.dismissedBy = 'dev@redhat.com';
      dismissed.push(proposal.id);
    }
  }

  writeToStorage('hygiene-pending.json', data);
  res.json({ success: true, dismissed });
});

/**
 * POST /api/hygiene/run - Manually trigger an enforcement evaluation run.
 * Reads local issue data, evaluates hygiene rules, applies dedup logic,
 * and writes proposals + history — same as the Lambda would do in prod.
 */
app.post('/api/hygiene/run', function(req, res) {
  const now = new Date().toISOString();
  console.log(`Manual enforcement run triggered at ${now}`);

  // 1. Read releases
  const releasesData = readFromStorage('releases.json');
  if (!releasesData || !releasesData.releases || releasesData.releases.length === 0) {
    return res.json({ message: 'No releases configured', proposalCount: 0 });
  }

  // 2. Read all issues across all releases (deduplicated)
  const allIssues = [];
  const seenKeys = new Set();

  for (const release of releasesData.releases) {
    const data = readFromStorage(`issues-${release.name}.json`);
    if (data && data.issues) {
      for (const issue of data.issues) {
        if (!seenKeys.has(issue.key)) {
          seenKeys.add(issue.key);
          allIssues.push(issue);
        }
      }
    }
  }

  console.log(`Loaded ${allIssues.length} unique issues across ${releasesData.releases.length} releases`);

  // 3. Read enforcement config
  const config = readFromStorage('hygiene-config.json');
  const enabledRuleIds = [];
  if (config && config.rules) {
    for (const [ruleId, ruleConfig] of Object.entries(config.rules)) {
      if (ruleConfig.enabled) enabledRuleIds.push(ruleId);
    }
  }

  if (enabledRuleIds.length === 0) {
    return res.json({ message: 'No rules enabled', proposalCount: 0 });
  }

  console.log(`Enabled rules: ${enabledRuleIds.join(', ')}`);

  // 4. Read state ledger
  const ledger = readFromStorage('hygiene-state.json') || {};

  // 5. Evaluate hygiene rules and build violations
  const enforceableRules = getEnforceableRules();
  const enforceableRuleMap = new Map(enforceableRules.map(r => [r.id, r]));

  const violations = [];
  for (const issue of allIssues) {
    const issueViolations = evaluateHygiene(issue);
    for (const v of issueViolations) {
      const rule = enforceableRuleMap.get(v.id);
      if (!rule) continue;

      violations.push({
        issueKey: issue.key,
        issueSummary: issue.summary,
        issueAssignee: issue.assignee || null,
        issueStatus: issue.status,
        ruleId: rule.id,
        ruleName: rule.name,
        actionType: rule.enforcement.type,
        targetStatus: rule.enforcement.targetStatus || null,
        comment: rule.enforcement.commentTemplate
      });
    }
  }

  console.log(`Found ${violations.length} enforceable violations`);

  // 6. Apply dedup logic
  const { proposals, updatedLedger } = processViolations(violations, ledger, enabledRuleIds);

  console.log(`Generated ${proposals.length} new proposals after dedup`);

  // 7. Merge with existing pending proposals
  const pendingData = readFromStorage('hygiene-pending.json') || { proposals: [] };
  const existingPending = pendingData.proposals.filter(p => p.status === 'pending');
  const mergedProposals = [...existingPending, ...proposals];

  writeToStorage('hygiene-pending.json', {
    proposals: mergedProposals,
    lastRunAt: now
  });

  // 8. Update state ledger
  writeToStorage('hygiene-state.json', updatedLedger);

  // 9. Write history entry
  const historyEntry = {
    runAt: now,
    totalIssuesEvaluated: allIssues.length,
    totalViolationsFound: violations.length,
    newProposalsGenerated: proposals.length,
    enabledRules: enabledRuleIds,
    proposals: proposals
  };

  const existingHistory = readFromStorage('hygiene-history.json') || { runs: [] };
  existingHistory.runs.unshift(historyEntry);
  writeToStorage('hygiene-history.json', existingHistory);

  console.log(`Enforcement run complete: ${proposals.length} proposals generated`);

  res.json({
    message: 'Enforcement run complete',
    totalIssues: allIssues.length,
    totalViolations: violations.length,
    proposalCount: proposals.length,
    enabledRules: enabledRuleIds
  });
});

// ---------------------------------------------------------------------------
// Jira fetching helpers (local equivalents of Lambda functions)
// ---------------------------------------------------------------------------

async function fetchPaginated(jql, fields, { expand } = {}) {
  if (!JIRA_TOKEN) {
    throw new Error('JIRA_TOKEN environment variable is not set. Add it to your .env file.');
  }

  const issues = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const url = new URL(`${jiraHost}/rest/api/2/search`);
    url.searchParams.set('jql', jql);
    url.searchParams.set('startAt', startAt.toString());
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('fields', fields);
    if (expand) {
      url.searchParams.set('expand', expand);
    }

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
    if (!data.issues || data.issues.length === 0) break;
    issues.push(...data.issues);
    if (data.issues.length < maxResults) break;
    startAt += maxResults;
  }

  return issues;
}

async function fetchRfesByKeys(rfeKeys) {
  if (!rfeKeys || rfeKeys.length === 0) return {};

  const jql = buildRfeJql(rfeKeys);
  const fields = buildRfeFields();

  const url = new URL(`${jiraHost}/rest/api/2/search`);
  url.searchParams.set('jql', jql);
  url.searchParams.set('maxResults', '100');
  url.searchParams.set('fields', fields);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${JIRA_TOKEN}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Jira API error fetching RFEs (${response.status}): ${errorText}`);
  }

  const data = await response.json();
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

// ---------------------------------------------------------------------------
// Refresh route
// ---------------------------------------------------------------------------

app.post('/api/refresh', async function(req, res) {
  try {
    const { releases } = req.body;
    if (!releases || !Array.isArray(releases) || releases.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Request must include "releases" array with at least one release'
      });
    }

    const results = [];
    const allRawIssues = [];
    const releaseIssuesMap = {};

    // Fetch raw issues per release
    for (const release of releases) {
      console.log(`Fetching issues for ${release.name}...`);
      try {
        const rawIssues = await fetchPaginated(
          buildJqlQuery(release.name),
          buildIssueFields(),
          { expand: 'changelog,renderedFields' }
        );
        releaseIssuesMap[release.name] = rawIssues;
        allRawIssues.push(...rawIssues);
        console.log(`Found ${rawIssues.length} issues for ${release.name}`);
      } catch (error) {
        console.error(`Error fetching ${release.name}:`, error.message);
        results.push({ release: release.name, count: 0, error: error.message });
      }
    }

    // Fetch RFEs
    let rfeMap = {};
    try {
      const rfeKeys = extractRfeKeys(allRawIssues);
      console.log(`Found ${rfeKeys.length} linked RFEs to check`);
      if (rfeKeys.length > 0) {
        rfeMap = await fetchRfesByKeys(rfeKeys);
        console.log(`${Object.keys(rfeMap).length} of ${rfeKeys.length} RFEs are approved`);
      }
    } catch (error) {
      console.warn('Failed to fetch RFEs:', error.message);
    }

    // Transform and save each release
    for (const release of releases) {
      if (!releaseIssuesMap[release.name]) continue;
      try {
        const rawIssues = releaseIssuesMap[release.name];
        const transformedIssues = rawIssues.map(issue => transformIssue(issue, rfeMap));
        const output = {
          lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          issues: transformedIssues
        };
        writeToStorage(`issues-${release.name}.json`, output);
        console.log(`Saved ${transformedIssues.length} issues for ${release.name}`);
        results.push({ release: release.name, count: transformedIssues.length });
      } catch (error) {
        console.error(`Error saving ${release.name}:`, error.message);
        results.push({ release: release.name, count: 0, error: error.message });
      }
    }

    // Refresh intake features
    try {
      console.log('Fetching intake features...');
      const rawFeatures = await fetchPaginated(
        buildIntakeFeaturesJqlQuery(),
        buildIntakeFields()
      );
      console.log(`Found ${rawFeatures.length} features in New status`);

      const intakeRfeKeys = extractRfeKeys(rawFeatures);
      let intakeRfeMap = {};
      if (intakeRfeKeys.length > 0) {
        intakeRfeMap = await fetchRfesByKeys(intakeRfeKeys);
      }

      const intakeFeatures = rawFeatures
        .map(issue => transformIntakeFeature(issue, intakeRfeMap))
        .filter(feature => feature.linkedRfe !== null);

      const intakeOutput = {
        lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        features: intakeFeatures
      };
      writeToStorage('intake-features.json', intakeOutput);
      console.log(`Saved ${intakeFeatures.length} intake features`);
      results.push({ release: 'intake', count: intakeFeatures.length });
    } catch (error) {
      console.error('Error refreshing intake features:', error.message);
      results.push({ release: 'intake', count: 0, error: error.message });
    }

    // Refresh plan rankings
    try {
      console.log('Fetching plan rankings...');
      const rawPlanIssues = await fetchPaginated(
        buildPlanJqlQuery(),
        buildPlanFields(),
        { expand: 'renderedFields' }
      );
      console.log(`Found ${rawPlanIssues.length} issues in plan ${PLAN_ID}`);

      const planRfeKeys = extractRfeKeys(rawPlanIssues);
      let planRfeMap = {};
      if (planRfeKeys.length > 0) {
        planRfeMap = await fetchRfesByKeys(planRfeKeys);
      }

      const rankedIssues = rawPlanIssues.map((issue, index) => ({
        ...transformIssue(issue, planRfeMap),
        rank: index + 1
      }));

      const planOutput = {
        lastUpdated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        planId: PLAN_ID,
        totalCount: rankedIssues.length,
        issues: rankedIssues
      };
      writeToStorage('plan-rankings.json', planOutput);
      console.log(`Saved ${rankedIssues.length} plan rankings`);
      results.push({ release: 'plan-rankings', count: rankedIssues.length });
    } catch (error) {
      console.error('Error refreshing plan rankings:', error.message);
      results.push({ release: 'plan-rankings', count: 0, error: error.message });
    }

    const allSucceeded = results.every(r => !r.error);
    const totalCount = results.reduce((sum, r) => sum + r.count, 0);
    res.json({ success: allSucceeded, results, totalCount });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Productivity tracking routes
// ---------------------------------------------------------------------------

/**
 * GET /api/productivity/teams - Get list of available teams from org roster
 */
app.get('/api/productivity/teams', function(req, res) {
  try {
    // Read org-roster.json from local filesystem
    const fs = require('fs');
    const path = require('path');
    const orgRosterPath = path.join(__dirname, '../src/data/org-roster.json');

    if (!fs.existsSync(orgRosterPath)) {
      return res.status(404).json({
        error: 'Org roster data not found. Please ensure src/data/org-roster.json exists.'
      });
    }

    const orgRoster = JSON.parse(fs.readFileSync(orgRosterPath, 'utf-8'));

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
    res.status(500).json({
      error: error.message || 'Failed to fetch teams'
    });
  }
});

/**
 * GET /api/productivity?team=<name>&period=<weekly|monthly|quarterly>
 * Get productivity metrics for a team
 */
app.get('/api/productivity', async function(req, res) {
  try {
    const { team, period, refresh } = req.query;

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

    // Check cache first
    const forceRefresh = refresh === 'true';
    const cached = getCachedProductivityData('productivity', { team, period }, forceRefresh);
    if (cached) {
      return res.json(cached);
    }

    // Read org-roster.json from local filesystem
    const fs = require('fs');
    const path = require('path');
    const orgRosterPath = path.join(__dirname, '../src/data/org-roster.json');

    if (!fs.existsSync(orgRosterPath)) {
      return res.status(404).json({
        error: 'Org roster data not found. Please ensure src/data/org-roster.json exists.'
      });
    }

    const orgRoster = JSON.parse(fs.readFileSync(orgRosterPath, 'utf-8'));

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

    // Fetch issues from Jira (with changelog for accurate cycle time)
    const fields = 'key,assignee,created,resolutiondate,issuetype,customfield_12310243,customfield_12310920,storyPoints';
    const issues = await fetchPaginated(jql, fields, { expand: 'changelog' });

    console.log(`Fetched ${issues.length} resolved issues for team ${team}`);

    // Fetch WIP issues (current in-progress work)
    const wipJql = buildWipJql(memberNames);
    const wipFields = 'key,summary,assignee,status,created';
    const wipIssues = await fetchPaginated(wipJql, wipFields);
    console.log(`Fetched ${wipIssues.length} WIP issues for team ${team}`);

    // Fetch RHAISTRAT features delivered
    const featuresJql = buildFeatureDeliveryJql(memberNames, startDateStr);
    const featuresFields = 'key,summary,assignee,resolutiondate';
    const featureIssues = await fetchPaginated(featuresJql, featuresFields);
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

    const responseData = {
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
          resolved: f.fields.resolutiondate
        }))
      },
      members
    };

    // Cache the response
    setCachedProductivityData('productivity', { team, period }, responseData);

    res.json(responseData);

  } catch (error) {
    console.error('Get productivity data error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch productivity data'
    });
  }
});

/**
 * GET /api/productivity/member/:name?period=<weekly|monthly|quarterly>
 * Get productivity metrics for an individual member
 */
app.get('/api/productivity/member/:name', async function(req, res) {
  try {
    const { name } = req.params;
    const { period, refresh } = req.query;

    // Validate period parameter
    if (!period || !['weekly', 'monthly', 'quarterly'].includes(period)) {
      return res.status(400).json({
        error: 'Invalid or missing period. Must be: weekly, monthly, or quarterly'
      });
    }

    // Check cache first
    const forceRefresh = refresh === 'true';
    const cached = getCachedProductivityData('member', { name, period }, forceRefresh);
    if (cached) {
      return res.json(cached);
    }

    // Read org-roster.json from local filesystem
    const fs = require('fs');
    const path = require('path');
    const orgRosterPath = path.join(__dirname, '../src/data/org-roster.json');

    if (!fs.existsSync(orgRosterPath)) {
      return res.status(404).json({
        error: 'Org roster data not found. Please ensure src/data/org-roster.json exists.'
      });
    }

    const orgRoster = JSON.parse(fs.readFileSync(orgRosterPath, 'utf-8'));

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

    // Fetch issues from Jira (include summary field + changelog for cycle time)
    const fields = 'key,summary,assignee,created,resolutiondate,issuetype,customfield_12310243,customfield_12310920,storyPoints';
    const issues = await fetchPaginated(jql, fields, { expand: 'changelog' });

    console.log(`Fetched ${issues.length} resolved issues for member ${name}`);

    // Fetch WIP issues for this member (with changelog for accurate daysInProgress)
    const wipJql = buildWipJql([foundMember.jiraDisplayName]);
    const wipFields = 'key,summary,assignee,status,created';
    const wipIssues = await fetchPaginated(wipJql, wipFields, { expand: 'changelog' });
    console.log(`Fetched ${wipIssues.length} WIP issues for member ${name}`);

    // Fetch RHAISTRAT features delivered by this member
    const featuresJql = buildFeatureDeliveryJql([foundMember.jiraDisplayName], startDateStr);
    const featuresFields = 'key,summary,assignee,resolutiondate';
    const featureIssues = await fetchPaginated(featuresJql, featuresFields);
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
        resolved: issue.fields.resolutiondate,
        storyPoints: Number(storyPoints),
        cycleTimeDays: cycleTime !== null ? Math.round(cycleTime * 10) / 10 : null
      });

      // Aggregate into period buckets
      if (issue.fields.resolutiondate) {
        const bucket = getPeriodBucket(issue.fields.resolutiondate, period);
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

    // Build WIP details with daysInProgress
    const wipDetails = wipIssues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name || 'Unknown',
      assignee: issue.fields.assignee?.displayName || 'Unknown',
      daysInProgress: calculateDaysInProgress(issue)
    }));

    const responseData = {
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
          resolved: f.fields.resolutiondate
        }))
      },
      periodBreakdown,
      issues: issueDetails
    };

    // Cache the response
    setCachedProductivityData('member', { name, period }, responseData);

    res.json(responseData);

  } catch (error) {
    console.error('Get member productivity data error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch member productivity data'
    });
  }
});

/**
 * GET /api/productivity/summary?period=<weekly|monthly|quarterly>
 * Get aggregated productivity metrics for all teams
 * Uses bulk query optimization (3 queries instead of N×3)
 */
app.get('/api/productivity/summary', async function(req, res) {
  try {
    const { period, refresh } = req.query;

    // Validate period parameter
    if (!period || !['weekly', 'monthly', 'quarterly'].includes(period)) {
      return res.status(400).json({
        error: 'Invalid or missing period. Must be: weekly, monthly, or quarterly'
      });
    }

    // Check cache first
    const forceRefresh = refresh === 'true';
    const cached = getCachedProductivityData('summary', { period }, forceRefresh);
    if (cached) {
      return res.json(cached);
    }

    // Read org-roster.json from local filesystem
    const fs = require('fs');
    const path = require('path');
    const orgRosterPath = path.join(__dirname, '../src/data/org-roster.json');

    if (!fs.existsSync(orgRosterPath)) {
      return res.status(404).json({
        error: 'Org roster data not found. Please ensure src/data/org-roster.json exists.'
      });
    }

    const orgRoster = JSON.parse(fs.readFileSync(orgRosterPath, 'utf-8'));

    // Build assignee-to-team lookup map
    const assigneeToTeam = {};
    const teamHeadcounts = {};
    let allAssignees = [];

    Object.entries(orgRoster.teams || {}).forEach(([teamName, teamData]) => {
      const members = teamData.members || [];
      teamHeadcounts[teamName] = members.length;

      members.forEach(m => {
        assigneeToTeam[m.jiraDisplayName] = {
          teamName,
          headcount: members.length
        };
        allAssignees.push(m.jiraDisplayName);
      });
    });

    if (allAssignees.length === 0) {
      return res.json({
        period,
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        totals: {
          teams: 0,
          headcount: 0,
          issuesResolved: 0,
          storyPoints: 0,
          avgCycleTimeDays: null,
          issuesPerCapita: 0,
          storyPointsPerCapita: 0,
          bugToFeatureRatio: null,
          wipCount: 0,
          featuresDelivered: 0
        },
        teams: []
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

    // Execute 3 bulk queries in parallel
    const [resolvedIssues, wipIssues, featureIssues] = await Promise.all([
      // Query 1: Resolved issues
      (async () => {
        const jql = buildProductivityJql(allAssignees, startDateStr);
        const fields = 'key,assignee,created,resolutiondate,issuetype,customfield_12310243,customfield_12310920,storyPoints';
        return await fetchPaginated(jql, fields, { expand: 'changelog' });
      })(),
      // Query 2: WIP issues
      (async () => {
        const jql = buildWipJql(allAssignees);
        const fields = 'key,summary,assignee,status,created';
        return await fetchPaginated(jql, fields);
      })(),
      // Query 3: RHAISTRAT features
      (async () => {
        const jql = buildFeatureDeliveryJql(allAssignees, startDateStr);
        const fields = 'key,summary,assignee,resolutiondate';
        return await fetchPaginated(jql, fields);
      })()
    ]);

    console.log(`Fetched ${resolvedIssues.length} resolved, ${wipIssues.length} WIP, ${featureIssues.length} features for all teams`);

    // Bucket issues by team
    const teamData = {};

    // Initialize team buckets
    Object.keys(orgRoster.teams || {}).forEach(teamName => {
      teamData[teamName] = {
        name: teamName,
        headcount: teamHeadcounts[teamName],
        resolvedIssues: [],
        wipIssues: [],
        featureIssues: []
      };
    });

    // Bucket resolved issues
    for (const issue of resolvedIssues) {
      const assignee = issue.fields.assignee?.displayName;
      if (assignee && assigneeToTeam[assignee]) {
        const teamName = assigneeToTeam[assignee].teamName;
        teamData[teamName].resolvedIssues.push(issue);
      }
    }

    // Bucket WIP issues
    for (const issue of wipIssues) {
      const assignee = issue.fields.assignee?.displayName;
      if (assignee && assigneeToTeam[assignee]) {
        const teamName = assigneeToTeam[assignee].teamName;
        teamData[teamName].wipIssues.push(issue);
      }
    }

    // Bucket features
    for (const issue of featureIssues) {
      const assignee = issue.fields.assignee?.displayName;
      if (assignee && assigneeToTeam[assignee]) {
        const teamName = assigneeToTeam[assignee].teamName;
        teamData[teamName].featureIssues.push(issue);
      }
    }

    // Aggregate metrics per team
    const teamsArray = Object.values(teamData).map(team => {
      const { typeBreakdown, bugToFeatureRatio } = calculateTypeBreakdown(team.resolvedIssues);

      let totalStoryPoints = 0;
      let cycleTimes = [];

      for (const issue of team.resolvedIssues) {
        const storyPoints = issue.fields.customfield_12310243 ||
                           issue.fields.customfield_12310920 ||
                           issue.fields.storyPoints || 0;
        totalStoryPoints += Number(storyPoints);

        const cycleTime = calculateCycleTime(issue);
        if (cycleTime !== null) {
          cycleTimes.push(cycleTime);
        }
      }

      const avgCycleTimeDays = cycleTimes.length > 0
        ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
        : null;

      return {
        name: team.name,
        headcount: team.headcount,
        issuesResolved: team.resolvedIssues.length,
        storyPoints: totalStoryPoints,
        avgCycleTimeDays: avgCycleTimeDays !== null ? Math.round(avgCycleTimeDays * 10) / 10 : null,
        issuesPerCapita: team.headcount > 0 ? team.resolvedIssues.length / team.headcount : 0,
        storyPointsPerCapita: team.headcount > 0 ? totalStoryPoints / team.headcount : 0,
        bugToFeatureRatio,
        typeBreakdown: {
          story: typeBreakdown.story.count,
          bug: typeBreakdown.bug.count,
          task: typeBreakdown.task.count,
          subTask: typeBreakdown.subTask.count,
          other: typeBreakdown.other.count
        },
        wipCount: team.wipIssues.length,
        featuresDelivered: team.featureIssues.length
      };
    });

    // Calculate grand totals
    let totalHeadcount = 0;
    let totalIssuesResolved = 0;
    let totalStoryPoints = 0;
    let allCycleTimes = [];
    let totalWipCount = 0;
    let totalFeaturesDelivered = 0;

    for (const team of teamsArray) {
      totalHeadcount += team.headcount;
      totalIssuesResolved += team.issuesResolved;
      totalStoryPoints += team.storyPoints;
      totalWipCount += team.wipCount;
      totalFeaturesDelivered += team.featuresDelivered;

      if (team.avgCycleTimeDays !== null) {
        // Weight by number of issues
        for (let i = 0; i < team.issuesResolved; i++) {
          allCycleTimes.push(team.avgCycleTimeDays);
        }
      }
    }

    const avgCycleTimeDays = allCycleTimes.length > 0
      ? allCycleTimes.reduce((a, b) => a + b, 0) / allCycleTimes.length
      : null;

    // Calculate overall bug-to-feature ratio from all resolved issues
    const { bugToFeatureRatio: overallBugToFeatureRatio } = calculateTypeBreakdown(resolvedIssues);

    const responseData = {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totals: {
        teams: teamsArray.length,
        headcount: totalHeadcount,
        issuesResolved: totalIssuesResolved,
        storyPoints: totalStoryPoints,
        avgCycleTimeDays: avgCycleTimeDays !== null ? Math.round(avgCycleTimeDays * 10) / 10 : null,
        issuesPerCapita: totalHeadcount > 0 ? totalIssuesResolved / totalHeadcount : 0,
        storyPointsPerCapita: totalHeadcount > 0 ? totalStoryPoints / totalHeadcount : 0,
        bugToFeatureRatio: overallBugToFeatureRatio,
        wipCount: totalWipCount,
        featuresDelivered: totalFeaturesDelivered
      },
      teams: teamsArray
    };

    // Cache the response
    setCachedProductivityData('summary', { period }, responseData);

    res.json(responseData);

  } catch (error) {
    console.error('Get productivity summary error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch productivity summary'
    });
  }
});

/**
 * POST /api/productivity/cache-warmup
 * Pre-warm all productivity caches for all teams and periods
 */
app.post('/api/productivity/cache-warmup', async function(req, res) {
  try {
    const fs = require('fs');
    const path = require('path');
    const orgRosterPath = path.join(__dirname, '../src/data/org-roster.json');

    if (!fs.existsSync(orgRosterPath)) {
      return res.status(404).json({
        error: 'Org roster data not found. Please ensure src/data/org-roster.json exists.'
      });
    }

    const orgRoster = JSON.parse(fs.readFileSync(orgRosterPath, 'utf-8'));
    const teams = Object.keys(orgRoster.teams || {});
    const periods = ['weekly', 'monthly', 'quarterly'];

    const results = {
      started: new Date().toISOString(),
      teams: teams.length,
      periods: periods.length,
      totalCaches: teams.length * periods.length + periods.length, // team caches + summary caches
      cached: []
    };

    // Warm up team caches
    for (const team of teams) {
      for (const period of periods) {
        try {
          // Make internal request to the productivity endpoint with refresh=true
          const url = `http://localhost:${PORT}/api/productivity?team=${encodeURIComponent(team)}&period=${period}&refresh=true`;
          const response = await fetch(url);

          if (response.ok) {
            results.cached.push({ type: 'team', team, period, status: 'success' });
          } else {
            results.cached.push({ type: 'team', team, period, status: 'failed' });
          }
        } catch (error) {
          console.error(`Failed to warm cache for ${team} ${period}:`, error);
          results.cached.push({ type: 'team', team, period, status: 'error', error: error.message });
        }
      }
    }

    // Warm up summary caches
    for (const period of periods) {
      try {
        const url = `http://localhost:${PORT}/api/productivity/summary?period=${period}&refresh=true`;
        const response = await fetch(url);

        if (response.ok) {
          results.cached.push({ type: 'summary', period, status: 'success' });
        } else {
          results.cached.push({ type: 'summary', period, status: 'failed' });
        }
      } catch (error) {
        console.error(`Failed to warm cache for summary ${period}:`, error);
        results.cached.push({ type: 'summary', period, status: 'error', error: error.message });
      }
    }

    results.completed = new Date().toISOString();
    results.successCount = results.cached.filter(c => c.status === 'success').length;
    results.failedCount = results.cached.filter(c => c.status !== 'success').length;

    res.json(results);

  } catch (error) {
    console.error('Cache warmup error:', error);
    res.status(500).json({
      error: error.message || 'Failed to warm up caches'
    });
  }
});

/**
 * GET /api/productivity/cache-status
 * Get status of all productivity caches
 */
app.get('/api/productivity/cache-status', function(req, res) {
  try {
    const fs = require('fs');
    const path = require('path');
    const orgRosterPath = path.join(__dirname, '../src/data/org-roster.json');

    if (!fs.existsSync(orgRosterPath)) {
      return res.status(404).json({
        error: 'Org roster data not found. Please ensure src/data/org-roster.json exists.'
      });
    }

    const orgRoster = JSON.parse(fs.readFileSync(orgRosterPath, 'utf-8'));
    const teams = Object.keys(orgRoster.teams || {});
    const periods = ['weekly', 'monthly', 'quarterly'];

    const caches = [];

    // Check team caches
    for (const team of teams) {
      for (const period of periods) {
        const key = getProductivityCacheKey('productivity', { team, period });
        const cacheEntry = readFromStorage(key);

        caches.push({
          type: 'team',
          team,
          period,
          cached: cacheEntry !== null,
          valid: isProductivityCacheValid(cacheEntry),
          cachedAt: cacheEntry?.cachedAt || null,
          age: cacheEntry?.cachedAt ? Date.now() - new Date(cacheEntry.cachedAt).getTime() : null
        });
      }
    }

    // Check summary caches
    for (const period of periods) {
      const key = getProductivityCacheKey('summary', { period });
      const cacheEntry = readFromStorage(key);

      caches.push({
        type: 'summary',
        period,
        cached: cacheEntry !== null,
        valid: isProductivityCacheValid(cacheEntry),
        cachedAt: cacheEntry?.cachedAt || null,
        age: cacheEntry?.cachedAt ? Date.now() - new Date(cacheEntry.cachedAt).getTime() : null
      });
    }

    const summary = {
      totalCaches: caches.length,
      cached: caches.filter(c => c.cached).length,
      valid: caches.filter(c => c.valid).length,
      expired: caches.filter(c => c.cached && !c.valid).length,
      missing: caches.filter(c => !c.cached).length
    };

    res.json({
      summary,
      caches
    });

  } catch (error) {
    console.error('Get cache status error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get cache status'
    });
  }
});

// CORS preflight
app.options('/api/*', function(req, res) {
  res.status(200).end();
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, function() {
  console.log(`\n  Local dev server running at http://localhost:${PORT}`);
  console.log(`  JIRA_TOKEN: ${JIRA_TOKEN ? 'set' : 'NOT SET (refresh will fail)'}`);
  console.log(`  Jira host:  ${jiraHost}\n`);
});
