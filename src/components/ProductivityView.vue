<template>
  <main class="flex h-[calc(100vh-200px)]">
    <!-- Left Sidebar: Team Tree -->
    <aside class="w-64 bg-white border-r overflow-y-auto p-4">
      <h3 class="font-bold mb-3 text-gray-900">Teams</h3>
      <button
        v-for="team in availableTeams"
        :key="team.name"
        @click="selectTeam(team.name)"
        class="w-full text-left px-3 py-2 rounded hover:bg-blue-50 transition-colors mb-1"
        :class="selectedTeam === team.name ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'"
      >
        {{ team.displayName }}
        <span class="text-xs text-gray-500 ml-1">({{ team.memberCount }})</span>
      </button>
    </aside>

    <!-- Main Content Area -->
    <div class="flex-1 overflow-y-auto px-6 py-4">
      <!-- Filters -->
      <div class="bg-white rounded-lg shadow p-4 mb-6">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <!-- Time Period -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
            <select
              v-model="timePeriod"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="weekly">Weekly (Last 4 Weeks)</option>
              <option value="monthly">Monthly (Last 6 Months)</option>
              <option value="quarterly">Quarterly (Last 4 Quarters)</option>
            </select>
          </div>

          <!-- View Mode Toggle -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">View</label>
            <div class="flex gap-2">
              <button
                @click="viewMode = 'cards'"
                class="flex-1 px-3 py-2 rounded-md transition-colors font-medium"
                :class="viewMode === 'cards' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
              >
                Cards
              </button>
              <button
                @click="viewMode = 'table'"
                class="flex-1 px-3 py-2 rounded-md transition-colors font-medium"
                :class="viewMode === 'table' ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
              >
                Table
              </button>
            </div>
          </div>
        </div>

        <!-- Role Filter -->
        <div v-if="availableRoles.length > 0">
          <label class="block text-sm font-medium text-gray-700 mb-2">Filter by Role</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="role in availableRoles"
              :key="role"
              @click="toggleRoleFilter(role)"
              class="px-3 py-1 rounded-full text-sm transition-colors"
              :class="selectedRoles.includes(role) ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
            >
              {{ role }}
            </button>
            <button
              v-if="selectedRoles.length > 0"
              @click="selectedRoles = []"
              class="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700 hover:bg-red-200"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div v-if="filteredData.length > 0" class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow p-6">
          <h4 class="text-sm text-gray-500 mb-1">Total Issues Resolved</h4>
          <p class="text-3xl font-bold text-blue-700">{{ totalIssuesResolved }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <h4 class="text-sm text-gray-500 mb-1">Avg Issues per Member</h4>
          <p class="text-3xl font-bold text-blue-700">{{ avgIssuesPerMember }}</p>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <h4 class="text-sm text-gray-500 mb-1">Avg Cycle Time</h4>
          <p class="text-3xl font-bold text-blue-700">{{ avgCycleTime }} <span class="text-lg">days</span></p>
        </div>
      </div>

      <!-- Card View -->
      <div v-if="viewMode === 'cards' && filteredData.length > 0" class="mb-6">
        <!-- All Teams: grouped by team -->
        <div v-if="selectedTeam === 'All Teams'" class="space-y-8">
          <div v-for="(members, teamName) in groupedByTeam" :key="teamName">
            <h3 class="text-xl font-bold text-gray-900 border-b pb-2 mb-4">{{ teamName }}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <ProductivityMemberCard v-for="member in members" :key="member.name" :member="member" />
            </div>
          </div>
        </div>

        <!-- Single team: grid only -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <ProductivityMemberCard v-for="member in filteredData" :key="member.name" :member="member" />
        </div>
      </div>

      <!-- Table View -->
      <div v-if="viewMode === 'table' && filteredData.length > 0" class="bg-white rounded-lg shadow overflow-hidden mb-6">
        <table class="min-w-full">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues Resolved</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Story Points</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cycle Time (days)</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="member in filteredData" :key="member.name" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ member.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span :class="getRoleBadgeClass(member.specialty)">{{ member.specialty }}</span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ member.totalIssuesResolved }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ member.totalStoryPoints || 'N/A' }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ member.avgCycleTimeDays !== null ? member.avgCycleTimeDays.toFixed(1) : 'N/A' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Simple Bar Chart -->
      <div v-if="filteredData.length > 0" class="bg-white rounded-lg shadow p-6">
        <h3 class="font-bold mb-4 text-gray-900">Issues Resolved Trend</h3>
        <div class="space-y-2">
          <div v-for="member in sortedByIssues" :key="member.name" class="flex items-center">
            <div class="w-32 text-sm text-gray-700 truncate" :title="member.name">{{ member.name }}</div>
            <div class="flex-1 bg-gray-200 rounded-full h-6 ml-4">
              <div
                class="bg-blue-600 h-6 rounded-full transition-all duration-300"
                :style="{ width: `${(member.totalIssuesResolved / maxIssues * 100)}%` }"
              ></div>
            </div>
            <div class="w-12 text-right text-sm text-gray-700 ml-2">{{ member.totalIssuesResolved }}</div>
          </div>
        </div>
      </div>

      <!-- Empty State: No Team Selected -->
      <div v-if="!selectedTeam" class="text-center py-12 text-gray-500">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p class="text-lg font-medium">Select a team from the sidebar to view productivity metrics.</p>
      </div>

      <!-- Empty State: No Data -->
      <div v-else-if="productivityData.length === 0 && !isLoading" class="text-center py-12 text-gray-500">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-lg font-medium">No resolved issues found for this team in the selected time period.</p>
        <p class="text-sm text-gray-400 mt-2">Try selecting a different time period or team.</p>
      </div>

      <LoadingOverlay v-if="isLoading" />
    </div>
  </main>
