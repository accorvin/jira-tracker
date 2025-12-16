<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow relative"
    :class="{ 'ring-2 ring-primary-500': isNextUp }"
  >
    <!-- Next Up badge -->
    <div
      v-if="isNextUp"
      class="absolute -top-2 -right-2 px-2 py-1 bg-primary-500 text-white text-xs font-bold rounded-full"
    >
      NEXT UP
    </div>

    <!-- Header: Key + Title -->
    <div class="mb-3">
      <a
        :href="feature.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 hover:text-primary-800 font-semibold"
        @click.stop
      >
        {{ feature.key }}
      </a>
      <h4 class="text-lg font-medium text-gray-900 mt-1">
        {{ feature.title }}
      </h4>
    </div>

    <!-- Feature details -->
    <div class="grid grid-cols-2 gap-2 text-sm mb-4">
      <div>
        <span class="text-gray-500">Component:</span>
        <span class="ml-1 text-gray-900">{{ feature.component || 'Not set' }}</span>
      </div>
      <div>
        <span class="text-gray-500">Assignee:</span>
        <span class="ml-1 text-gray-900">{{ feature.assignee || 'Unassigned' }}</span>
      </div>
    </div>

    <!-- RICE Score Section -->
    <div class="mb-4 p-3 rounded-lg" :class="riceBackgroundClass">
      <div class="flex items-center justify-between">
        <span class="font-medium text-gray-700">RICE Score</span>
        <span v-if="feature.riceScore != null" class="text-2xl font-bold text-gray-900">
          {{ feature.riceScore }}
        </span>
        <span v-else class="text-sm font-medium" :class="riceWarningClass">
          {{ riceWarningText }}
        </span>
      </div>

      <!-- RICE breakdown (if any values set) -->
      <div v-if="hasAnyRiceValues" class="mt-2 grid grid-cols-4 gap-2 text-xs">
        <div class="text-center">
          <div class="text-gray-500">Reach</div>
          <div :class="feature.reach != null ? 'text-gray-900' : 'text-red-500'">
            {{ feature.reach ?? '-' }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-gray-500">Impact</div>
          <div :class="feature.impact != null ? 'text-gray-900' : 'text-red-500'">
            {{ feature.impact ?? '-' }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-gray-500">Confidence</div>
          <div :class="feature.confidence != null ? 'text-gray-900' : 'text-red-500'">
            {{ feature.confidence != null ? feature.confidence + '%' : '-' }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-gray-500">Effort</div>
          <div :class="feature.effort != null ? 'text-gray-900' : 'text-red-500'">
            {{ feature.effort ?? '-' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Linked RFE Section -->
    <div v-if="feature.linkedRfe" class="p-3 bg-gray-50 rounded-lg">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-medium text-gray-500 uppercase">Linked RFE</span>
      </div>
      <a
        :href="rfeUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 hover:text-primary-800 text-sm font-medium"
        @click.stop
      >
        {{ feature.linkedRfe.key }}
      </a>
      <p class="text-sm text-gray-700 mt-1">{{ feature.linkedRfe.title }}</p>
      <div v-if="feature.linkedRfe.approvalDate" class="text-xs text-gray-500 mt-1">
        Approved: {{ formatDate(feature.linkedRfe.approvalDate) }}
      </div>
    </div>

    <!-- External links -->
    <div class="mt-4 flex gap-4 text-sm">
      <a
        :href="feature.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 hover:text-primary-800 flex items-center gap-1"
      >
        View Feature
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
      </a>
      <a
        v-if="feature.linkedRfe"
        :href="rfeUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary-600 hover:text-primary-800 flex items-center gap-1"
      >
        View RFE
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  feature: {
    type: Object,
    required: true
  },
  isNextUp: {
    type: Boolean,
    default: false
  }
})

const rfeUrl = computed(() => {
  if (!props.feature.linkedRfe) return ''
  return `https://issues.redhat.com/browse/${props.feature.linkedRfe.key}`
})

const hasAnyRiceValues = computed(() => {
  const { reach, impact, confidence, effort } = props.feature
  return reach != null || impact != null || confidence != null || effort != null
})

const riceBackgroundClass = computed(() => {
  switch (props.feature.riceStatus) {
    case 'complete': return 'bg-green-50'
    case 'partial': return 'bg-yellow-50'
    default: return 'bg-red-50'
  }
})

const riceWarningClass = computed(() => {
  return props.feature.riceStatus === 'partial'
    ? 'text-yellow-700'
    : 'text-red-700'
})

const riceWarningText = computed(() => {
  return props.feature.riceStatus === 'partial'
    ? 'Incomplete RICE'
    : 'No RICE'
})

function formatDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
