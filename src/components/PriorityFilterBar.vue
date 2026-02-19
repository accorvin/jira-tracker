<template>
  <div data-testid="priority-filter-bar" class="space-y-2">
    <!-- Row 1: Filter controls -->
    <div class="flex flex-wrap items-center gap-2">
      <div data-testid="filter-target-release" class="w-44">
        <label class="block text-xs font-medium text-gray-500 mb-0.5">Target Release</label>
        <MultiSelectDropdown
          :modelValue="selectedTargetReleases"
          @update:modelValue="updateTargetReleases"
          :options="targetReleaseOptions"
          placeholder="All Releases"
        />
      </div>

      <div data-testid="filter-team" class="w-44">
        <label class="block text-xs font-medium text-gray-500 mb-0.5">Team</label>
        <MultiSelectDropdown
          :modelValue="selectedTeams"
          @update:modelValue="updateTeams"
          :options="teamOptions"
          placeholder="All Teams"
        />
      </div>

      <div data-testid="filter-component" class="w-44">
        <label class="block text-xs font-medium text-gray-500 mb-0.5">Component</label>
        <MultiSelectDropdown
          :modelValue="selectedComponents"
          @update:modelValue="updateComponents"
          :options="componentOptions"
          placeholder="All Components"
        />
      </div>

      <div class="w-52">
        <label class="block text-xs font-medium text-gray-500 mb-0.5">Labels</label>
        <div class="flex flex-wrap items-center gap-1 min-h-[30px] px-2 py-1 border border-gray-300 rounded-md bg-white">
          <span
            v-for="label in selectedLabels"
            :key="label"
            :data-testid="`label-chip-${label}`"
            class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
          >
            {{ label }}
            <button
              :data-testid="`remove-label-${label}`"
              @click="removeLabel(label)"
              class="text-blue-600 hover:text-blue-900"
            >
              &times;
            </button>
          </span>
          <input
            data-testid="filter-labels-input"
            v-model="labelInput"
            @keydown.enter.prevent="addLabel"
            type="text"
            placeholder="Type + Enter"
            class="flex-1 min-w-[60px] text-sm border-none outline-none p-0 focus:ring-0"
          />
        </div>
      </div>

      <div class="flex items-end gap-2">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-0.5">Match</label>
          <div class="flex rounded-md overflow-hidden border border-gray-300">
            <button
              data-testid="match-any-button"
              type="button"
              @click="setMatchMode('any')"
              :class="matchMode === 'any' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-2 py-1 text-xs font-medium transition-colors"
            >
              OR
            </button>
            <button
              data-testid="match-all-button"
              type="button"
              @click="setMatchMode('all')"
              :class="matchMode === 'all' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'"
              class="px-2 py-1 text-xs font-medium transition-colors"
            >
              AND
            </button>
          </div>
        </div>

        <button
          data-testid="clear-filters-button"
          @click="clearAll"
          class="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Row 2: Count + Presets -->
    <div class="flex flex-wrap items-center gap-2 text-sm">
      <span class="text-gray-500">
        Showing {{ filteredCount }} of {{ issues.length }} issues
      </span>

      <span class="text-gray-300">|</span>

      <div data-testid="preset-selector" class="flex items-center gap-1">
        <span class="text-xs text-gray-500">Presets:</span>
        <template v-for="preset in presets" :key="preset.id">
          <button
            :data-testid="`select-preset-${preset.id}`"
            @click="loadPreset(preset)"
            class="px-1.5 py-0.5 text-xs rounded border"
            :class="activePresetId === preset.id ? 'bg-primary-100 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'"
          >
            {{ preset.name }}
          </button>
          <button
            :data-testid="`delete-preset-${preset.id}`"
            @click="$emit('delete-preset', preset.id)"
            class="text-gray-400 hover:text-red-500 text-xs"
            title="Delete preset"
          >
            &times;
          </button>
        </template>
      </div>

      <span class="text-gray-300">|</span>

      <div class="flex items-center gap-1">
        <input
          data-testid="preset-name-input"
          v-model="presetName"
          type="text"
          placeholder="Preset name"
          class="w-28 px-1.5 py-0.5 text-xs border border-gray-300 rounded"
        />
        <button
          data-testid="save-preset-button"
          @click="savePreset"
          :disabled="!presetName.trim()"
          class="px-1.5 py-0.5 text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import MultiSelectDropdown from './MultiSelectDropdown.vue'

