<template>
  <main class="container mx-auto px-6 py-8">
    <!-- Section 1: Rule Configuration -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Enforcement Rules</h2>
          <p class="text-sm text-gray-500 mt-1">
            Enable rules to automatically detect violations and generate proposals. All rules are disabled by default.
          </p>
        </div>
        <button
          @click="runEnforcement"
          :disabled="runInProgress || !isAdmin"
          :title="!isAdmin ? 'Admin access required' : undefined"
          class="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="runInProgress" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ runInProgress ? 'Running...' : 'Run Now' }}
        </button>
      </div>
      <p v-if="runResult" class="text-sm mb-4" :class="runResult.error ? 'text-red-600' : 'text-green-700'">
        {{ runResult.message }}
      </p>

      <div v-if="configLoading" class="text-center py-4 text-gray-500">Loading configuration...</div>

      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="text-left py-2 pr-4 font-medium text-gray-600">Rule</th>
            <th class="text-left py-2 pr-4 font-medium text-gray-600">Type</th>
            <th class="text-left py-2 pr-4 font-medium text-gray-600">Description</th>
            <th class="text-center py-2 font-medium text-gray-600">Enabled</th>
            <th class="text-center py-2 font-medium text-gray-600">Auto</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="rule in enforceableRules"
            :key="rule.id"
            class="border-b border-gray-100"
          >
            <td class="py-3 pr-4 font-medium text-gray-900 whitespace-nowrap">{{ rule.name }}</td>
            <td class="py-3 pr-4">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="rule.enforcement.type === 'transition'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-700'"
              >
                {{ rule.enforcement.type === 'transition' ? 'Transition' : 'Comment' }}
              </span>
              <span
                v-if="rule.enforcement.targetStatus"
                class="ml-1 text-xs text-gray-500"
              >
                &rarr; {{ rule.enforcement.targetStatus }}
              </span>
            </td>
            <td class="py-3 pr-4 text-gray-600">{{ rule.description }}</td>
            <td class="py-3 text-center">
              <button
                :data-testid="`enabled-toggle-${rule.id}`"
                @click="toggleRule(rule.id)"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                :class="isRuleEnabled(rule.id) ? 'bg-primary-600' : 'bg-gray-300'"
                :disabled="configSaving || !isAdmin"
                :title="!isAdmin ? 'Admin access required' : undefined"
              >
                <span
                  class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                  :class="isRuleEnabled(rule.id) ? 'translate-x-4.5' : 'translate-x-0.5'"
                />
              </button>
            </td>
            <td class="py-3 text-center">
              <button
                :data-testid="`auto-toggle-${rule.id}`"
                @click="toggleAutoEnforce(rule.id)"
                class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                :class="isAutoEnforceEnabled(rule.id) ? 'bg-amber-500' : 'bg-gray-300'"
                :disabled="configSaving || !isAdmin || !isRuleEnabled(rule.id)"
                :title="!isRuleEnabled(rule.id) ? 'Enable rule first' : (!isAdmin ? 'Admin access required' : undefined)"
              >
                <span
                  class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                  :class="isAutoEnforceEnabled(rule.id) ? 'translate-x-4.5' : 'translate-x-0.5'"
                />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="configError" class="mt-3 text-sm text-red-600">{{ configError }}</p>
    </div>

    <!-- Section 2: Tabs -->
    <div class="bg-white rounded-lg shadow-md">
      <div class="border-b border-gray-200 px-6">
        <nav class="flex space-x-6">
          <button
            @click="activeTab = 'pending'"
            class="py-3 px-1 border-b-2 text-sm font-medium transition-colors"
            :class="activeTab === 'pending'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            Proposals
            <span
              v-if="pendingCount > 0"
              data-testid="pending-count-badge"
              class="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700"
            >
              {{ pendingCount }}
            </span>
            <span
              v-if="failedCount > 0"
              data-testid="failed-count-badge"
              class="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700"
            >
              {{ failedCount }}
            </span>
          </button>
          <button
            @click="activeTab = 'history'"
            class="py-3 px-1 border-b-2 text-sm font-medium transition-colors"
            :class="activeTab === 'history'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            History
          </button>
        </nav>
      </div>

      <!-- Pending Tab -->
      <div v-if="activeTab === 'pending'" class="p-6">
        <div v-if="pendingLoading" class="text-center py-8 text-gray-500">Loading proposals...</div>

        <div v-else-if="actionableProposals.length === 0" class="text-center py-8 text-gray-500">
          <p>No proposals.</p>
          <p class="text-xs mt-1">Proposals are generated by the enforcement engine on a schedule.</p>
        </div>

        <div v-else>
          <!-- Bulk actions and filters -->
          <div class="flex items-center gap-3 mb-4">
            <label class="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="someSelected && !allSelected"
                @change="toggleSelectAll"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              Select All
            </label>
            <button
              @click="approveSelected"
              :disabled="selectedIds.length === 0 || actionInProgress || !isAdmin"
              :title="!isAdmin ? 'Admin access required' : undefined"
              class="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Approve Selected ({{ selectedIds.length }})
            </button>
            <button
              @click="dismissSelected"
              :disabled="selectedIds.length === 0 || actionInProgress || !isAdmin"
              :title="!isAdmin ? 'Admin access required' : undefined"
              class="px-3 py-1.5 text-xs font-medium bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dismiss Selected ({{ selectedIds.length }})
            </button>
            <span v-if="lastRunAt" class="ml-auto text-xs text-gray-400">
              Last run: {{ formatDate(lastRunAt) }}
            </span>
          </div>

          <!-- Proposals table -->
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="w-8 py-2"></th>
                <th class="text-left py-2 pr-3 font-medium text-gray-600">Issue</th>
                <th class="text-left py-2 pr-3 font-medium text-gray-600">Summary</th>
                <th class="text-left py-2 pr-3 font-medium text-gray-600">Assignee</th>
                <th class="text-left py-2 pr-3 font-medium text-gray-600">Issue Status</th>
                <th class="text-left py-2 pr-3 font-medium text-gray-600">Rule Violated</th>
                <th class="text-left py-2 pr-3 font-medium text-gray-600">Proposed Action</th>
                <th class="text-left py-2 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              <template
                v-for="proposal in actionableProposals"
                :key="proposal.id"
              >
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="py-2.5">
                    <input
                      data-testid="proposal-checkbox"
                      type="checkbox"
                      :checked="selectedIds.includes(proposal.id)"
                      @change="toggleSelect(proposal.id)"
                      class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                  <td class="py-2.5 pr-3">
                    <a
                      :href="`https://redhat.atlassian.net/browse/${proposal.issueKey}`"
                      target="_blank"
                      class="text-primary-600 hover:text-primary-800 font-medium"
                    >
                      {{ proposal.issueKey }}
                    </a>
                  </td>
                  <td class="py-2.5 pr-3 text-gray-900 max-w-xs truncate">{{ proposal.issueSummary }}</td>
                  <td class="py-2.5 pr-3 text-gray-600">{{ proposal.issueAssignee || 'Unassigned' }}</td>
                  <td class="py-2.5 pr-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {{ proposal.issueStatus }}
                    </span>
                  </td>
                  <td class="py-2.5 pr-3 text-gray-700">{{ proposal.ruleName }}</td>
                  <td class="py-2.5 pr-3">
                    <div class="flex items-center gap-2">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="proposal.actionType === 'transition'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-700'"
                      >
                        {{ proposal.actionType === 'transition'
                          ? `Move to ${proposal.targetStatus}`
                          : 'Add comment' }}
                      </span>
                      <button
                        v-if="proposal.comment"
                        @click="toggleCommentPreview(proposal.id)"
                        class="text-gray-400 hover:text-gray-600"
                        :title="expandedComments.includes(proposal.id) ? 'Hide comment preview' : 'Preview comment'"
                      >
                        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td class="py-2.5">
                    <div class="flex items-center gap-2">
                      <span
                        data-testid="proposal-status-badge"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="statusBadgeClass(proposal.status)"
                      >
                        {{ statusLabel(proposal.status) }}
                      </span>
                      <button
                        v-if="proposal.status === 'failed'"
                        :data-testid="`retry-button-${proposal.id}`"
                        @click="retryProposal(proposal.id)"
                        :disabled="actionInProgress || !isAdmin"
                        :title="proposal.error || 'Retry this proposal'"
                        class="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-50 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Retry
                      </button>
                    </div>
                    <p v-if="proposal.status === 'failed' && proposal.error" class="text-xs text-red-500 mt-0.5">
                      {{ proposal.error }}
                    </p>
                  </td>
                </tr>
                <!-- Comment preview row -->
                <tr v-if="expandedComments.includes(proposal.id)" class="bg-gray-50">
                  <td></td>
                  <td colspan="7" class="py-3 pr-3">
                    <div class="border border-gray-200 rounded-md bg-white p-3 text-xs font-mono whitespace-pre-wrap text-gray-700">
                      <div class="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Jira Comment Preview</div>
                      <div class="border-t border-gray-100 pt-2">
                        <strong>*Hygiene Enforcement &mdash; {{ proposal.ruleName }}*</strong>
                        <br><br>
                        <span v-if="proposal.issueAssigneeUsername" class="text-blue-600">[~accountid:{{ proposal.issueAssigneeUsername }}]</span>
                        {{ proposal.comment }}
                        <br><br>
                        <span class="text-gray-400">----</span>
                        <br>
                        <em class="text-gray-500">Automated by RHOAI Release Tracker | Rule: {{ proposal.ruleId }}</em>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <p v-if="pendingError" class="mt-3 text-sm text-red-600">{{ pendingError }}</p>
      </div>

      <!-- History Tab -->
      <div v-if="activeTab === 'history'" class="p-6">
        <div v-if="historyLoading" class="text-center py-8 text-gray-500">Loading history...</div>

        <div v-else-if="historyRuns.length === 0" class="text-center py-8 text-gray-500">
          No enforcement runs recorded yet.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="(run, index) in historyRuns"
            :key="index"
            class="border border-gray-200 rounded-lg"
          >
            <button
              :data-testid="`history-run-toggle-${index}`"
              @click="toggleHistoryExpand(index)"
              class="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <div class="flex items-center gap-4">
                <span class="text-sm font-medium text-gray-900">{{ formatDate(run.runAt) }}</span>
                <span class="text-xs text-gray-500">{{ run.totalIssuesEvaluated }} issues evaluated</span>
                <span class="text-xs text-gray-500">{{ run.totalViolationsFound }} violations</span>
                <span
                  v-if="run.newProposalsGenerated > 0"
                  class="px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700"
                >
                  {{ run.newProposalsGenerated }} new proposals
                </span>
                <template v-if="run.proposals && run.proposals.length > 0">
                  <span
                    v-if="runOutcomeCounts(run).applied > 0"
                    class="px-1.5 py-0.5 text-xs rounded-full bg-green-100 text-green-700"
                  >
                    {{ runOutcomeCounts(run).applied }} applied
                  </span>
                  <span
                    v-if="runOutcomeCounts(run).failed > 0"
                    class="px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700"
                  >
                    {{ runOutcomeCounts(run).failed }} failed
                  </span>
                  <span
                    v-if="runOutcomeCounts(run).dismissed > 0"
                    class="px-1.5 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600"
                  >
                    {{ runOutcomeCounts(run).dismissed }} dismissed
                  </span>
                  <span
                    v-if="runOutcomeCounts(run).resolved > 0"
                    class="px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700"
                  >
                    {{ runOutcomeCounts(run).resolved }} resolved
                  </span>
                </template>
              </div>
              <svg
                class="h-4 w-4 text-gray-400 transition-transform"
                :class="expandedHistory.includes(index) ? 'rotate-180' : ''"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div v-if="expandedHistory.includes(index)" class="border-t border-gray-200 p-4">
              <div class="text-xs text-gray-500 mb-2">
                Enabled rules: {{ (run.enabledRules || []).join(', ') || 'None' }}
              </div>
              <table v-if="run.proposals && run.proposals.length > 0" class="w-full text-xs">
                <thead>
                  <tr class="border-b border-gray-200">
                    <th class="text-left py-1 pr-2 font-medium text-gray-500">Issue</th>
                    <th class="text-left py-1 pr-2 font-medium text-gray-500">Rule</th>
                    <th class="text-left py-1 pr-2 font-medium text-gray-500">Action</th>
                    <th class="text-left py-1 pr-2 font-medium text-gray-500">Outcome</th>
                    <th class="text-left py-1 font-medium text-gray-500">When</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in run.proposals" :key="p.id" class="border-b border-gray-50">
                    <td class="py-1 pr-2">
                      <a
                        :href="`https://redhat.atlassian.net/browse/${p.issueKey}`"
                        target="_blank"
                        class="text-primary-600 hover:text-primary-800 font-medium"
                      >
                        {{ p.issueKey }}
                      </a>
                    </td>
                    <td class="py-1 pr-2 text-gray-600">{{ p.ruleName }}</td>
                    <td class="py-1 pr-2 text-gray-600">
                      {{ p.actionType === 'transition' ? `Move to ${p.targetStatus}` : 'Comment' }}
                    </td>
                    <td class="py-1 pr-2">
                      <span
                        data-testid="history-proposal-status"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="statusBadgeClass(getProposalStatus(p.id))"
                      >
                        {{ statusLabel(getProposalStatus(p.id)) }}
                      </span>
                    </td>
                    <td class="py-1">
                      <span
                        data-testid="history-proposal-timestamp"
                        class="text-gray-500"
                      >
                        {{ getProposalOutcomeTimestamp(p.id) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p v-else class="text-xs text-gray-400">No proposals generated in this run.</p>
            </div>
          </div>
        </div>

        <p v-if="historyError" class="mt-3 text-sm text-red-600">{{ historyError }}</p>
      </div>
    </div>
  </main>
</template>

<script>
import { useAdmin } from '../composables/useAdmin'
import { getEnforceableRules } from '../utils/hygieneRules'
import {
  getHygieneConfig,
  saveHygieneConfig,
  getHygienePending,
  getHygieneHistory,
  approveProposals,
  dismissProposals,
  runHygieneEnforcement
} from '../services/api'

export default {
  name: 'HygieneEnforcementView',
  setup() {
    const { isAdmin } = useAdmin()
    return { isAdmin }
  },
  data() {
    return {
      activeTab: 'pending',

      // Rule config
      enforceableRules: getEnforceableRules(),
      ruleConfig: {},
      configLoading: true,
      configSaving: false,
      configError: null,

      // Proposals
      allProposals: [],
      lastRunAt: null,
      pendingLoading: true,
      pendingError: null,
      selectedIds: [],
      actionInProgress: false,
      expandedComments: [],
      runInProgress: false,
      runResult: null,

      // History
      historyRuns: [],
      historyLoading: false,
      historyError: null,
      expandedHistory: []
    }
  },
  computed: {
    actionableProposals() {
      return this.allProposals.filter(p => p.status === 'pending' || p.status === 'failed')
    },
    pendingCount() {
      return this.allProposals.filter(p => p.status === 'pending').length
    },
    failedCount() {
      return this.allProposals.filter(p => p.status === 'failed').length
    },
    allSelected() {
      return this.actionableProposals.length > 0 &&
        this.selectedIds.length === this.actionableProposals.length
    },
    someSelected() {
      return this.selectedIds.length > 0
    }
  },
  async mounted() {
    await Promise.all([
      this.loadConfig(),
      this.loadPending()
    ])
  },
  methods: {
    async runEnforcement() {
      this.runInProgress = true
      this.runResult = null
      try {
        const result = await runHygieneEnforcement()
        this.runResult = {
          message: `${result.proposalCount} new proposal(s) generated from ${result.totalViolations} violation(s) across ${result.totalIssues} issues.`,
          error: false
        }
        await this.loadPending()
      } catch (error) {
        this.runResult = { message: error.message, error: true }
      } finally {
        this.runInProgress = false
      }
    },

    async loadConfig() {
      this.configLoading = true
      this.configError = null
      try {
        const data = await getHygieneConfig()
        this.ruleConfig = data.rules || {}
      } catch (error) {
        this.configError = error.message
      } finally {
        this.configLoading = false
      }
    },

    async loadPending() {
      this.pendingLoading = true
      this.pendingError = null
      try {
        const data = await getHygienePending()
        this.allProposals = data.proposals || []
        this.lastRunAt = data.lastRunAt
        this.selectedIds = []
      } catch (error) {
        this.pendingError = error.message
      } finally {
        this.pendingLoading = false
      }
    },

    async loadHistory() {
      this.historyLoading = true
      this.historyError = null
      try {
        const data = await getHygieneHistory()
        this.historyRuns = data.runs || []
      } catch (error) {
        this.historyError = error.message
      } finally {
        this.historyLoading = false
      }
    },

    isRuleEnabled(ruleId) {
      return this.ruleConfig[ruleId]?.enabled === true
    },

    isAutoEnforceEnabled(ruleId) {
      return this.ruleConfig[ruleId]?.autoEnforce === true
    },

    async toggleAutoEnforce(ruleId) {
      if (!this.isRuleEnabled(ruleId)) return
      const current = this.isAutoEnforceEnabled(ruleId)
      const prev = { ...this.ruleConfig[ruleId] }
      this.ruleConfig = {
        ...this.ruleConfig,
        [ruleId]: { ...prev, autoEnforce: !current }
      }

      this.configSaving = true
      this.configError = null
      try {
        await saveHygieneConfig(this.ruleConfig)
      } catch (error) {
        this.ruleConfig = {
          ...this.ruleConfig,
          [ruleId]: prev
        }
        this.configError = error.message
      } finally {
        this.configSaving = false
      }
    },

    async toggleRule(ruleId) {
      const current = this.isRuleEnabled(ruleId)
      const prev = { ...this.ruleConfig[ruleId] }
      const updated = { ...prev, enabled: !current }
      // Turn off autoEnforce when disabling
      if (current) {
        updated.autoEnforce = false
      }
      this.ruleConfig = {
        ...this.ruleConfig,
        [ruleId]: updated
      }

      this.configSaving = true
      this.configError = null
      try {
        await saveHygieneConfig(this.ruleConfig)
      } catch (error) {
        // Revert on failure
        this.ruleConfig = {
          ...this.ruleConfig,
          [ruleId]: prev
        }
        this.configError = error.message
      } finally {
        this.configSaving = false
      }
    },

    toggleSelectAll() {
      if (this.allSelected) {
        this.selectedIds = []
      } else {
        this.selectedIds = this.actionableProposals.map(p => p.id)
      }
    },

    toggleSelect(id) {
      const idx = this.selectedIds.indexOf(id)
      if (idx === -1) {
        this.selectedIds.push(id)
      } else {
        this.selectedIds.splice(idx, 1)
      }
    },

    async approveSelected() {
      if (this.selectedIds.length === 0) return
      this.actionInProgress = true
      this.pendingError = null
      try {
        await approveProposals(this.selectedIds)
        await this.loadPending()
      } catch (error) {
        this.pendingError = error.message
      } finally {
        this.actionInProgress = false
      }
    },

    async dismissSelected() {
      if (this.selectedIds.length === 0) return
      this.actionInProgress = true
      this.pendingError = null
      try {
        await dismissProposals(this.selectedIds)
        await this.loadPending()
      } catch (error) {
        this.pendingError = error.message
      } finally {
        this.actionInProgress = false
      }
    },

    statusLabel(status) {
      const labels = { pending: 'Pending', applied: 'Applied', failed: 'Failed', dismissed: 'Dismissed', resolved: 'Resolved' }
      return labels[status] || status
    },

    statusBadgeClass(status) {
      const classes = {
        pending: 'bg-amber-100 text-amber-700',
        applied: 'bg-green-100 text-green-700',
        failed: 'bg-red-100 text-red-700',
        dismissed: 'bg-gray-100 text-gray-500',
        resolved: 'bg-blue-100 text-blue-700'
      }
      return classes[status] || 'bg-gray-100 text-gray-700'
    },

    getProposalStatus(proposalId) {
      const proposal = this.allProposals.find(p => p.id === proposalId)
      return proposal ? proposal.status : 'pending'
    },

    getProposalOutcomeTimestamp(proposalId) {
      const proposal = this.allProposals.find(p => p.id === proposalId)
      if (!proposal) return ''
      const ts = proposal.appliedAt || proposal.dismissedAt || proposal.resolvedAt
      return ts ? this.formatDate(ts) : ''
    },

    runOutcomeCounts(run) {
      if (!run.proposals || run.proposals.length === 0) {
        return { applied: 0, failed: 0, dismissed: 0, resolved: 0 }
      }
      const counts = { applied: 0, failed: 0, dismissed: 0, resolved: 0 }
      for (const p of run.proposals) {
        const status = this.getProposalStatus(p.id)
        if (counts[status] !== undefined) counts[status]++
      }
      return counts
    },

    async retryProposal(proposalId) {
      this.actionInProgress = true
      this.pendingError = null
      try {
        await approveProposals([proposalId])
        await this.loadPending()
      } catch (error) {
        this.pendingError = error.message
      } finally {
        this.actionInProgress = false
      }
    },

    toggleCommentPreview(id) {
      const idx = this.expandedComments.indexOf(id)
      if (idx === -1) {
        this.expandedComments.push(id)
      } else {
        this.expandedComments.splice(idx, 1)
      }
    },

    toggleHistoryExpand(index) {
      const idx = this.expandedHistory.indexOf(index)
      if (idx === -1) {
        this.expandedHistory.push(index)
      } else {
        this.expandedHistory.splice(idx, 1)
      }
    },

    formatDate(dateString) {
      if (!dateString) return 'N/A'
      return new Date(dateString).toLocaleString()
    }
  },
  watch: {
    activeTab(tab) {
      if (tab === 'history' && this.historyRuns.length === 0) {
        this.loadHistory()
      }
    }
  }
}
</script>
