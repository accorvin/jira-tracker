/**
 * Enforcement Logic — Dedup & Cooldown
 * Pure functions for processing hygiene violations against a state ledger.
 * Used by the hygieneEnforcer Lambda.
 *
 * CommonJS format for Lambda compatibility.
 */

const COOLDOWN_DAYS = 7

/**
 * Process detected violations against the state ledger to produce proposals.
 *
 * Dedup logic:
 *   For each (issueKey, ruleId) violation:
 *     1. Not in ledger (new)           → ACT, add to ledger
 *     2. In ledger, resolved=true      → ACT (regression), reset entry
 *     3. In ledger, resolved=false:
 *        a. lastActionAt < COOLDOWN_DAYS ago  → SKIP
 *        b. lastActionAt >= COOLDOWN_DAYS ago → ACT (re-remind)
 *
 *   For each ledger entry where the violation is no longer detected
 *   (and the rule is still enabled):
 *     → Set resolved=true, resolvedAt=now
 *
 * @param {Array<Object>} violations - Detected violations with issue/rule metadata
 * @param {Object} ledger - Current state ledger keyed by "issueKey:ruleId"
 * @param {Array<string>} enabledRuleIds - List of currently enabled rule IDs
 * @returns {{ proposals: Array<Object>, updatedLedger: Object }}
 */
function processViolations(violations, ledger, enabledRuleIds) {
  const now = new Date().toISOString()
  const proposals = []
  const updatedLedger = JSON.parse(JSON.stringify(ledger)) // deep clone

  // Build a set of current violation keys for enabled rules
  const activeViolationKeys = new Set()

  let proposalIndex = 0

  for (const violation of violations) {
    // Skip if rule is not enabled
    if (!enabledRuleIds.includes(violation.ruleId)) {
      continue
    }

    const ledgerKey = `${violation.issueKey}:${violation.ruleId}`
    activeViolationKeys.add(ledgerKey)

    const entry = updatedLedger[ledgerKey]

    if (!entry) {
      // Case 1: New — not in ledger
      proposals.push(createProposal(violation, now, proposalIndex++))
      updatedLedger[ledgerKey] = {
        issueKey: violation.issueKey,
        ruleId: violation.ruleId,
        firstDetectedAt: now,
        lastActionAt: now,
        actionTaken: violation.actionType,
        resolved: false,
        resolvedAt: null
      }
    } else if (entry.resolved) {
      // Case 2: Regression — was resolved, now violated again
      proposals.push(createProposal(violation, now, proposalIndex++))
      updatedLedger[ledgerKey] = {
        ...entry,
        firstDetectedAt: now,
        lastActionAt: now,
        actionTaken: violation.actionType,
        resolved: false,
        resolvedAt: null
      }
    } else {
      // Case 3: Existing unresolved entry — check cooldown
      const daysSinceLastAction = getDaysBetween(entry.lastActionAt, now)

      if (daysSinceLastAction >= COOLDOWN_DAYS) {
        // Case 3b: Cooldown expired — re-remind
        proposals.push(createProposal(violation, now, proposalIndex++))
        updatedLedger[ledgerKey] = {
          ...entry,
          lastActionAt: now
        }
      }
      // Case 3a: Within cooldown — skip (do nothing)
    }
  }

  // Mark resolved: ledger entries whose violation is no longer detected
  // Only for enabled rules
  for (const [ledgerKey, entry] of Object.entries(updatedLedger)) {
    if (entry.resolved) continue
    if (!enabledRuleIds.includes(entry.ruleId)) continue
    if (!activeViolationKeys.has(ledgerKey)) {
      updatedLedger[ledgerKey] = {
        ...entry,
        resolved: true,
        resolvedAt: now
      }
    }
  }

  return { proposals, updatedLedger }
}

/**
 * Create a proposal object from a violation
 */
function createProposal(violation, timestamp, index) {
  return {
    id: `prop-${Date.now()}-${index}`,
    issueKey: violation.issueKey,
    issueSummary: violation.issueSummary,
    issueAssignee: violation.issueAssignee,
    issueStatus: violation.issueStatus,
    ruleId: violation.ruleId,
    ruleName: violation.ruleName,
    actionType: violation.actionType,
    targetStatus: violation.targetStatus || null,
    comment: violation.comment,
    detectedAt: timestamp,
    status: 'pending'
  }
}

/**
 * Calculate whole days between two ISO date strings
 */
function getDaysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1)
  const d2 = new Date(dateStr2)
  const diffMs = d2 - d1
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

module.exports = {
  processViolations,
  COOLDOWN_DAYS
}
