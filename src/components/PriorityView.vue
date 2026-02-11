<template>
  <main class="flex-1 px-4 py-4 relative">
    <div class="bg-white rounded-lg shadow-sm p-2 mb-2">
      <PriorityFilterSelector
        :filters="filters"
        :activeFilterId="activeFilterId"
        @select-filter="setActiveFilter"
        @create-filter="openNewFilter"
        @edit-filter="openEditFilter"
        @delete-filter="deleteFilter"
      />
    </div>

    <PriorityAlerts
      :violations="violations"
      :lowPriorityInProgress="lowPriorityInProgress"
    />

    <PriorityTable :issues="filteredIssues" />

    <PriorityFilterEditor
      v-if="showFilterEditor"
      :issues="allIssues"
      :filter="editingFilter"
      @save="handleSaveFilter"
      @cancel="showFilterEditor = false"
    />

    <LoadingOverlay v-if="isLoading" data-testid="loading-overlay" />
  </main>
</template>

<script>
import PriorityFilterSelector from './PriorityFilterSelector.vue'
import PriorityFilterEditor from './PriorityFilterEditor.vue'
import PriorityAlerts from './PriorityAlerts.vue'
import PriorityTable from './PriorityTable.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import { getPlanRankings } from '../services/api'
import { detectPriorityViolations, getLowPriorityInProgress } from '../utils/priorityRules.js'
import { useSavedFilters } from '../composables/useSavedFilters.js'

export default {
  name: 'PriorityView',
  components: {
    PriorityFilterSelector,
    PriorityFilterEditor,
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
      activeFilterId,
      activeFilter,
      createFilter,
      updateFilter,
      deleteFilter,
      setActiveFilter
    } = useSavedFilters('priorityFilters')

    return {
      filters,
      activeFilterId,
      activeFilter,
      createFilter,
      updateFilter,
      deleteFilter,
      setActiveFilter
    }
  },
  data() {
    return {
      allIssues: [],
      isLoading: false,
      showFilterEditor: false,
      editingFilter: null
    }
  },
  computed: {
    filteredIssues() {
      if (!this.activeFilter) return this.allIssues

      const matchMode = this.activeFilter.matchMode || 'any'

      return this.allIssues.filter(issue => {
        const matchesTeam = this.activeFilter.teams.length > 0 && this.activeFilter.teams.includes(issue.team)
        const matchesComponent = this.activeFilter.components.length > 0 &&
          (issue.components || []).some(c => this.activeFilter.components.includes(c))

        if (matchMode === 'all') {
          const teamCheck = this.activeFilter.teams.length === 0 || matchesTeam
          const componentCheck = this.activeFilter.components.length === 0 || matchesComponent
          return teamCheck && componentCheck
        }

        return matchesTeam || matchesComponent
      })
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
    openNewFilter() {
      this.editingFilter = null
      this.showFilterEditor = true
    },
    openEditFilter(id) {
      this.editingFilter = this.filters.find(f => f.id === id) || null
      this.showFilterEditor = true
    },
    handleSaveFilter(payload) {
      if (this.editingFilter) {
        this.updateFilter(this.editingFilter.id, payload)
      } else {
        const id = this.createFilter(payload)
        this.setActiveFilter(id)
      }
      this.showFilterEditor = false
    }
  }
}
</script>
