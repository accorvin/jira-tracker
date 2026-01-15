<template>
  <div class="bg-white rounded-lg shadow-sm p-2 mb-2">
    <div class="flex flex-wrap lg:flex-nowrap gap-2 items-center">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <label class="text-xs font-medium text-gray-500 whitespace-nowrap">Team:</label>
        <MultiSelectDropdown
          v-model="filters.teams"
          :options="teamOptions"
          placeholder="All Teams"
          class="flex-1 min-w-0"
          @update:modelValue="emitFilterChange"
        />
      </div>

      <div class="flex items-center gap-2 flex-1 min-w-0">
        <label class="text-xs font-medium text-gray-500 whitespace-nowrap">Component:</label>
        <MultiSelectDropdown
          v-model="filters.components"
          :options="componentOptions"
          placeholder="All Components"
          class="flex-1 min-w-0"
          @update:modelValue="emitFilterChange"
        />
      </div>

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
import MultiSelectDropdown from './MultiSelectDropdown.vue'

const STORAGE_KEY = 'kanban-filters-v2'

export default {
  name: 'FilterBar',
  components: {
    MultiSelectDropdown
  },
  props: {
    issues: {
      type: Array,
      required: true,
      default: () => []
    },
    initialFilters: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      filters: this.loadFilters()
    }
  },
  mounted() {
    // Apply initial filters from URL if provided
    if (this.initialFilters) {
      this.filters = { ...this.filters, ...this.initialFilters }
      this.saveFilters()
    }
    // Emit initial filter state
    this.emitFilterChange()
  },
  computed: {
    teamOptions() {
      const teams = new Set()
      this.issues.forEach(issue => {
        if (issue.team) {
          teams.add(issue.team)
        }
      })
      return Array.from(teams).sort()
    },
    componentOptions() {
      const components = new Set()
      this.issues.forEach(issue => {
        if (issue.components && Array.isArray(issue.components)) {
          issue.components.forEach(c => components.add(c))
        }
      })
      return Array.from(components).sort()
    },
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
          const parsed = JSON.parse(saved)
          // Ensure arrays exist for multi-select fields
          return {
            teams: parsed.teams || [],
            components: parsed.components || [],
            assignee: parsed.assignee || '',
            status: parsed.status || '',
            issueType: parsed.issueType || ''
          }
        }
      } catch (error) {
        console.error('Failed to load filters from localStorage:', error)
      }
      return {
        teams: [],
        components: [],
        assignee: '',
        status: '',
        issueType: ''
      }
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
        teams: [],
        components: [],
        assignee: '',
        status: '',
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
