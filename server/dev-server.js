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
  buildPlanFields
} = require('../amplify/backend/function/jiraFetcher/src/shared/jira-helpers');

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
