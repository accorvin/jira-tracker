<template>
  <main class="container mx-auto px-6 py-8">
    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-md p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Team</label>
          <select
            v-model="teamFilter"
            class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
          >
            <option value="">All</option>
            <option v-for="team in availableTeams" :key="team" :value="team">
              {{ team }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Component</label>
          <select
            v-model="componentFilter"
            class="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
          >
            <option value="">All</option>
            <option v-for="comp in availableComponents" :key="comp" :value="comp">
              {{ comp }}
            </option>
          </select>
        </div>

        <div>
          <button
            @click="clearFilters"
            class="w-full px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-md transition-colors border border-blue-200"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>

    <!-- Last Updated -->
    <div v-if="lastUpdated" class="mb-4 text-sm text-gray-500">
      Last Updated: {{ formatDate(lastUpdated) }}
    </div>

    <!-- Team Sections (draggable) -->
    <draggable
      v-model="orderedTeams"
      item-key="name"
      handle=".drag-handle"
      @end="saveGroupOrder"
    >
      <template #item="{ element: team }">
        <TeamSection
          v-if="shouldShowTeam(team.name)"
          :teamName="team.name"
          :features="getFeaturesForTeam(team.name)"
          class="mb-6"
        />
      </template>
    </draggable>

    <!-- Empty state -->
    <div v-if="filteredFeatures.length === 0 && !isLoading" class="text-center py-12 text-gray-500">
      <p class="text-lg">No features awaiting intake.</p>
      <p>All caught up!</p>
    </div>

    <LoadingOverlay v-if="isLoading" />

    <HelpBubble
      storageKey="feature-intake-help-dismissed"
      title="About Feature Intake"
      content="This page shows Features and Initiatives in 'New' status that are linked to approved RFEs and don't have a target release yet. Use this to review and prioritize incoming work."
    />
  </main>
</template>

<script>
import draggable from 'vuedraggable'
import TeamSection from './TeamSection.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import HelpBubble from './HelpBubble.vue'
import { getIntakeFeatures } from '../services/api'

const STORAGE_KEY = 'feature-intake-group-order'
const FILTER_STORAGE_KEY = 'feature-intake-filters'

export default {
  name: 'IntakeView',
  components: {
    draggable,
    TeamSection,
    LoadingOverlay,
    HelpBubble
  },
  props: {
    isRefreshing: Boolean
  },
  data() {
    return {
      features: [],
      lastUpdated: null,
      isLoading: false,
      teamFilter: '',
      componentFilter: '',
      orderedTeams: []
    }
  },
  computed: {
    filteredFeatures() {
      return this.features.filter(f => {
        if (this.teamFilter && f.team !== this.teamFilter) return false
        if (this.componentFilter && f.component !== this.componentFilter) return false
        return true
      })
    },
    availableTeams() {
      const teams = new Set(this.features.map(f => f.team).filter(Boolean))
      return [...teams].sort()
    },
    availableComponents() {
      const components = new Set(this.features.map(f => f.component).filter(Boolean))
      return [...components].sort()
    }
  },
  watch: {
    isRefreshing(newVal, oldVal) {
      // Reload data after refresh completes
      if (oldVal && !newVal) {
        this.loadFeatures()
      }
    },
    teamFilter() {
      this.saveFilters()
    },
    componentFilter() {
      this.saveFilters()
    }
  },
  mounted() {
    this.loadFeatures()
    this.loadGroupOrder()
    this.loadFilters()
  },
  methods: {
    async loadFeatures() {
      this.isLoading = true
      try {
        const data = await getIntakeFeatures()
        this.features = data.features || []
        this.lastUpdated = data.lastUpdated
        this.updateTeamsList()
      } catch (error) {
        console.error('Failed to load intake features:', error)
        // Show empty state on error
        this.features = []
      } finally {
        this.isLoading = false
      }
    },
    updateTeamsList() {
      // Get all unique teams, putting "Unassigned" first
      const teams = new Set()
      teams.add(null) // Unassigned team
      this.features.forEach(f => teams.add(f.team))

      const savedOrder = this.getSavedOrder()
      const teamObjects = [...teams].map(t => ({
        name: t,
        displayName: t || 'Unassigned Team'
      }))

      // Sort by saved order, with new teams at end
      if (savedOrder.length > 0) {
        teamObjects.sort((a, b) => {
          const aIndex = savedOrder.indexOf(a.name)
          const bIndex = savedOrder.indexOf(b.name)
          if (aIndex === -1 && bIndex === -1) return 0
          if (aIndex === -1) return 1
          if (bIndex === -1) return -1
          return aIndex - bIndex
        })
      } else {
        // Default: Unassigned first, then alphabetical
        teamObjects.sort((a, b) => {
          if (a.name === null) return -1
          if (b.name === null) return 1
          return (a.name || '').localeCompare(b.name || '')
        })
      }

      this.orderedTeams = teamObjects
    },
    getFeaturesForTeam(teamName) {
      return this.filteredFeatures
        .filter(f => f.team === teamName)
        .sort((a, b) => {
          // Sort by RICE score descending, nulls last
          if (a.riceScore == null && b.riceScore == null) return 0
          if (a.riceScore == null) return 1
          if (b.riceScore == null) return -1
          return b.riceScore - a.riceScore
        })
    },
    shouldShowTeam(teamName) {
      return this.getFeaturesForTeam(teamName).length > 0
    },
    formatDate(dateString) {
      return new Date(dateString).toLocaleString()
    },
    getSavedOrder() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    },
    saveGroupOrder() {
      const order = this.orderedTeams.map(t => t.name)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
    },
    loadGroupOrder() {
      // Order is applied in updateTeamsList
    },
    loadFilters() {
      try {
        const saved = localStorage.getItem(FILTER_STORAGE_KEY)
        if (saved) {
          const filters = JSON.parse(saved)
          this.teamFilter = filters.team || ''
          this.componentFilter = filters.component || ''
        }
      } catch {
        // Ignore errors
      }
    },
    saveFilters() {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        team: this.teamFilter,
        component: this.componentFilter
      }))
    },
    clearFilters() {
      this.teamFilter = ''
      this.componentFilter = ''
      try {
        localStorage.removeItem(FILTER_STORAGE_KEY)
      } catch (error) {
        console.error('Failed to remove filters from localStorage:', error)
      }
    }
  }
}
</script>
