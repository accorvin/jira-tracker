<template>
  <div
    class="card-container card-flip cursor-pointer bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-l-4 border-primary-500 relative min-h-[400px]"
    @click="toggleFlip"
  >
    <!-- Front of card -->
    <transition name="flip" mode="out-in">
      <div
        v-if="!isFlipped"
        key="front"
        class="card-front p-6 absolute inset-0 overflow-hidden"
        ref="cardFront"
      >
        <div class="flex justify-between items-start mb-3">
          <a
            :href="issue.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary-600 hover:text-primary-800 font-semibold text-lg"
            @click.stop
          >
            {{ issue.key }}
          </a>
          <span
            class="px-3 py-1 rounded-full text-sm font-medium"
            :class="issueTypeBadgeClass"
          >
            {{ issue.issueType }}
          </span>
        </div>

        <h3 class="text-xl font-semibold text-gray-900 mb-6">
          {{ issue.summary }}
        </h3>

        <div class="space-y-2 text-sm">
          <div class="flex items-center">
            <span class="font-medium text-gray-600 w-32">Status:</span>
            <span
              class="px-2 py-1 rounded text-sm font-medium"
              :class="statusBadgeClass"
            >
              {{ issue.status }}
            </span>
          </div>

          <div class="flex items-center">
            <span class="font-medium text-gray-600 w-32">Assignee:</span>
            <span class="text-gray-900">{{ issue.assignee || 'Unassigned' }}</span>
          </div>

          <div class="flex items-center field-team">
            <span class="font-medium text-gray-600 w-32">Team:</span>
            <span
              class="field-value"
              :class="issue.team ? 'text-gray-900' : 'bg-red-100 text-red-900 px-2 py-1 rounded font-medium'"
            >
              {{ issue.team || 'Not set' }}
            </span>
          </div>

          <div class="flex items-center field-release-type">
            <span class="font-medium text-gray-600 w-32">Release Type:</span>
            <span
              class="field-value"
              :class="issue.releaseType ? 'text-gray-900' : 'bg-red-100 text-red-900 px-2 py-1 rounded font-medium'"
            >
              {{ issue.releaseType || 'Not set' }}
            </span>
          </div>

          <div class="flex items-center field-target-release">
            <span class="font-medium text-gray-600 w-32">Target Release:</span>
            <div v-if="issue.targetRelease && issue.targetRelease.length > 0" class="flex flex-wrap gap-2">
              <span
                v-for="(release, index) in issue.targetRelease"
                :key="release"
                class="target-release-bubble px-2 py-1 rounded-full text-sm font-medium"
                :class="getReleaseColorClass(release, index)"
              >
                {{ release }}
              </span>
            </div>
            <span v-else class="field-value bg-red-100 text-red-900 px-2 py-1 rounded font-medium">Not set</span>
          </div>

          <div class="flex items-center field-status-age">
            <span class="font-medium text-gray-600 w-32">Status Age:</span>
            <span
              class="field-value"
              :class="statusAgeClass"
            >
              {{ statusAgeText }}
            </span>
          </div>
        </div>

        <!-- Info icon badge -->
        <div class="absolute bottom-4 right-4 text-primary-500 opacity-60">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>
    </transition>

    <!-- Back of card -->
    <transition name="flip" mode="out-in">
      <div
        v-if="isFlipped"
        key="back"
        class="card-back p-6 absolute inset-0 overflow-y-auto"
        ref="cardBack"
      >
        <h3 class="text-xl font-semibold text-gray-900 mb-2 border-b pb-2">Status Summary</h3>
        <div class="text-gray-600 text-sm mb-4">
          {{ statusSummaryDateText }}
        </div>
        <div class="text-gray-700 text-sm leading-relaxed" style="white-space: pre-line;">
          {{ formattedStatusSummary }}
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  name: 'IssueCard',
  props: {
    issue: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      isFlipped: false
    }
  },
  computed: {
    issueTypeBadgeClass() {
      return this.issue.issueType === 'Initiative'
        ? 'bg-purple-100 text-purple-800'
        : 'bg-blue-100 text-blue-800'
    },
    statusBadgeClass() {
      const statusColors = {
        'New': 'bg-gray-100 text-gray-800',
        'Backlog': 'bg-gray-100 text-gray-800',
        'Refinement': 'bg-yellow-100 text-yellow-800',
        'In Progress': 'bg-blue-100 text-blue-800',
        'Review': 'bg-purple-100 text-purple-800',
        'Testing': 'bg-orange-100 text-orange-800',
        'Resolved': 'bg-green-100 text-green-800',
        'Closed': 'bg-green-100 text-green-800'
      }
      return statusColors[this.issue.status] || 'bg-gray-100 text-gray-800'
    },
    formattedStatusSummary() {
      if (!this.issue.statusSummary) {
        return 'No status summary available'
      }
      // Replace \r\n and \n with actual newlines for proper display
      return this.issue.statusSummary
        .replace(/\\r\\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
    },
    statusAgeInDays() {
      if (!this.issue.statusSummaryUpdated) {
        return null
      }
      const updated = new Date(this.issue.statusSummaryUpdated)
      const now = new Date()
      const diffMs = now - updated
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      return diffDays
    },
    statusAgeText() {
      if (this.statusAgeInDays === null) {
        return 'No summary'
      }
      return `${this.statusAgeInDays} days ago`
    },
    statusAgeClass() {
      // Only highlight for Refinement and In Progress statuses
      // Don't highlight for To Do (New, Backlog) or Done (Resolved, Closed) columns
      const todoStatuses = ['New', 'Backlog']
      const doneStatuses = ['Resolved', 'Closed']
      const ignoreStatuses = [...todoStatuses, ...doneStatuses]

      if (ignoreStatuses.includes(this.issue.status)) {
        return 'text-gray-900'
      }

      // Show red warning if no summary exists
      if (this.statusAgeInDays === null) {
        return 'bg-red-100 text-red-900 px-2 py-1 rounded font-medium'
      }

      // Color-code based on age:
      // Green: < 7 days (fresh) - using darker green for better visibility
      // Yellow: 7-14 days (getting stale) - using brighter yellow for better contrast
      // Red: > 14 days (very stale)
      if (this.statusAgeInDays < 7) {
        return 'bg-green-600 text-white px-2 py-1 rounded font-medium'
      } else if (this.statusAgeInDays <= 14) {
        return 'bg-yellow-400 text-gray-900 px-2 py-1 rounded font-medium'
      } else {
        return 'bg-red-100 text-red-900 px-2 py-1 rounded font-medium'
      }
    },
    statusSummaryDateText() {
      if (!this.issue.statusSummaryUpdated) {
        return 'No update date available'
      }
      const date = new Date(this.issue.statusSummaryUpdated)
      return `Updated: ${date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`
    }
  },
  methods: {
    toggleFlip() {
      this.isFlipped = !this.isFlipped
    },
    getReleaseColorClass(release, index) {
      // Color palette for different releases
      const colors = [
        'bg-blue-100 text-blue-800',
        'bg-green-100 text-green-800',
        'bg-purple-100 text-purple-800',
        'bg-pink-100 text-pink-800',
        'bg-indigo-100 text-indigo-800',
        'bg-teal-100 text-teal-800',
        'bg-orange-100 text-orange-800',
        'bg-cyan-100 text-cyan-800'
      ]

      // Create a consistent hash from the release string
      let hash = 0
      for (let i = 0; i < release.length; i++) {
        hash = ((hash << 5) - hash) + release.charCodeAt(i)
        hash = hash & hash
      }

      // Use the hash to select a color
      const colorIndex = Math.abs(hash) % colors.length
      return colors[colorIndex]
    }
  }
}
</script>

<style scoped>
.flip-enter-active,
.flip-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.flip-enter-from {
  opacity: 0;
  transform: rotateY(90deg);
}

.flip-leave-to {
  opacity: 0;
  transform: rotateY(-90deg);
}

.flip-enter-to,
.flip-leave-from {
  opacity: 1;
  transform: rotateY(0deg);
}
</style>
