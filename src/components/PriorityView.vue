<template>
  <main class="flex-1 px-4 py-4 relative">
    <div v-if="allIssues.length > 0" class="bg-white rounded-lg shadow-sm p-2 mb-2">
      <PriorityFilterBar
        :issues="allIssues"
        :filteredCount="filteredIssues.length"
        :presets="filters"
        :initialFilterState="initialFilterState"
        @filter-change="handleFilterChange"
        @save-preset="handleSavePreset"
        @delete-preset="deleteFilter"
      />
    </div>

    <PriorityAlerts
      :violations="violations"
      :lowPriorityInProgress="lowPriorityInProgress"
    />

    <PriorityTable :issues="filteredIssues" />

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
import { filterIssues } from '../utils/priorityFilterLogic.js'
import { parsePriorityUrlParams, buildPriorityUrlParams } from '../utils/priorityUrlSync.js'
import { useSavedFilters } from '../composables/useSavedFilters.js'

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
  setup() {
    const {
      filters,
      createFilter,
      deleteFilter
    } = useSavedFilters('priorityFilters')

    return {
      filters,
      createFilter,
      deleteFilter
    }
  },
  data() {
    return {
      allIssues: [],
      isLoading: false,
      activeFilterState: null,
      initialFilterState: parsePriorityUrlParams(window.location.search)
    }
  },
  computed: {
    filteredIssues() {
      if (!this.activeFilterState) return this.allIssues
      return filterIssues(this.allIssues, this.activeFilterState)
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
        const DONE_STATUSES = ['Resolved', 'Closed']
        this.allIssues = (data.issues || [])
          .filter(i => !DONE_STATUSES.includes(i.status))
          .map((issue, index) => ({ ...issue, displayRank: index + 1 }))
      } catch (error) {
        console.error('Failed to load plan rankings:', error)
        this.allIssues = []
      } finally {
        this.isLoading = false
      }
    },
    handleFilterChange(filterState) {
      this.activeFilterState = filterState
      const newSearch = buildPriorityUrlParams(filterState, window.location.search)
      const newUrl = window.location.pathname + (newSearch || '')
      window.history.replaceState(null, '', newUrl || window.location.pathname)
    },
    handleSavePreset(payload) {
      this.createFilter(payload)
    }
  }
}
</script>
