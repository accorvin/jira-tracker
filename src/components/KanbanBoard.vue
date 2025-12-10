<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full">
    <KanbanColumn
      title="To Do"
      :issues="todoIssues"
    />
    <KanbanColumn
      title="In Refinement"
      :issues="refinementIssues"
    />
    <KanbanColumn
      title="In Progress"
      :issues="inProgressIssues"
    />
    <KanbanColumn
      title="Done"
      :issues="doneIssues"
    />
  </div>
</template>

<script>
import KanbanColumn from './KanbanColumn.vue'

export default {
  name: 'KanbanBoard',
  components: {
    KanbanColumn
  },
  props: {
    issues: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  computed: {
    todoIssues() {
      return this.issues.filter(issue =>
        ['New', 'Backlog'].includes(issue.status)
      )
    },
    refinementIssues() {
      return this.issues.filter(issue =>
        issue.status === 'Refinement'
      )
    },
    inProgressIssues() {
      return this.issues.filter(issue =>
        ['In Progress', 'Review', 'Testing'].includes(issue.status)
      )
    },
    doneIssues() {
      return this.issues.filter(issue =>
        ['Resolved', 'Closed'].includes(issue.status)
      )
    }
  }
}
</script>
