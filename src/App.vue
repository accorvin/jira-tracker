<template>
  <AuthGuard>
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
            :disabled="isRefreshing || releases.length === 0"
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

          <!-- User Avatar and Sign Out -->
          <div class="relative" v-if="authUser">
            <button
              @click="showUserMenu = !showUserMenu"
              class="flex items-center gap-2 hover:bg-primary-600 rounded-full p-1 transition-colors"
            >
              <!-- Show initials if no photo or photo failed to load -->
              <div
                v-if="!authUser.photoURL || avatarLoadError"
                class="h-10 w-10 rounded-full border-2 border-white bg-white text-primary-700 flex items-center justify-center font-bold text-sm"
              >
                {{ getUserInitials(authUser) }}
              </div>
              <!-- Try to show photo if available and hasn't failed -->
              <img
                v-else
                :src="authUser.photoURL"
                :alt="authUser.displayName || authUser.email"
                class="h-10 w-10 rounded-full border-2 border-white"
                @error="avatarLoadError = true"
              />
            </button>

            <!-- Dropdown menu -->
            <div
              v-if="showUserMenu"
              class="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10"
            >
              <div class="px-4 py-2 border-b border-gray-200">
                <p class="text-sm font-medium text-gray-900">{{ authUser.displayName }}</p>
                <p class="text-xs text-gray-500 truncate">{{ authUser.email }}</p>
              </div>
              <button
                @click="handleSignOut"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
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
  </AuthGuard>
</template>

<script>
import AuthGuard from './components/AuthGuard.vue'
import KanbanBoard from './components/KanbanBoard.vue'
import FilterBar from './components/FilterBar.vue'
import ReleaseTabBar from './components/ReleaseTabBar.vue'
import ReleaseInfoPanel from './components/ReleaseInfoPanel.vue'
import ReleaseModal from './components/ReleaseModal.vue'
import { useAuth } from './composables/useAuth'
import { refreshIssues, getIssues, getReleases, saveReleases } from './services/api'

export default {
  name: 'App',
  components: {
    AuthGuard,
    KanbanBoard,
    FilterBar,
    ReleaseTabBar,
    ReleaseInfoPanel,
    ReleaseModal
  },
  setup() {
    const { user: authUser, signOut } = useAuth()
    return {
      authUser,
      signOut
    }
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
      isInitialized: false,
      showUserMenu: false,
      avatarLoadError: false
    }
  },
  computed: {
    currentRelease() {
      return this.releases.find(r => r.name === this.selectedRelease)
    }
  },
  watch: {
    authUser(newUser) {
      // Reset avatar error when user changes
      this.avatarLoadError = false
    }
  },
  async mounted() {
    await this.loadReleases()
    if (this.selectedRelease) {
      await this.fetchIssues()
    }

    // Close user menu when clicking outside
    document.addEventListener('click', this.handleClickOutside)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
  },
  methods: {
    async loadReleases() {
      try {
        const data = await getReleases()
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

        if (error.message.includes('Authentication')) {
          // Don't show modal on auth error - user will see auth screen
          this.releases = []
        } else {
          this.releases = []
          this.showReleaseModal = true
        }
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
      await this.fetchIssues()
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
        await saveReleases(this.releases)
      } catch (error) {
        console.error('Failed to save releases:', error)

        if (error.message.includes('Authentication')) {
          alert('Your session has expired. Please refresh the page and sign in again.')
        } else {
          alert('Failed to save release configuration')
        }
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
        await saveReleases(this.releases)
      } catch (error) {
        console.error('Failed to save releases:', error)

        if (error.message.includes('Authentication')) {
          alert('Your session has expired. Please refresh the page and sign in again.')
        }
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
      if (!this.selectedRelease) {
        this.allIssues = []
        this.filteredIssues = []
        this.lastUpdated = null
        return
      }

      try {
        const data = await getIssues(this.selectedRelease)

        this.allIssues = data.issues
        this.filteredIssues = data.issues
        this.lastUpdated = data.lastUpdated
        this.applyFilters()
      } catch (error) {
        console.error(`Failed to fetch issues for ${this.selectedRelease}:`, error)

        // Show user-friendly error message
        if (error.message.includes('No data found')) {
          alert(`No data found for ${this.selectedRelease}. Click the Refresh button to fetch data from Jira.`)
        } else if (error.message.includes('Authentication')) {
          alert('Your session has expired. Please refresh the page and sign in again.')
        } else {
          alert(`Failed to load issues: ${error.message}`)
        }

        this.allIssues = []
        this.filteredIssues = []
        this.lastUpdated = null
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
      if (this.releases.length === 0) return

      this.isRefreshing = true

      try {
        const result = await refreshIssues(this.releases)

        if (result.success) {
          await this.fetchIssues()
          console.log(`Refreshed ${result.totalCount} issues across ${result.results.length} releases`)
          alert(`Successfully refreshed ${result.totalCount} issues!`)
        } else {
          const failedReleases = result.results.filter(r => r.error)
          if (failedReleases.length > 0) {
            console.error('Some releases failed:', failedReleases)
            alert(`Partially successful. Failed releases: ${failedReleases.map(r => r.release).join(', ')}`)
          }
          await this.fetchIssues()
        }
      } catch (error) {
        console.error('Refresh error:', error)

        if (error.message.includes('Authentication')) {
          alert('Your session has expired. Please refresh the page and sign in again.')
        } else {
          alert(`Failed to refresh: ${error.message}`)
        }
      } finally {
        this.isRefreshing = false
      }
    },

    async handleSignOut() {
      this.showUserMenu = false
      await this.signOut()
    },

    handleClickOutside(event) {
      const userMenu = event.target.closest('.relative')
      if (!userMenu) {
        this.showUserMenu = false
      }
    },

    getUserInitials(user) {
      if (!user) return '?'

      if (user.displayName) {
        const parts = user.displayName.split(' ')
        if (parts.length >= 2) {
          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        }
        return user.displayName.substring(0, 2).toUpperCase()
      }

      if (user.email) {
        return user.email.substring(0, 2).toUpperCase()
      }

      return '??'
    }
  }
}
</script>
