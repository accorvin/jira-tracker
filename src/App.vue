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
            :disabled="isRefreshing || !selectedRelease"
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

    <ReleaseTabBar
      v-if="isInitialized"
      :releases="releases"
      :selectedRelease="selectedRelease"
      @select="selectRelease"
      @add="openAddModal"
    />

    <main class="flex">
      <ReleaseInfoPanel
        v-if="currentRelease"
        :release="currentRelease"
        @edit="openEditModal"
        @delete="confirmDeleteRelease"
      />

      <div class="flex-1 container mx-auto px-6 py-8">
        <FilterBar
          v-if="allIssues.length > 0"
          :issues="allIssues"
          @filter-change="handleFilterChange"
        />

        <KanbanBoard :issues="filteredIssues" />

        <div v-if="isInitialized && !selectedRelease" class="text-center py-12 text-gray-500">
          <p class="text-lg">No releases configured.</p>
          <p>Click "+ Add" above to add your first release.</p>
        </div>
      </div>
    </main>

    <ReleaseModal
      :show="showReleaseModal"
      :release="editingRelease"
      @save="saveRelease"
      @cancel="closeModal"
    />
  </div>
</template>

<script>
import KanbanBoard from './components/KanbanBoard.vue'
import FilterBar from './components/FilterBar.vue'
import ReleaseTabBar from './components/ReleaseTabBar.vue'
import ReleaseInfoPanel from './components/ReleaseInfoPanel.vue'
import ReleaseModal from './components/ReleaseModal.vue'

export default {
  name: 'App',
  components: {
    KanbanBoard,
    FilterBar,
    ReleaseTabBar,
    ReleaseInfoPanel,
    ReleaseModal
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
      },
      releases: [],
      selectedRelease: null,
      showReleaseModal: false,
      editingRelease: null,
      isInitialized: false
    }
  },
  computed: {
    currentRelease() {
      return this.releases.find(r => r.name === this.selectedRelease)
    }
  },
  async mounted() {
    await this.loadReleases()
    if (this.selectedRelease) {
      await this.refreshData()
    }
  },
  methods: {
    async loadReleases() {
      try {
        const response = await fetch('/api/releases')
        const data = await response.json()
        this.releases = data.releases || []

        if (this.releases.length === 0) {
          this.showReleaseModal = true
        } else {
          const saved = localStorage.getItem('selectedRelease')
          if (saved && this.releases.find(r => r.name === saved)) {
            this.selectedRelease = saved
          } else {
            this.selectedRelease = this.getLowestVersion()
          }
        }
      } catch (error) {
        console.error('Failed to load releases:', error)
        this.releases = []
        this.showReleaseModal = true
      }
      this.isInitialized = true
    },

    getLowestVersion() {
      if (this.releases.length === 0) return null
      return this.releases
        .slice()
        .sort((a, b) => {
          const aMatch = a.name.match(/rhoai-(\d+)\.(\d+)/)
          const bMatch = b.name.match(/rhoai-(\d+)\.(\d+)/)
          if (!aMatch || !bMatch) return 0
          const [, aMaj, aMin] = aMatch.map(Number)
          const [, bMaj, bMin] = bMatch.map(Number)
          if (aMaj !== bMaj) return aMaj - bMaj
          return aMin - bMin
        })[0]?.name
    },

    async selectRelease(releaseName) {
      if (releaseName === this.selectedRelease) return
      this.selectedRelease = releaseName
      localStorage.setItem('selectedRelease', releaseName)
      await this.refreshData()
    },

    async saveRelease(releaseData) {
      if (this.editingRelease) {
        const index = this.releases.findIndex(r => r.name === this.editingRelease.name)
        if (index !== -1) {
          this.releases[index] = releaseData
        }
      } else {
        this.releases.push(releaseData)
      }

      try {
        await fetch('/api/releases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ releases: this.releases })
        })
      } catch (error) {
        console.error('Failed to save releases:', error)
        alert('Failed to save release configuration')
      }

      this.showReleaseModal = false
      this.editingRelease = null

      if (!this.selectedRelease) {
        await this.selectRelease(releaseData.name)
      }
    },

    async confirmDeleteRelease() {
      if (!confirm(`Are you sure you want to delete ${this.selectedRelease}?`)) {
        return
      }

      const index = this.releases.findIndex(r => r.name === this.selectedRelease)
      if (index !== -1) {
        this.releases.splice(index, 1)
      }

      try {
        await fetch('/api/releases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ releases: this.releases })
        })
      } catch (error) {
        console.error('Failed to save releases:', error)
      }

      if (this.releases.length > 0) {
        await this.selectRelease(this.getLowestVersion())
      } else {
        this.selectedRelease = null
        localStorage.removeItem('selectedRelease')
        this.allIssues = []
        this.filteredIssues = []
        this.showReleaseModal = true
      }
    },

    openAddModal() {
      this.editingRelease = null
      this.showReleaseModal = true
    },

    openEditModal() {
      this.editingRelease = this.currentRelease
      this.showReleaseModal = true
    },

    closeModal() {
      this.showReleaseModal = false
      this.editingRelease = null
    },

    async fetchIssues() {
      try {
        const response = await fetch('/issues.json')
        const data = await response.json()

        this.allIssues = data.issues
        this.filteredIssues = data.issues
        this.lastUpdated = data.lastUpdated
        this.applyFilters()
      } catch (error) {
        console.error('Failed to fetch issues:', error)
        this.allIssues = []
        this.filteredIssues = []
      }
    },

    handleFilterChange(filters) {
      this.filters = filters
      this.applyFilters()
    },

    applyFilters() {
      this.filteredIssues = this.allIssues.filter(issue => {
        if (this.filters.assignee && issue.assignee !== this.filters.assignee) {
          return false
        }
        if (this.filters.status && issue.status !== this.filters.status) {
          return false
        }
        if (this.filters.team && issue.team !== this.filters.team) {
          return false
        }
        if (this.filters.issueType && issue.issueType !== this.filters.issueType) {
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
      if (!this.selectedRelease) return

      this.isRefreshing = true

      try {
        const response = await fetch('/api/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetRelease: this.selectedRelease })
        })

        const result = await response.json()

        if (result.success) {
          await this.fetchIssues()
          console.log(`Refreshed ${result.count} issues for ${this.selectedRelease}`)
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
