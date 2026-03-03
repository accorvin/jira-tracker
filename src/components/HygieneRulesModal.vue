<template>
  <div
    v-if="show"
    data-testid="hygiene-rules-modal"
    class="fixed inset-0 z-50"
  >
    <div
      data-testid="modal-backdrop"
      class="absolute inset-0 bg-black bg-opacity-50"
      @click="$emit('close')"
    ></div>
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        role="dialog"
        aria-labelledby="hygiene-rules-title"
        data-testid="modal-content"
        class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] pointer-events-auto flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between flex-shrink-0">
          <h2 id="hygiene-rules-title" class="text-xl font-bold">Hygiene Rules</h2>
          <button
            data-testid="modal-close"
            @click="$emit('close')"
            class="text-white hover:text-blue-200 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 overflow-y-auto flex-grow">
          <!-- FAQ Section -->
          <div class="mb-6 space-y-4 bg-blue-50 rounded-lg p-4">
            <div>
              <h3 class="font-semibold text-gray-900">What is hygiene enforcement?</h3>
              <p class="text-sm text-gray-600 mt-1">Hygiene enforcement automatically checks Jira issues for missing or outdated fields and takes action to keep the project on track. It ensures issues have the information needed for planning, tracking, and communication.</p>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">How does it work?</h3>
              <p class="text-sm text-gray-600 mt-1">Automated checks run twice daily (8am and 8pm UTC). Violations generate proposals that are reviewed by admins before any action is taken on your issues.</p>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">What happens when a rule is enforced?</h3>
              <p class="text-sm text-gray-600 mt-1">Depending on the rule, either a comment is posted on the issue explaining what needs to be fixed, or the issue is transitioned to a different status and a comment is posted.</p>
            </div>
          </div>

          <p class="text-gray-600 mb-4">
            These rules help maintain issue hygiene and ensure clear communication across the team.
            Issues violating these rules will display a pulsing warning icon.
          </p>
          <p class="text-gray-600 mb-6">
            For more details on our Jira processes and standards, consult
            <a
              href="https://docs.google.com/document/d/1JBqlEFt85I_xJ-u55hYEOA93Ufudw5hb3W8n8yW-SXs/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              class="text-blue-600 hover:text-blue-800 underline"
            >this document</a>.
          </p>

          <div class="space-y-4">
            <div
              v-for="rule in hygieneRules"
              :key="rule.id"
              class="border border-gray-200 rounded-lg p-4"
            >
              <div class="flex items-start justify-between gap-2 mb-2">
                <h3 class="font-semibold text-gray-900">{{ rule.name }}</h3>
                <span
                  v-if="rule.enforcement && rule.enforcement.type === 'transition'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 whitespace-nowrap"
                >
                  May move issue to {{ rule.enforcement.targetStatus }}
                </span>
                <span
                  v-else-if="rule.enforcement && rule.enforcement.type === 'comment-only'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 whitespace-nowrap"
                >
                  Comment Only
                </span>
                <span
                  v-else
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap"
                >
                  Display Only
                </span>
              </div>
              <p class="text-sm text-gray-600 leading-relaxed">{{ rule.description }}</p>
              <div v-if="rule.remediation" class="mt-3 bg-green-50 rounded p-3">
                <p class="text-xs font-semibold text-green-800 mb-1">How to fix</p>
                <p class="text-sm text-green-700">{{ rule.remediation }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            @click="$emit('close')"
            class="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { hygieneRules } from '../utils/hygieneRules'

export default {
  name: 'HygieneRulesModal',
  props: {
    show: {
      type: Boolean,
      required: true
    }
  },
  emits: ['close'],
  data() {
    return {
      hygieneRules
    }
  }
}
</script>
