<template>
  <main class="flex-1 px-4 py-4 relative">
    <PriorityFilterBar
      :issues="allIssues"
      @filter-change="handleFilterChange"
    />

    <PriorityAlerts
      :violations="violations"
      :lowPriorityInProgress="lowPriorityInProgress"
    />

    <PriorityTable :issues="displayIssues" />

    <LoadingOverlay v-if="isLoading" data-testid="loading-overlay" />
  </main>
</template>

<script>
import PriorityFilterBar from './PriorityFilterBar.vue'
import PriorityAlerts from './PriorityAlerts.vue'
import PriorityTable from './PriorityTable.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import { getPlanRankings } from '../services/api'
import { detectPriorityViolations, getLowPriorityInProgress } from '../utils/priorityRules.js'

export default {
  name: 'PriorityView',
  components: {
    PriorityFilterBar,
    PriorityAlerts,
    PriorityTable,
    LoadingOverlay
  },
  props: {
    isRefreshing: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      allIssues: [],
      isLoading: false,
      filter: {
        mode: 'team',
        value: '',
        hideDone: true
      }
    }
  },
  computed: {
    filteredIssues() {
      let issues = this.allIssues

      if (this.filter.value) {
        issues = issues.filter(issue => {
          if (this.filter.mode === 'team') {
            return issue.team === this.filter.value
          } else {
            const components = issue.components || []
            return components.includes(this.filter.value)
          }
        })
      }

      return issues
    },
    displayIssues() {
      if (this.filter.hideDone) {
        return this.filteredIssues.filter(issue =>
          issue.status !== 'Resolved' && issue.status !== 'Closed'
        )
      }
      return this.filteredIssues
    },
    violations() {
      return detectPriorityViolations(this.filteredIssues)
    },
    lowPriorityInProgress() {
      return getLowPriorityInProgress(this.filteredIssues)
    }
  },
  watch: {
    isRefreshing(newVal, oldVal) {
      if (oldVal && !newVal) {
        this.loadIssues()
      }
    }
  },
  mounted() {
    this.loadIssues()
  },
  methods: {
    async loadIssues() {
      this.isLoading = true
      try {
        const data = await getPlanRankings()
        this.allIssues = data.issues || []
      } catch (error) {
        console.error('Failed to load plan rankings:', error)
        this.allIssues = []
      } finally {
        this.isLoading = false
      }
    },
    handleFilterChange(filter) {
      this.filter = filter
    }
  }
}
</script>
