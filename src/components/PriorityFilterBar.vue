<template>
  <div class="bg-white rounded-lg shadow-sm p-2 mb-2">
    <div class="flex flex-wrap lg:flex-nowrap gap-2 items-center">
      <!-- Mode Toggle -->
      <div data-testid="filter-mode-toggle" class="flex rounded-md overflow-hidden border border-gray-300">
        <button
          data-testid="mode-team"
          @click="setMode('team')"
          class="px-3 py-1 text-sm font-medium transition-colors"
          :class="mode === 'team' ? 'bg-primary-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
        >
          Team
        </button>
        <button
          data-testid="mode-component"
          @click="setMode('component')"
          class="px-3 py-1 text-sm font-medium transition-colors"
          :class="mode === 'component' ? 'bg-primary-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
        >
          Component
        </button>
      </div>

      <!-- Filter Select -->
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <label class="text-xs font-medium text-gray-500 whitespace-nowrap">
          {{ mode === 'team' ? 'Team:' : 'Component:' }}
        </label>
        <select
          data-testid="filter-select"
          v-model="selectedValue"
          @change="emitFilterChange"
          class="flex-1 min-w-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none"
        >
          <option value="">{{ mode === 'team' ? 'All Teams' : 'All Components' }}</option>
          <option v-for="option in filterOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </div>

    </div>
  </div>
</template>

<script>
const STORAGE_KEY = 'priority-filter'

export default {
  name: 'PriorityFilterBar',
  props: {
    issues: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  data() {
    return {
      mode: 'team',
      selectedValue: ''
    }
  },
  mounted() {
    this.loadFilter()
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
    filterOptions() {
      return this.mode === 'team' ? this.teamOptions : this.componentOptions
    }
  },
  methods: {
    setMode(newMode) {
      if (this.mode !== newMode) {
        this.mode = newMode
        this.selectedValue = ''
        this.emitFilterChange()
      }
    },
    loadFilter() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          this.mode = parsed.mode || 'team'
          this.selectedValue = parsed.value || ''
        }
      } catch (error) {
        console.error('Failed to load priority filter from localStorage:', error)
      }
    },
    saveFilter() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          mode: this.mode,
          value: this.selectedValue
        }))
      } catch (error) {
        console.error('Failed to save priority filter to localStorage:', error)
      }
    },
    emitFilterChange() {
      this.saveFilter()
      this.$emit('filter-change', {
        mode: this.mode,
        value: this.selectedValue
      })
    }
  }
}
</script>