</template>

<script>
import LoadingOverlay from './LoadingOverlay.vue'
import ProductivityMemberCard from './ProductivityMemberCard.vue'
import { getProductivityTeams, getProductivityData } from '../services/api'

export default {
  name: 'ProductivityView',
  components: { LoadingOverlay, ProductivityMemberCard },
  props: {
    isRefreshing: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      availableTeams: [],
      selectedTeam: null,
      timePeriod: 'weekly',
      productivityData: [],
      isLoading: false,
      viewMode: 'cards', // 'cards' or 'table'
      selectedRoles: [] // array of role strings
    }
  },
  computed: {
    availableRoles() {
      // Extract unique roles from productivityData
      const roles = new Set();
      this.productivityData.forEach(m => {
        if (m.specialty) roles.add(m.specialty);
      });
      return Array.from(roles).sort();
    },
    filteredData() {
      if (this.selectedRoles.length === 0) {
        return this.productivityData;
      }
      return this.productivityData.filter(m =>
        this.selectedRoles.includes(m.specialty)
      );
    },
    groupedByTeam() {
      // For "All Teams" view - group members by team
      const groups = {};
      this.filteredData.forEach(member => {
        const team = member.team || 'Unknown';
        if (!groups[team]) groups[team] = [];
        groups[team].push(member);
      });
      return groups;
    },
    totalIssuesResolved() {
      return this.filteredData.reduce((sum, e) => sum + e.totalIssuesResolved, 0)
    },
    avgIssuesPerMember() {
      if (this.filteredData.length === 0) return '0'
      return (this.totalIssuesResolved / this.filteredData.length).toFixed(1)
    },
    avgCycleTime() {
      const times = this.filteredData.map(e => e.avgCycleTimeDays).filter(t => t != null)
      if (times.length === 0) return 'N/A'
      return (times.reduce((sum, t) => sum + t, 0) / times.length).toFixed(1)
    },
    sortedByIssues() {
      return [...this.filteredData].sort((a, b) => b.totalIssuesResolved - a.totalIssuesResolved)
    },
    maxIssues() {
      return Math.max(...this.filteredData.map(e => e.totalIssuesResolved), 1)
    }
  },
  watch: {
    selectedTeam() {
      this.saveToLocalStorage()
      this.updateUrlParams()
      this.fetchProductivityData()
    },
    timePeriod() {
      this.saveToLocalStorage()
      this.updateUrlParams()
      this.fetchProductivityData()
    },
    isRefreshing(newVal, oldVal) {
      // When refresh completes (goes from true to false), refetch data
      if (oldVal && !newVal) {
        this.fetchProductivityData()
      }
    }
  },
  mounted() {
    this.parseUrlParams()
    this.loadFromLocalStorage()
    this.fetchTeams()
  },
  methods: {
    async fetchTeams() {
      try {
        const data = await getProductivityTeams()
        this.availableTeams = data.teams || []

        // Auto-select first team if none selected
        if (!this.selectedTeam && this.availableTeams.length > 0) {
          this.selectedTeam = this.availableTeams[0].name
        }
      } catch (error) {
        console.error('Failed to load teams:', error)
        this.availableTeams = []
      }
    },
    async fetchProductivityData() {
      if (!this.selectedTeam) return

      this.isLoading = true
      try {
        const data = await getProductivityData(this.selectedTeam, this.timePeriod)
        this.productivityData = data.members || []
      } catch (error) {
        console.error('Failed to load productivity data:', error)
        this.productivityData = []
      } finally {
        this.isLoading = false
      }
    },
    selectTeam(teamName) {
      this.selectedTeam = teamName
    },
    parseUrlParams() {
      const params = new URLSearchParams(window.location.search)
      const team = params.get('team')
      const period = params.get('period')
      const viewMode = params.get('viewMode')
      const roles = params.get('roles')

      if (team) this.selectedTeam = decodeURIComponent(team)
      if (period && ['weekly', 'monthly', 'quarterly'].includes(period)) {
        this.timePeriod = period
      }
      if (viewMode && ['cards', 'table'].includes(viewMode)) {
        this.viewMode = viewMode
      }
      if (roles) {
        this.selectedRoles = roles.split(',').map(r => r.trim())
      }
    },
    updateUrlParams() {
      const params = new URLSearchParams(window.location.search)

      // Preserve the view parameter
      const currentView = params.get('view')
      params.delete('view')
      params.delete('team')
      params.delete('period')
      params.delete('viewMode')
      params.delete('roles')

      if (currentView) params.set('view', currentView)
      if (this.selectedTeam) {
        params.set('team', encodeURIComponent(this.selectedTeam))
      }
      params.set('period', this.timePeriod)
      params.set('viewMode', this.viewMode)
      if (this.selectedRoles.length > 0) {
        params.set('roles', this.selectedRoles.join(','))
      }

      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState({}, '', newUrl)
    },
    loadFromLocalStorage() {
      try {
        const saved = localStorage.getItem('productivity-filters')
        if (saved) {
          const filters = JSON.parse(saved)
          // Only restore if URL didn't override
          const urlParams = new URLSearchParams(window.location.search)
          if (!urlParams.get('team') && filters.team) {
            this.selectedTeam = filters.team
          }
          if (!urlParams.get('period') && filters.period) {
            this.timePeriod = filters.period
          }
          if (!urlParams.get('viewMode') && filters.viewMode) {
            this.viewMode = filters.viewMode
          }
          if (!urlParams.get('roles') && filters.roles) {
            this.selectedRoles = filters.roles
          }
        }
      } catch (error) {
        console.error('Failed to load from localStorage:', error)
      }
    },
    saveToLocalStorage() {
      try {
        localStorage.setItem('productivity-filters', JSON.stringify({
          team: this.selectedTeam,
          period: this.timePeriod,
          viewMode: this.viewMode,
          roles: this.selectedRoles
        }))
      } catch (error) {
        console.error('Failed to save to localStorage:', error)
      }
    },
    getRoleBadgeClass(specialty) {
      const roleColors = {
        'Backend Engineer': 'bg-blue-100 text-blue-800',
        'QE': 'bg-purple-100 text-purple-800',
        'UI': 'bg-pink-100 text-pink-800',
        'Manager': 'bg-green-100 text-green-800',
        'Staff Engineers': 'bg-indigo-100 text-indigo-800',
        'Architects': 'bg-orange-100 text-orange-800',
        'Agilist': 'bg-yellow-100 text-yellow-800',
        'DevOps': 'bg-teal-100 text-teal-800',
        'BFF': 'bg-cyan-100 text-cyan-800',
        'Operations Manager': 'bg-red-100 text-red-800'
      };
      const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
      const colorClass = roleColors[specialty] || 'bg-gray-100 text-gray-800';
      return `${baseClasses} ${colorClass}`;
    },
    toggleRoleFilter(role) {
      const index = this.selectedRoles.indexOf(role);
      if (index > -1) {
        this.selectedRoles.splice(index, 1);
      } else {
        this.selectedRoles.push(role);
      }
      this.saveToLocalStorage();
      this.updateUrlParams();
    }
  }
}
</script>
