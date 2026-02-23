<template>
  <nav class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-6">
      <div class="flex space-x-6">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="$emit('view-change', tab.id)"
          class="py-2 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-1.5"
          :class="currentView === tab.id
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          {{ tab.label }}
          <span
            v-if="tab.badge"
            class="px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700"
          >
            {{ tab.badge }}
          </span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
defineProps({
  currentView: {
    type: String,
    required: true
  }
})

defineEmits(['view-change'])

const tabs = [
  { id: 'release-tracking', label: 'Release Tracking' },
  { id: 'feature-intake', label: 'Feature Intake', badge: 'Beta' },
  { id: 'roadmap', label: 'Feature Roadmap' },
  { id: 'priority', label: 'Priority View' },
  { id: 'hygiene', label: 'Hygiene Enforcement', badge: 'New' }
]
</script>
