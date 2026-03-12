/**
 * Hygiene Enforcer Lambda
 * Detects hygiene violations, generates proposals, and applies approved actions.
 */

const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const fetch = require('node-fetch');

// Shared modules (local copies — keep in sync with jiraFetcher/src/shared/)
const { hygieneRules, evaluateHygiene, getEnforceableRules } = require('./shared/hygieneRules.cjs');
const { processViolations } = require('./shared/enforcementLogic.cjs');

// AWS Clients
const AWS_REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const ssmClient = new SSMClient({ region: AWS_REGION });

const JIRA_HOST = process.env.JIRA_HOST || 'https://issues.redhat.com';
const S3_BUCKET = process.env.S3_BUCKET;

let JIRA_TOKEN = null;

// ---------------------------------------------------------------------------
// AWS helpers
// ---------------------------------------------------------------------------

async function getJiraToken() {
  if (JIRA_TOKEN) return JIRA_TOKEN;

  const parameterName = process.env.JIRA_TOKEN_PARAMETER_NAME;
  if (!parameterName) throw new Error('JIRA_TOKEN_PARAMETER_NAME environment variable is not set');

  const command = new GetParameterCommand({ Name: parameterName, WithDecryption: true });
  const response = await ssmClient.send(command);
  JIRA_TOKEN = response.Parameter.Value;
  console.log('Successfully fetched Jira token from SSM Parameter Store');
  return JIRA_TOKEN;
}

async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

async function readFromS3(key) {
  if (!S3_BUCKET) throw new Error('S3_BUCKET environment variable is not set');

  try {
    const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const response = await s3Client.send(command);
    const bodyContents = await streamToString(response.Body);
    return JSON.parse(bodyContents);
  } catch (error) {
    if (error.name === 'NoSuchKey') return null;
    throw error;
  }
}

async function writeToS3(key, data) {
  if (!S3_BUCKET) throw new Error('S3_BUCKET environment variable is not set');

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  });
  await s3Client.send(command);
}

// ---------------------------------------------------------------------------
// Jira write API calls
// ---------------------------------------------------------------------------

async function getAvailableTransitions(issueKey) {
  const token = await getJiraToken();
  const url = `${JIRA_HOST}/rest/api/2/issue/${issueKey}/transitions`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get transitions for ${issueKey}: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.transitions || [];
}

async function transitionIssue(issueKey, targetStatus) {
  const transitions = await getAvailableTransitions(issueKey);
  const transition = transitions.find(t => t.to && t.to.name === targetStatus);

  if (!transition) {
    const available = transitions.map(t => t.to?.name).filter(Boolean).join(', ');
    throw new Error(`No transition to "${targetStatus}" available for ${issueKey}. Available: ${available}`);
  }

  const token = await getJiraToken();
  const url = `${JIRA_HOST}/rest/api/2/issue/${issueKey}/transitions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ transition: { id: transition.id } })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to transition ${issueKey}: ${response.status} ${text}`);
  }

  console.log(`Transitioned ${issueKey} to ${targetStatus}`);
}

