<template>
  <div
    class="bg-white border-r border-gray-200 flex-shrink-0 transition-all duration-200"
    :class="isCollapsed ? 'w-10' : 'w-48'"
  >
    <!-- Collapsed state -->
    <div v-if="isCollapsed" class="h-full flex flex-col items-center py-4">
      <button
        @click="toggleCollapse"
        class="p-1 hover:bg-gray-100 rounded transition-colors mb-4"
        title="Expand sidebar"
      >
        <svg class="h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>
      <div class="writing-mode-vertical text-sm font-bold text-primary-700 whitespace-nowrap">
        {{ release.name }}
      </div>
    </div>

    <!-- Expanded state -->
    <div v-else class="p-4">
      <div class="flex items-center justify-between mb-4">
        <h2 data-testid="release-name" class="text-lg font-bold text-primary-700">
          {{ release.name }}
        </h2>
        <button
          @click="toggleCollapse"
          class="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Collapse sidebar"
        >
          <svg class="h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div class="space-y-3 text-sm">
        <div>
          <div class="text-gray-500">Plan Due</div>
          <div data-testid="plan-date" class="font-medium">
            {{ formatDate(release.planDate) }}
          </div>
        </div>
        <div>
          <div class="text-gray-500">Code Freeze</div>
          <div data-testid="code-freeze" class="font-medium">
            {{ formatDate(release.codeFreeze) }}
          </div>
        </div>
        <div>
          <div class="text-gray-500">Release</div>
          <div data-testid="release-date" class="font-medium">
            {{ formatDate(release.releaseDate) }}
          </div>
        </div>
      </div>

      <div class="mt-4 flex gap-2">
        <button
          data-testid="edit-btn"
          @click="$emit('edit')"
          :disabled="!isAdmin"
          :title="!isAdmin ? 'Admin access required' : undefined"
          :class="[
            'px-3 py-1 text-sm rounded border transition-colors',
            isAdmin
              ? 'text-primary-700 hover:bg-primary-50 border-primary-300'
              : 'text-gray-400 border-gray-300 opacity-50 cursor-not-allowed'
          ]"
        >
          Edit
        </button>
        <button
          data-testid="delete-btn"
          @click="$emit('delete')"
          :disabled="!isAdmin"
          :title="!isAdmin ? 'Admin access required' : undefined"
          :class="[
            'px-3 py-1 text-sm rounded border transition-colors',
            isAdmin
              ? 'text-red-600 hover:bg-red-50 border-red-300'
              : 'text-gray-400 border-gray-300 opacity-50 cursor-not-allowed'
          ]"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { useAdmin } from '../composables/useAdmin'

const STORAGE_KEY = 'release-panel-collapsed'

export default {
  name: 'ReleaseInfoPanel',
  setup() {
    const { isAdmin } = useAdmin()
    return { isAdmin }
  },
  props: {
    release: {
      type: Object,
      required: true
    }
  },
  emits: ['edit', 'delete'],
  data() {
    return {
      isCollapsed: this.loadCollapseState()
    }
  },
  methods: {
    formatDate(dateString) {
      if (!dateString) return 'Not set'

      const date = new Date(dateString + 'T00:00:00')
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    },
    loadCollapseState() {
      try {
        return localStorage.getItem(STORAGE_KEY) === 'true'
      } catch {
        return false
      }
    },
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
      try {
        localStorage.setItem(STORAGE_KEY, String(this.isCollapsed))
      } catch {
        // Ignore localStorage errors
      }
    }
  }
}
</script>

<style scoped>
.writing-mode-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
}
</style>