export default {
  name: 'PriorityFilterBar',
  components: { MultiSelectDropdown },
  props: {
    issues: {
      type: Array,
      required: true
    },
    filteredCount: {
      type: Number,
      required: true
    },
    presets: {
      type: Array,
      default: () => []
    },
    initialFilterState: {
      type: Object,
      default: null
    }
  },
  emits: ['filter-change', 'save-preset', 'delete-preset'],
  data() {
    const state = this.initialFilterState || this.loadFromLocalStorage() || {
      teams: [],
      components: [],
      targetReleases: [],
      labels: [],
      matchMode: 'any'
    }

    return {
      selectedTeams: [...(state.teams || [])],
      selectedComponents: [...(state.components || [])],
      selectedTargetReleases: [...(state.targetReleases || [])],
      selectedLabels: [...(state.labels || [])],
      matchMode: state.matchMode || 'any',
      labelInput: '',
      presetName: '',
      activePresetId: null
    }
  },
  computed: {
    targetReleaseOptions() {
      const releases = new Set()
      this.issues.forEach(issue => {
        if (Array.isArray(issue.targetRelease)) {
          issue.targetRelease.forEach(r => releases.add(r))
        }
      })
      return Array.from(releases).sort()
    },
    teamOptions() {
      const teams = new Set()
      this.issues.forEach(issue => {
        if (issue.team) teams.add(issue.team)
      })
      return Array.from(teams).sort()
    },
    componentOptions() {
      const components = new Set()
      this.issues.forEach(issue => {
        if (Array.isArray(issue.components)) {
          issue.components.forEach(c => components.add(c))
        }
      })
      return Array.from(components).sort()
    },
    currentFilterState() {
      return {
        teams: [...this.selectedTeams],
        components: [...this.selectedComponents],
        targetReleases: [...this.selectedTargetReleases],
        labels: [...this.selectedLabels],
        matchMode: this.matchMode
      }
    }
  },
  mounted() {
    this.emitFilterChange()
  },
  methods: {
    emitFilterChange() {
      this.activePresetId = null
      this.saveToLocalStorage()
      this.$emit('filter-change', this.currentFilterState)
    },
    updateTeams(val) {
      this.selectedTeams = val
      this.emitFilterChange()
    },
    updateComponents(val) {
      this.selectedComponents = val
      this.emitFilterChange()
    },
    updateTargetReleases(val) {
      this.selectedTargetReleases = val
      this.emitFilterChange()
    },
    setMatchMode(mode) {
      this.matchMode = mode
      this.emitFilterChange()
    },
    addLabel() {
      const label = this.labelInput.trim()
      if (label && !this.selectedLabels.includes(label)) {
        this.selectedLabels.push(label)
        this.emitFilterChange()
      }
      this.labelInput = ''
    },
    removeLabel(label) {
      this.selectedLabels = this.selectedLabels.filter(l => l !== label)
      this.emitFilterChange()
    },
    clearAll() {
      this.selectedTeams = []
      this.selectedComponents = []
      this.selectedTargetReleases = []
      this.selectedLabels = []
      this.matchMode = 'any'
      this.labelInput = ''
      this.emitFilterChange()
    },
    loadPreset(preset) {
      this.selectedTeams = [...(preset.teams || [])]
      this.selectedComponents = [...(preset.components || [])]
      this.selectedTargetReleases = [...(preset.targetReleases || [])]
      this.selectedLabels = [...(preset.labels || [])]
      this.matchMode = preset.matchMode || 'any'
      this.activePresetId = preset.id
      this.saveToLocalStorage()
      this.$emit('filter-change', this.currentFilterState)
    },
    savePreset() {
      const name = this.presetName.trim()
      if (!name) return
      this.$emit('save-preset', {
        name,
        ...this.currentFilterState
      })
      this.presetName = ''
    },
    saveToLocalStorage() {
      try {
        localStorage.setItem('priority-active-filters', JSON.stringify(this.currentFilterState))
      } catch {
        // localStorage unavailable
      }
    },
    loadFromLocalStorage() {
      try {
        const saved = localStorage.getItem('priority-active-filters')
        return saved ? JSON.parse(saved) : null
      } catch {
        return null
      }
    }
  }
}
</script>
