<template>
  <div class="flex items-center gap-2 bg-gray-100 px-6 py-2 border-b border-gray-200">
    <button
      v-for="release in sortedReleases"
      :key="release.name"
      data-testid="release-tab"
      @click="$emit('select', release.name)"
      :class="[
        'px-3 py-1 text-sm rounded-md font-medium transition-colors',
        release.name === selectedRelease
          ? 'tab-selected bg-primary-700 text-white'
          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
      ]"
    >
      {{ release.name }}
    </button>
    <button
      data-testid="add-release-btn"
      @click="$emit('add')"
      :disabled="!isAdmin"
      :title="!isAdmin ? 'Admin access required' : undefined"
      :class="[
        'px-3 py-1 text-sm rounded-md font-medium border border-dashed transition-colors',
        isAdmin
          ? 'text-primary-700 hover:bg-primary-50 border-primary-300'
          : 'text-gray-400 border-gray-300 opacity-50 cursor-not-allowed'
      ]"
    >
      + Add
    </button>
  </div>
</template>

<script>
import { useAdmin } from '../composables/useAdmin'

export default {
  name: 'ReleaseTabBar',
  setup() {
    const { isAdmin } = useAdmin()
    return { isAdmin }
  },
  props: {
    releases: {
      type: Array,
      required: true
    },
    selectedRelease: {
      type: String,
      default: null
    }
  },
  emits: ['select', 'add'],
  computed: {
    sortedReleases() {
      return this.releases.slice().sort((a, b) => {
        const aMatch = a.name.match(/rhoai-(\d+)\.(\d+)(?:\.([A-Za-z0-9]+))?/)
        const bMatch = b.name.match(/rhoai-(\d+)\.(\d+)(?:\.([A-Za-z0-9]+))?/)

        if (!aMatch || !bMatch) return 0

        const aMaj = Number(aMatch[1])
        const aMin = Number(aMatch[2])
        const aSuffix = aMatch[3] || ''

        const bMaj = Number(bMatch[1])
        const bMin = Number(bMatch[2])
        const bSuffix = bMatch[3] || ''

        // Sort by major version
        if (aMaj !== bMaj) return aMaj - bMaj

        // Sort by minor version
        if (aMin !== bMin) return aMin - bMin

        // For same major.minor, pre-releases (with suffix) come before base version (no suffix)
        if (aSuffix && !bSuffix) return -1
        if (!aSuffix && bSuffix) return 1

        // Both have suffixes or both don't - sort alphabetically by suffix
        return aSuffix.localeCompare(bSuffix)
      })
    }
  }
}
</script>
