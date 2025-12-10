<template>
  <div class="bg-gray-100 rounded-lg p-4 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-300">
      <h2 class="text-xl font-bold text-gray-800">{{ title }}</h2>
      <span class="bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
        {{ issues.length }}
      </span>
    </div>

    <div class="flex-1 overflow-y-auto space-y-4">
      <IssueCard
        v-for="issue in issues"
        :key="issue.key"
        :issue="issue"
      />
    </div>
  </div>
</template>

<script>
import IssueCard from './IssueCard.vue'

export default {
  name: 'KanbanColumn',
  components: {
    IssueCard
  },
  props: {
    title: {
      type: String,
      required: true
    },
    issues: {
      type: Array,
      required: true,
      default: () => []
    }
  }
}
</script>
