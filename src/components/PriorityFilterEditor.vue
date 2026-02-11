<template>
  <div
    data-testid="filter-editor-backdrop"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="$emit('cancel')"
  >
    <div
      data-testid="filter-editor-modal"
      class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
      @click.stop
    >
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">
          {{ filter ? 'Edit Filter' : 'New Filter' }}
        </h2>
      </div>

      <div class="px-6 py-4 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Filter Name</label>
          <input
            data-testid="filter-name-input"
            v-model="name"
            type="text"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm"
            placeholder="e.g. My Teams"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm font-medium text-gray-700">Teams</label>
            <div class="flex gap-2">
              <button
                data-testid="select-all-teams-button"
                @click="selectAllTeams"
                class="text-xs text-primary-600 hover:text-primary-800"
              >
                Select All
              </button>
              <span class="text-gray-300">|</span>
              <button
                data-testid="deselect-all-teams-button"
                @click="deselectAllTeams"
                class="text-xs text-primary-600 hover:text-primary-800"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div class="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            <label
              v-for="team in teamOptions"
              :key="team"
              :data-testid="`team-label-${team}`"
              class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                :data-testid="`team-checkbox-${team}`"
                type="checkbox"
                :value="team"
                v-model="selectedTeams"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700">{{ team }}</span>
            </label>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Show issues matching...</label>
          <div class="flex rounded-md overflow-hidden border border-gray-300">
            <button
              data-testid="match-any-button"
              type="button"
              @click="matchMode = 'any'"
              :class="matchMode === 'any' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="flex-1 px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Selected teams OR components
            </button>
            <button
              data-testid="match-all-button"
              type="button"
              @click="matchMode = 'all'"
              :class="matchMode === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="flex-1 px-3 py-1.5 text-sm font-medium transition-colors"
            >
              Selected teams AND components
            </button>
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-sm font-medium text-gray-700">Components</label>
            <div class="flex gap-2">
              <button
                data-testid="select-all-components-button"
                @click="selectAllComponents"
                class="text-xs text-primary-600 hover:text-primary-800"
              >
                Select All
              </button>
              <span class="text-gray-300">|</span>
              <button
                data-testid="deselect-all-components-button"
                @click="deselectAllComponents"
                class="text-xs text-primary-600 hover:text-primary-800"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div class="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            <label
              v-for="component in componentOptions"
              :key="component"
              :data-testid="`component-label-${component}`"
              class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                :data-testid="`component-checkbox-${component}`"
                type="checkbox"
                :value="component"
                v-model="selectedComponents"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-sm text-gray-700">{{ component }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          data-testid="cancel-filter-button"
          @click="$emit('cancel')"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          data-testid="save-filter-button"
          @click="save"
          :disabled="!canSave"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  issues: {
    type: Array,
    required: true
  },
  filter: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['save', 'cancel'])

const name = ref(props.filter?.name || '')
const selectedTeams = ref(props.filter?.teams ? [...props.filter.teams] : [])
const selectedComponents = ref(props.filter?.components ? [...props.filter.components] : [])
const matchMode = ref(props.filter?.matchMode || 'any')

const teamOptions = computed(() => {
  const teams = new Set()
  props.issues.forEach(issue => {
    if (issue.team) teams.add(issue.team)
  })
  return Array.from(teams).sort()
})

const componentOptions = computed(() => {
  const components = new Set()
  props.issues.forEach(issue => {
    if (issue.components && Array.isArray(issue.components)) {
      issue.components.forEach(c => components.add(c))
    }
  })
  return Array.from(components).sort()
})

const canSave = computed(() => {
  return name.value.trim().length > 0 && (selectedTeams.value.length > 0 || selectedComponents.value.length > 0)
})

function selectAllTeams() {
  selectedTeams.value = [...teamOptions.value]
}

function deselectAllTeams() {
  selectedTeams.value = []
}

function selectAllComponents() {
  selectedComponents.value = [...componentOptions.value]
}

function deselectAllComponents() {
  selectedComponents.value = []
}

function save() {
  emit('save', {
    name: name.value.trim(),
    teams: [...selectedTeams.value].sort(),
    components: [...selectedComponents.value].sort(),
    matchMode: matchMode.value
  })
}
</script>
