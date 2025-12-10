<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <header class="bg-primary-700 text-white shadow-lg">
      <div class="container mx-auto px-6 py-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <img src="/redhat-logo.svg" alt="Red Hat" class="h-12" />
          <h1 class="text-3xl font-bold">RHOAI T&E Features-at-a-Glance</h1>
        </div>
        <div v-if="lastUpdated" class="text-sm text-primary-100">
          Last Updated: {{ formatDate(lastUpdated) }}
        </div>
      </div>
    </header>

    <main class="container mx-auto px-6 py-8">
      <FilterBar
        v-if="allIssues.length > 0"
        :issues="allIssues"
        @filter-change="handleFilterChange"
      />

      <KanbanBoard :issues="filteredIssues" />
    </main>
  </div>
</template>

<script>
import KanbanBoard from './components/KanbanBoard.vue'
import FilterBar from './components/FilterBar.vue'

export default {
  name: 'App',
  components: {
    KanbanBoard,
    FilterBar
  },
  data() {
    return {
      allIssues: [],
      filteredIssues: [],
      lastUpdated: null,
      filters: {
        assignee: '',
        status: '',
        team: '',
        issueType: ''
      }
    }
  },
  async mounted() {
    await this.fetchIssues()
  },
  methods: {
    async fetchIssues() {
      try {
        const response = await fetch('/issues.json')
        const data = await response.json()

        this.allIssues = data.issues
        this.filteredIssues = data.issues
        this.lastUpdated = data.lastUpdated
      } catch (error) {
        console.error('Failed to fetch issues:', error)
      }
    },
    handleFilterChange(filters) {
      this.filters = filters

      this.filteredIssues = this.allIssues.filter(issue => {
        if (filters.assignee && issue.assignee !== filters.assignee) {
          return false
        }
        if (filters.status && issue.status !== filters.status) {
          return false
        }
        if (filters.team && issue.team !== filters.team) {
          return false
        }
        if (filters.issueType && issue.issueType !== filters.issueType) {
          return false
        }
        return true
      })
    },
    formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleString()
    }
  }
}
</script>
