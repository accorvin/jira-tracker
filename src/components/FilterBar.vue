<template>
  <div class="bg-white rounded-lg shadow-md p-3 mb-3">
    <div class="flex flex-wrap lg:flex-nowrap gap-2 items-center">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <label class="text-xs font-medium text-gray-500 whitespace-nowrap">Assignee:</label>
        <select
          v-model="filters.assignee"
          @change="emitFilterChange"
          class="flex-1 min-w-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
        >
          <option value="">All</option>
          <option v-for="assignee in assigneeOptions" :key="assignee" :value="assignee">
            {{ assignee }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2 flex-1 min-w-0">
        <label class="text-xs font-medium text-gray-500 whitespace-nowrap">Status:</label>
        <select
          v-model="filters.status"
          @change="emitFilterChange"
          class="flex-1 min-w-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
        >
          <option value="">All</option>
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2 flex-1 min-w-0">
        <label class="text-xs font-medium text-gray-500 whitespace-nowrap">Team:</label>
        <select
          v-model="filters.team"
          @change="emitFilterChange"
          class="flex-1 min-w-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
        >
          <option value="">All</option>
          <option v-for="team in teamOptions" :key="team" :value="team">
            {{ team }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2 flex-1 min-w-0">
        <label class="text-xs font-medium text-gray-500 whitespace-nowrap">Type:</label>
        <select
          v-model="filters.issueType"
          @change="emitFilterChange"
          class="flex-1 min-w-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
        >
          <option value="">All</option>
          <option v-for="type in issueTypeOptions" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </div>

      <button
        @click="clearFilters"
        class="px-3 py-1 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-md transition-colors border border-blue-200 whitespace-nowrap"
      >
        Clear Filters
      </button>
    </div>
  </div>
</template>

<script>
const STORAGE_KEY = 'kanban-filters'

export default {
  name: 'FilterBar',
  props: {
    issues: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  data() {
    return {
      filters: this.loadFilters()
    }
  },
  mounted() {
    // Emit initial filter state if filters were loaded from storage
    if (this.hasPersistedFilters()) {
      this.emitFilterChange()
    }
  },
  computed: {
    assigneeOptions() {
      const assignees = new Set()
      this.issues.forEach(issue => {
        if (issue.assignee) {
          assignees.add(issue.assignee)
        }
      })
      return Array.from(assignees).sort()
    },
    statusOptions() {
      const statuses = new Set()
      this.issues.forEach(issue => {
        if (issue.status) {
          statuses.add(issue.status)
        }
      })
      return Array.from(statuses).sort()
    },
    teamOptions() {
      const teams = new Set()
      this.issues.forEach(issue => {
        if (issue.team) {
          teams.add(issue.team)
        }
      })
      return Array.from(teams).sort()
    },
    issueTypeOptions() {
      const types = new Set()
      this.issues.forEach(issue => {
        if (issue.issueType) {
          types.add(issue.issueType)
        }
      })
      return Array.from(types).sort()
    }
  },
  methods: {
    loadFilters() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          return JSON.parse(saved)
        }
      } catch (error) {
        console.error('Failed to load filters from localStorage:', error)
      }
      return {
        assignee: '',
        status: '',
        team: '',
        issueType: ''
      }
    },
    hasPersistedFilters() {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved !== null
    },
    saveFilters() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.filters))
      } catch (error) {
        console.error('Failed to save filters to localStorage:', error)
      }
    },
    emitFilterChange() {
      this.saveFilters()
      this.$emit('filter-change', { ...this.filters })
    },
    clearFilters() {
      this.filters = {
        assignee: '',
        status: '',
        team: '',
        issueType: ''
      }
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Failed to remove filters from localStorage:', error)
      }
      this.emitFilterChange()
    }
  }
}
</script>
