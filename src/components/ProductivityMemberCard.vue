<template>
  <div class="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border-l-4 border-primary-500 p-4">
    <!-- Name + Role Badge -->
    <div class="flex justify-between items-start mb-3">
      <h3 class="text-lg font-bold text-gray-900">{{ member.name }}</h3>
      <span :class="roleBadgeClass">{{ member.specialty }}</span>
    </div>

    <!-- Manager -->
    <div class="text-sm text-gray-600 mb-3">
      Manager: {{ member.manager }}
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-blue-50 rounded-lg p-3">
        <div class="text-xs text-gray-500">Issues Resolved</div>
        <div class="text-2xl font-bold text-blue-700">{{ member.totalIssuesResolved }}</div>
      </div>
      <div class="bg-green-50 rounded-lg p-3">
        <div class="text-xs text-gray-500">Story Points</div>
        <div class="text-2xl font-bold text-green-700">{{ formatStoryPoints }}</div>
      </div>
      <div class="bg-purple-50 rounded-lg p-3 col-span-2">
        <div class="text-xs text-gray-500">Avg Cycle Time</div>
        <div class="text-xl font-bold text-purple-700">{{ formatCycleTime }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ProductivityMemberCard',
  props: {
    member: {
      type: Object,
      required: true
    }
  },
  computed: {
    roleBadgeClass() {
      const roleColors = {
        'Backend Engineer': 'bg-blue-100 text-blue-800',
        'QE': 'bg-purple-100 text-purple-800',
        'UI': 'bg-pink-100 text-pink-800',
        'Manager': 'bg-green-100 text-green-800',
        'Staff Engineers': 'bg-indigo-100 text-indigo-800',
        'Architects': 'bg-orange-100 text-orange-800',
        'Agilist': 'bg-yellow-100 text-yellow-800',
        'DevOps': 'bg-teal-100 text-teal-800',
        'BFF': 'bg-cyan-100 text-cyan-800',
        'Operations Manager': 'bg-red-100 text-red-800'
      };
      const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
      const colorClass = roleColors[this.member.specialty] || 'bg-gray-100 text-gray-800';
      return `${baseClasses} ${colorClass}`;
    },
    formatStoryPoints() {
      return this.member.totalStoryPoints !== null && this.member.totalStoryPoints !== undefined
        ? this.member.totalStoryPoints
        : 'N/A';
    },
    formatCycleTime() {
      if (this.member.avgCycleTimeDays !== null && this.member.avgCycleTimeDays !== undefined) {
        return `${this.member.avgCycleTimeDays.toFixed(1)} days`;
      }
      return 'N/A days';
    }
  }
};
</script>
