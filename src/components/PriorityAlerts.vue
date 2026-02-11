<template>
  <div class="mb-3">
    <!-- No violations banner -->
    <div
      v-if="violations.length === 0 && lowPriorityInProgress.length === 0"
      class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 font-medium"
    >
      No priority violations detected
    </div>

    <!-- Alerts section -->
    <div v-else>
      <button
        data-testid="alerts-toggle"
        @click="expanded = !expanded"
        class="w-full flex items-center justify-between bg-white rounded-lg shadow-sm p-3 hover:bg-gray-50 transition-colors"
      >
        <div class="flex items-center gap-2">
          <svg
            class="h-4 w-4 transition-transform"
            :class="expanded ? 'rotate-0' : '-rotate-90'"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
          <span class="font-semibold text-sm text-gray-900">Priority Alerts</span>
          <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
            {{ totalAlertCount }}
          </span>
        </div>
      </button>

      <div v-if="expanded" data-testid="alerts-content" class="mt-2 space-y-2">
        <!-- Violation cards -->
        <div
          v-for="(violation, index) in violations"
          :key="'violation-' + index"
          data-testid="violation-card"
          class="border-l-4 rounded-lg bg-white shadow-sm p-3"
          :class="violation.rankGap > 50 ? 'border-red-500' : 'border-amber-500'"
        >
          <div class="text-sm">
            <span class="font-semibold text-gray-900">{{ violation.team }}</span>
            <span class="text-gray-600">
              — Working on
              <span class="font-medium text-gray-900">{{ violation.inProgressIssue.key }}</span>
              (rank <span class="font-medium">#{{ violation.inProgressRank }}</span>) while
              <span class="font-medium text-gray-900">{{ violation.higherRankedIdleIssue.key }}</span>
              (rank <span class="font-medium">#{{ violation.idleRank }}</span>) is not started
            </span>
          </div>
        </div>

        <!-- Low priority in progress cards -->
        <div
          v-for="(issue, index) in lowPriorityInProgress"
          :key="'low-' + index"
          class="border-l-4 border-amber-500 rounded-lg bg-white shadow-sm p-3"
        >
          <div class="text-sm text-gray-600">
            <span class="font-medium text-gray-900">{{ issue.key }}</span>
            is in progress at rank <span class="font-medium">#{{ issue.rank }}</span>
            (threshold: 100)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PriorityAlerts',
  props: {
    violations: {
      type: Array,
      required: true,
      default: () => []
    },
    lowPriorityInProgress: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  data() {
    return {
      expanded: false
    }
  },
  computed: {
    totalAlertCount() {
      return this.violations.length + this.lowPriorityInProgress.length
    }
  }
}
</script>
