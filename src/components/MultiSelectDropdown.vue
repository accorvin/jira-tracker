<template>
  <div class="relative" ref="dropdownRef">
    <button
      type="button"
      @click="toggleDropdown"
      class="w-full min-w-0 px-2 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-left flex items-center justify-between gap-1"
    >
      <span class="truncate">{{ displayText }}</span>
      <svg
        class="h-4 w-4 flex-shrink-0 text-gray-400"
        :class="{ 'rotate-180': isOpen }"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="absolute z-20 mt-1 w-full min-w-48 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
    >
      <div class="p-2 border-b border-gray-200 flex gap-2">
        <button
          type="button"
          @click="selectAll"
          class="text-xs text-blue-600 hover:text-blue-800"
        >
          Select All
        </button>
        <button
          type="button"
          @click="clearAll"
          class="text-xs text-blue-600 hover:text-blue-800"
        >
          Clear All
        </button>
      </div>
      <div class="py-1">
        <label
          v-for="option in options"
          :key="option"
          class="flex items-center px-3 py-1.5 hover:bg-gray-100 cursor-pointer"
        >
          <input
            type="checkbox"
            :checked="modelValue.includes(option)"
            @change="toggleOption(option)"
            class="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
          <span class="ml-2 text-sm text-gray-700 truncate">{{ option }}</span>
        </label>
        <div v-if="options.length === 0" class="px-3 py-2 text-sm text-gray-500 italic">
          No options available
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MultiSelectDropdown',
  props: {
    modelValue: {
      type: Array,
      default: () => []
    },
    options: {
      type: Array,
      required: true
    },
    placeholder: {
      type: String,
      default: 'All'
    }
  },
  emits: ['update:modelValue'],
  data() {
    return {
      isOpen: false
    }
  },
  computed: {
    displayText() {
      if (this.modelValue.length === 0) {
        return this.placeholder
      }
      if (this.modelValue.length === 1) {
        return this.modelValue[0]
      }
      return `${this.modelValue.length} selected`
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
  },
  methods: {
    toggleDropdown() {
      this.isOpen = !this.isOpen
    },
    handleClickOutside(event) {
      if (this.$refs.dropdownRef && !this.$refs.dropdownRef.contains(event.target)) {
        this.isOpen = false
      }
    },
    toggleOption(option) {
      const newValue = [...this.modelValue]
      const index = newValue.indexOf(option)
      if (index === -1) {
        newValue.push(option)
      } else {
        newValue.splice(index, 1)
      }
      this.$emit('update:modelValue', newValue)
    },
    selectAll() {
      this.$emit('update:modelValue', [...this.options])
    },
    clearAll() {
      this.$emit('update:modelValue', [])
    }
  }
}
</script>