async function addComment(issueKey, ruleId, ruleName, commentBody, assigneeUsername) {
  const token = await getJiraToken();
  const url = `${JIRA_HOST}/rest/api/2/issue/${issueKey}/comment`;

  const mention = assigneeUsername ? `[~${assigneeUsername}] ` : '';
  const formattedComment = [
    `*Hygiene Enforcement — ${ruleName}*`,
    '',
    `${mention}${commentBody}`,
    '',
    '----',
    `_Automated by RHOAI Release Tracker | Rule: ${ruleId} | [Learn more|https://red.ht/rhoai-jira-tracking?hygiene=help]_`
  ].join('\n');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ body: formattedComment })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to add comment to ${issueKey}: ${response.status} ${text}`);
  }

  console.log(`Added comment to ${issueKey} for rule ${ruleId}`);
}

// ---------------------------------------------------------------------------
// Main enforcement run
// ---------------------------------------------------------------------------

async function runEnforcement() {
  const now = new Date().toISOString();
  console.log(`Starting enforcement run at ${now}`);

  // 1. Read releases to know which issue files exist
  const releasesData = await readFromS3('releases.json');
  if (!releasesData || !releasesData.releases || releasesData.releases.length === 0) {
    console.log('No releases configured, skipping enforcement');
    return { message: 'No releases configured', proposalCount: 0 };
  }

  // 2. Read all issues across all releases
  const allIssues = [];
  const seenKeys = new Set();

  for (const release of releasesData.releases) {
    const data = await readFromS3(`issues-${release.name}.json`);
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
  const config = await readFromS3('hygiene/config.json');
  const enabledRuleIds = [];
  if (config && config.rules) {
    for (const [ruleId, ruleConfig] of Object.entries(config.rules)) {
      if (ruleConfig.enabled) enabledRuleIds.push(ruleId);
    }
  }

  if (enabledRuleIds.length === 0) {
    console.log('No enforcement rules enabled, skipping');
    return { message: 'No rules enabled', proposalCount: 0 };
  }

  console.log(`Enabled rules: ${enabledRuleIds.join(', ')}`);

  // 4. Read state ledger
  const ledger = (await readFromS3('hygiene/state.json')) || {};

  // 5. Evaluate hygiene rules for all issues and build violation list
  const enforceableRules = getEnforceableRules();
  const enforceableRuleMap = new Map(enforceableRules.map(r => [r.id, r]));

  const violations = [];
  for (const issue of allIssues) {
    const issueViolations = evaluateHygiene(issue);
    for (const v of issueViolations) {
      const rule = enforceableRuleMap.get(v.id);
      if (!rule) continue; // Not enforceable (e.g., premature-release-target)

      violations.push({
        issueKey: issue.key,
        issueSummary: issue.summary,
        issueAssignee: issue.assignee || null,
        issueAssigneeUsername: issue.assigneeUsername || null,
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

  // 6. Read existing pending proposals for dedup
  const pendingData = (await readFromS3('hygiene/pending.json')) || { proposals: [] };

  // 7. Apply dedup logic — pass existing proposals to prevent duplicates
  const { proposals, updatedLedger, resolvedKeys } = processViolations(
    violations, ledger, enabledRuleIds, pendingData.proposals
  );

  console.log(`Generated ${proposals.length} new proposals after dedup`);

  // 8. Auto-resolve pending proposals whose violations no longer exist
  let autoResolved = 0;
  for (const proposal of pendingData.proposals) {
    if (proposal.status === 'pending') {
      const key = `${proposal.issueKey}:${proposal.ruleId}`;
      if (resolvedKeys.includes(key)) {
        proposal.status = 'resolved';
        proposal.resolvedAt = now;
        autoResolved++;
      }
    }
  }

  if (autoResolved > 0) {
    console.log(`Auto-resolved ${autoResolved} stale pending proposals`);
  }

  // 9. Determine which rules have auto-enforce enabled
  const autoEnforceRuleIds = new Set();
  if (config && config.rules) {
    for (const [ruleId, ruleConfig] of Object.entries(config.rules)) {
      if (ruleConfig.autoEnforce) autoEnforceRuleIds.add(ruleId);
    }
  }

  // 10. Auto-apply proposals for auto-enforce rules
  let autoApplied = 0;
  let autoFailed = 0;
  for (const proposal of proposals) {
    if (!autoEnforceRuleIds.has(proposal.ruleId)) continue;

    try {
      if (proposal.actionType === 'transition' && proposal.targetStatus) {
        await transitionIssue(proposal.issueKey, proposal.targetStatus);
      }
      if (proposal.comment) {
        await addComment(proposal.issueKey, proposal.ruleId, proposal.ruleName, proposal.comment, proposal.issueAssigneeUsername);
      }
      proposal.status = 'applied';
      proposal.appliedAt = now;
      proposal.autoApplied = true;
      // Update ledger lastActionAt for auto-applied proposals
      const ledgerKey = `${proposal.issueKey}:${proposal.ruleId}`;
      if (updatedLedger[ledgerKey]) {
        updatedLedger[ledgerKey].lastActionAt = now;
      }
      autoApplied++;
      console.log(`Auto-applied proposal for ${proposal.issueKey} (rule: ${proposal.ruleId})`);
    } catch (error) {
      console.error(`Auto-apply failed for ${proposal.issueKey}:`, error);
      proposal.status = 'failed';
      proposal.error = error.message;
      proposal.autoApplied = true;
      autoFailed++;
    }
  }

  if (autoApplied > 0 || autoFailed > 0) {
    console.log(`Auto-enforcement: ${autoApplied} applied, ${autoFailed} failed`);
  }

  // 11. Append new proposals — keep all existing for status history
  const mergedProposals = [...pendingData.proposals, ...proposals];

  await writeToS3('hygiene/pending.json', {
    proposals: mergedProposals,
    lastRunAt: now
  });

  // 12. Update state ledger
  await writeToS3('hygiene/state.json', updatedLedger);

  // 13. Write history entry
  const historyKey = `hygiene/history/${now.replace(/[:.]/g, '-')}.json`;
  await writeToS3(historyKey, {
    runAt: now,
    totalIssuesEvaluated: allIssues.length,
    totalViolationsFound: violations.length,
    newProposalsGenerated: proposals.length,
    autoApplied,
    autoFailed,
    enabledRules: enabledRuleIds,
    proposals: proposals
  });

  console.log(`Enforcement run complete: ${proposals.length} proposals generated`);

  return {
    message: 'Enforcement run complete',
    totalIssues: allIssues.length,
    totalViolations: violations.length,
    proposalCount: proposals.length,
    autoApplied,
    autoFailed,
    enabledRules: enabledRuleIds
  };
}

// ---------------------------------------------------------------------------
// Apply approved proposals
// ---------------------------------------------------------------------------

async function applyApprovedProposals(proposalIds) {
  console.log(`Applying ${proposalIds.length} approved proposals`);

  const pendingData = await readFromS3('hygiene/pending.json');
  if (!pendingData || !pendingData.proposals) {
    throw new Error('No pending proposals found');
  }

  const results = [];

  for (const proposalId of proposalIds) {
    const proposal = pendingData.proposals.find(p => p.id === proposalId);
    if (!proposal) {
      results.push({ id: proposalId, status: 'not_found', error: 'Proposal not found' });
      continue;
    }

    if (proposal.status !== 'pending' && proposal.status !== 'failed') {
      results.push({ id: proposalId, status: 'skipped', error: `Proposal is ${proposal.status}` });
      continue;
    }

    try {
      // Execute transition if applicable
      if (proposal.actionType === 'transition' && proposal.targetStatus) {
        await transitionIssue(proposal.issueKey, proposal.targetStatus);
      }

      // Add comment
      if (proposal.comment) {
        await addComment(proposal.issueKey, proposal.ruleId, proposal.ruleName, proposal.comment, proposal.issueAssigneeUsername);
      }

      proposal.status = 'applied';
      proposal.appliedAt = new Date().toISOString();
      delete proposal.error;
      results.push({ id: proposalId, status: 'applied' });
      console.log(`Applied proposal ${proposalId} for ${proposal.issueKey}`);
    } catch (error) {
      console.error(`Failed to apply proposal ${proposalId}:`, error);
      proposal.status = 'failed';
      proposal.error = error.message;
      results.push({ id: proposalId, status: 'failed', error: error.message });
    }
  }

  // Save updated proposals back
  await writeToS3('hygiene/pending.json', pendingData);

  // Update ledger lastActionAt for successfully applied proposals
  const appliedResults = results.filter(r => r.status === 'applied');
  if (appliedResults.length > 0) {
    const ledger = (await readFromS3('hygiene/state.json')) || {};
    const appliedAt = new Date().toISOString();
    for (const result of appliedResults) {
      const proposal = pendingData.proposals.find(p => p.id === result.id);
      if (proposal) {
        const ledgerKey = `${proposal.issueKey}:${proposal.ruleId}`;
        if (ledger[ledgerKey]) {
          ledger[ledgerKey].lastActionAt = appliedAt;
        }
      }
    }
    await writeToS3('hygiene/state.json', ledger);
  }

  return { results };
}

module.exports = {
  runEnforcement,
  applyApprovedProposals
};
