<template>
  <main class="flex-1 px-4 py-4 relative">
    <RoadmapFilterBar
      :issues="allIssues"
      @filter-change="handleFilterChange"
    />

    <RoadmapBoard :issues="filteredIssues" />

    <LoadingOverlay v-if="isLoading" data-testid="loading-overlay" />
  </main>
</template>

<script>
import RoadmapFilterBar from './RoadmapFilterBar.vue'
import RoadmapBoard from './RoadmapBoard.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import { getAllIssues } from '../services/api'

export default {
  name: 'RoadmapView',
  components: {
    RoadmapFilterBar,
    RoadmapBoard,
    LoadingOverlay
  },
  props: {
    releases: {
      type: Array,
      required: true,
      default: () => []
    },
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
        value: ''
      }
    }
  },
  computed: {
    filteredIssues() {
      if (!this.filter.value) {
        return this.allIssues
      }

      return this.allIssues.filter(issue => {
        if (this.filter.mode === 'team') {
          return issue.team === this.filter.value
        } else {
          // Component mode
          const components = issue.components || []
          return components.includes(this.filter.value)
        }
      })
    }
  },
  watch: {
    isRefreshing(newVal, oldVal) {
      // Reload data after refresh completes
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
        const data = await getAllIssues(this.releases)
        this.allIssues = data.issues || []
      } catch (error) {
        console.error('Failed to load roadmap issues:', error)
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
