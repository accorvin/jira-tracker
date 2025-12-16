<template>
  <div class="team-section bg-white rounded-lg shadow">
    <!-- Header -->
    <div
      class="flex items-center justify-between p-4 cursor-pointer border-b"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-3">
        <!-- Drag handle -->
        <div class="drag-handle cursor-grab text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
          </svg>
        </div>

        <!-- Team name -->
        <h3 class="text-lg font-semibold text-gray-900">
          {{ displayName }}
        </h3>

        <!-- Count badge -->
        <span class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
          {{ features.length }}
        </span>
      </div>

      <div class="flex items-center gap-3">
        <!-- Health indicator -->
        <div
          class="w-3 h-3 rounded-full"
          :class="healthIndicatorClass"
          :title="healthTooltip"
        />

        <!-- Expand/collapse icon -->
        <svg
          class="w-5 h-5 text-gray-500 transition-transform"
          :class="{ 'rotate-180': isExpanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </div>
    </div>

    <!-- Feature cards -->
    <div v-show="isExpanded" class="p-4 space-y-4">
      <IntakeCard
        v-for="(feature, index) in features"
        :key="feature.key"
        :feature="feature"
        :isNextUp="index === 0 && feature.riceStatus === 'complete'"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import IntakeCard from './IntakeCard.vue'

const props = defineProps({
  teamName: {
    type: [String, null],
    required: true
  },
  features: {
    type: Array,
    required: true
  }
})

const isExpanded = ref(true)

const displayName = computed(() => props.teamName || 'Unassigned Team')

const healthIndicatorClass = computed(() => {
  if (props.features.length === 0) return 'bg-gray-300'

  const topFeature = props.features[0]

  // Unassigned team is always red
  if (props.teamName === null) return 'bg-red-500'

  // Check RICE status of top feature
  if (topFeature.riceStatus === 'complete') return 'bg-green-500'
  if (topFeature.riceStatus === 'partial') return 'bg-yellow-500'
  return 'bg-red-500'
})

const healthTooltip = computed(() => {
  if (props.features.length === 0) return 'No features'

  const topFeature = props.features[0]

  if (props.teamName === null) return 'Team not assigned'
  if (topFeature.riceStatus === 'complete') return 'Ready to plan: next item has RICE score'
  if (topFeature.riceStatus === 'partial') return 'Needs attention: RICE score incomplete'
  return 'Needs attention: no RICE score on top item'
})
</script>
