<template>
  <nav class="bg-white border-b border-gray-200">
    <div class="container mx-auto px-6">
      <div class="flex space-x-6">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="$emit('view-change', tab.id)"
          class="py-2 px-1 border-b-2 font-medium text-sm transition-colors"
          :class="currentView === tab.id
            ? 'border-primary-500 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          {{ tab.label }}
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
  { id: 'feature-intake', label: 'Feature Intake' }
]
</script>
