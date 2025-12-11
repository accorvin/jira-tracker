<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <header class="bg-primary-700 text-white shadow-lg">
      <div class="container mx-auto px-6 py-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <img src="/redhat-logo.svg" alt="Red Hat" class="h-12" />
          <h1 class="text-3xl font-bold">RHOAI T&E Features-at-a-Glance</h1>
        </div>
        <div class="flex items-center gap-4">
          <div v-if="lastUpdated" class="text-sm text-primary-100">
            Last Updated: {{ formatDate(lastUpdated) }}
          </div>
          <button
            @click="refreshData"
            :disabled="isRefreshing"
            class="px-4 py-2 bg-white text-primary-700 rounded-md font-medium hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg
              v-if="isRefreshing"
              class="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg
              v-else
              class="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
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
      isRefreshing: false,
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
    },
    async refreshData() {
      this.isRefreshing = true

      try {
        const response = await fetch('/api/refresh', {
          method: 'POST'
        })

        const result = await response.json()

        if (result.success) {
          // Reload the issues from the updated file
          await this.fetchIssues()
          console.log(`Refreshed ${result.count} issues`)
        } else {
          console.error('Refresh failed:', result.error)
          alert(`Failed to refresh: ${result.error}`)
        }
      } catch (error) {
        console.error('Refresh error:', error)
        alert(`Failed to refresh: ${error.message}`)
      } finally {
        this.isRefreshing = false
      }
    }
  }
}
</script>
