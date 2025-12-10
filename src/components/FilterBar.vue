<template>
  <div class="bg-white rounded-lg shadow-md p-6 mb-6">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Assignee</label>
        <select
          v-model="filters.assignee"
          @change="emitFilterChange"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All</option>
          <option v-for="assignee in assigneeOptions" :key="assignee" :value="assignee">
            {{ assignee }}
          </option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
        <select
          v-model="filters.status"
          @change="emitFilterChange"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All</option>
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Team</label>
        <select
          v-model="filters.team"
          @change="emitFilterChange"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All</option>
          <option v-for="team in teamOptions" :key="team" :value="team">
            {{ team }}
          </option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Issue Type</label>
        <select
          v-model="filters.issueType"
          @change="emitFilterChange"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">All</option>
          <option v-for="type in issueTypeOptions" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </div>

      <div>
        <button
          @click="clearFilters"
          class="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>
  </div>
</template>

<script>
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
      filters: {
        assignee: '',
        status: '',
        team: '',
        issueType: ''
      }
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
    emitFilterChange() {
      this.$emit('filter-change', { ...this.filters })
    },
    clearFilters() {
      this.filters = {
        assignee: '',
        status: '',
        team: '',
        issueType: ''
      }
      this.emitFilterChange()
    }
  }
}
</script>
