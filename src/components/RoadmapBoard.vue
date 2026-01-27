<template>
  <div class="grid gap-6 h-full pb-4" :style="gridStyle">
    <div
      v-for="column in columns"
      :key="column.name"
      data-testid="roadmap-column"
      class="bg-gray-100 rounded-lg p-4 flex flex-col min-w-0 overflow-visible"
    >
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-300">
        <h2 data-testid="column-title" class="text-xl font-bold text-gray-800">{{ column.name }}</h2>
        <span data-testid="column-count" class="bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
          {{ column.issues.length }}
        </span>
      </div>

      <div class="flex-1 overflow-y-auto space-y-4">
        <IssueCard
          v-for="issue in column.issues"
          :key="`${column.name}-${issue.key}`"
          :issue="issue"
          data-testid="issue-card"
        />
      </div>
    </div>
  </div>
</template>

<script>
import IssueCard from './IssueCard.vue'

export default {
  name: 'RoadmapBoard',
  components: {
    IssueCard
  },
  props: {
    issues: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  computed: {
    gridStyle() {
      const count = this.columns.length
      return {
        gridTemplateColumns: `repeat(${count}, minmax(250px, 1fr))`
      }
    },
    columns() {
      // Get all unique releases from issues
      const releaseSet = new Set()
      this.issues.forEach(issue => {
        const releases = issue.targetRelease || []
        releases.forEach(r => releaseSet.add(r))
      })

      // Sort releases chronologically
      const sortedReleases = Array.from(releaseSet).sort((a, b) => {
        return this.compareVersions(a, b)
      })

      // Build columns array with Backlog first
      const columns = [{
        name: 'Backlog',
        issues: this.getBacklogIssues()
      }]

      // Add release columns
      sortedReleases.forEach(release => {
        columns.push({
          name: release,
          issues: this.getIssuesForRelease(release)
        })
      })

      return columns
    }
  },
  methods: {
    getBacklogIssues() {
      return this.issues
        .filter(issue => {
          const releases = issue.targetRelease
          return !releases || releases.length === 0
        })
        .sort((a, b) => a.key.localeCompare(b.key))
    },
    getIssuesForRelease(release) {
      return this.issues
        .filter(issue => {
          const releases = issue.targetRelease || []
          return releases.includes(release)
        })
        .sort((a, b) => a.key.localeCompare(b.key))
    },
    compareVersions(a, b) {
      // Parse version strings like "rhoai-3.2" or "rhoai-3.4.RC1"
      const aMatch = a.match(/rhoai-(\d+)\.(\d+)(?:\.([A-Za-z0-9]+))?/)
      const bMatch = b.match(/rhoai-(\d+)\.(\d+)(?:\.([A-Za-z0-9]+))?/)

      if (!aMatch || !bMatch) return a.localeCompare(b)

      const aMaj = Number(aMatch[1])
      const aMin = Number(aMatch[2])
      const aSuffix = aMatch[3] || ''

      const bMaj = Number(bMatch[1])
      const bMin = Number(bMatch[2])
      const bSuffix = bMatch[3] || ''

      // Sort by major version
      if (aMaj !== bMaj) return aMaj - bMaj

      // Sort by minor version
      if (aMin !== bMin) return aMin - bMin

      // For same major.minor, pre-releases (with suffix) come before base version (no suffix)
      if (aSuffix && !bSuffix) return -1
      if (!aSuffix && bSuffix) return 1

      // Both have suffixes - sort alphabetically
      return aSuffix.localeCompare(bSuffix)
    }
  }
}
</script>
