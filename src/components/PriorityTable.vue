<template>
  <div class="bg-white rounded-lg shadow-sm overflow-hidden">
    <div v-if="sortedIssues.length === 0" class="p-8 text-center text-gray-500">
      No issues to display
    </div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 sticky top-0">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-gray-600 w-16">Rank</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600 w-36">Key</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600">Summary</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600 w-40">Team</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600 w-28">Status</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600 w-20">Color</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-600 w-32">Target Release</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(issue, index) in sortedIssues"
            :key="issue.key"
            class="border-t border-gray-100 border-l-4"
            :class="rowClasses()"
          >
            <td class="px-3 py-2">
              <span
                data-testid="rank-badge"
                class="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-bold"
                :class="rankBadgeClass()"
              >
                {{ issue.displayRank }}
              </span>
            </td>
            <td class="px-3 py-2">
              <a
                data-testid="issue-link"
                :href="'https://issues.redhat.com/browse/' + issue.key"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 hover:text-primary-800 font-medium"
              >
                {{ issue.key }}
              </a>
            </td>
            <td class="px-3 py-2">
              <span
                data-testid="issue-summary"
                class="text-gray-900"
              >
                {{ issue.summary }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-700">{{ issue.team || '—' }}</td>
            <td class="px-3 py-2">
              <span
                class="px-1.5 py-0.5 rounded text-xs font-medium"
                :class="statusBadgeClass(issue.status)"
              >
                {{ issue.status }}
              </span>
            </td>
            <td class="px-3 py-2">
              <span
                v-if="issue.colorStatus"
                class="px-1.5 py-0.5 rounded text-xs font-medium"
                :class="colorStatusClass(issue.colorStatus)"
              >
                {{ issue.colorStatus }}
              </span>
              <span v-else class="text-gray-400">—</span>
            </td>
            <td class="px-3 py-2 text-gray-700 text-xs">
              {{ formatRelease(issue.targetRelease) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>

export default {
  name: 'PriorityTable',
  props: {
    issues: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  computed: {
    sortedIssues() {
      return [...this.issues].sort((a, b) => a.rank - b.rank)
    }
  },
  methods: {
    rowClasses() {
      return ['border-l-gray-300']
    },
    rankBadgeClass() {
      return 'bg-gray-100 text-gray-700'
    },
    statusBadgeClass(status) {
      const colors = {
        'New': 'bg-gray-100 text-gray-800',
        'Backlog': 'bg-gray-100 text-gray-800',
        'Refinement': 'bg-yellow-100 text-yellow-800',
        'In Progress': 'bg-blue-100 text-blue-800',
        'Review': 'bg-purple-100 text-purple-800',
        'Testing': 'bg-orange-100 text-orange-800',
        'Resolved': 'bg-green-100 text-green-800',
        'Closed': 'bg-green-100 text-green-800'
      }
      return colors[status] || 'bg-gray-100 text-gray-800'
    },
    colorStatusClass(color) {
      if (!color) return ''
      const c = color.toLowerCase()
      if (c === 'green') return 'bg-green-600 text-white'
      if (c === 'red') return 'bg-red-600 text-white'
      if (c === 'yellow') return 'bg-yellow-400 text-gray-900'
      return 'text-gray-900'
    },
    formatRelease(targetRelease) {
      if (!targetRelease || targetRelease.length === 0) return '—'
      return targetRelease.join(', ')
    }
  }
}
</script>
