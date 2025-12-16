<template>
  <main class="container mx-auto px-6 py-8">
    <!-- Filters -->
    <div class="mb-6 flex gap-4">
      <select
        v-model="teamFilter"
        class="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm"
      >
        <option value="">All Teams</option>
        <option v-for="team in availableTeams" :key="team" :value="team">
          {{ team }}
        </option>
      </select>

      <select
        v-model="componentFilter"
        class="px-4 py-2 border border-gray-300 rounded-md bg-white text-sm"
      >
        <option value="">All Components</option>
        <option v-for="comp in availableComponents" :key="comp" :value="comp">
          {{ comp }}
        </option>
      </select>
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
  </main>
</template>

<script>
import draggable from 'vuedraggable'
import TeamSection from './TeamSection.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import { getIntakeFeatures } from '../services/api'

const STORAGE_KEY = 'feature-intake-group-order'
const FILTER_STORAGE_KEY = 'feature-intake-filters'

export default {
  name: 'IntakeView',
  components: {
    draggable,
    TeamSection,
    LoadingOverlay
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
    }
  }
}
</script>
