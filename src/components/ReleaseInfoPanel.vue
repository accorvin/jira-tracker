<template>
  <div class="w-48 bg-white border-r border-gray-200 p-4 flex-shrink-0">
    <h2 data-testid="release-name" class="text-lg font-bold text-primary-700 mb-4">
      {{ release.name }}
    </h2>

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
        class="px-3 py-1 text-sm text-primary-700 hover:bg-primary-50 rounded border border-primary-300 transition-colors"
      >
        Edit
      </button>
      <button
        data-testid="delete-btn"
        @click="$emit('delete')"
        class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded border border-red-300 transition-colors"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReleaseInfoPanel',
  props: {
    release: {
      type: Object,
      required: true
    }
  },
  emits: ['edit', 'delete'],
  methods: {
    formatDate(dateString) {
      if (!dateString) return 'Not set'

      const date = new Date(dateString + 'T00:00:00')
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    }
  }
}
</script>
