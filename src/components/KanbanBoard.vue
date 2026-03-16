<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 h-full">
    <KanbanColumn
      title="Backlog"
      :issues="backlogIssues"
    />
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
      title="Release Pending"
      :issues="releasePendingIssues"
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
    backlogIssues() {
      return this.issues.filter(issue =>
        ['New', 'Backlog'].includes(issue.status)
      )
    },
    todoIssues() {
      return this.issues.filter(issue =>
        issue.status === 'To Do'
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
    releasePendingIssues() {
      return this.issues.filter(issue =>
        issue.status === 'Release Pending'
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
