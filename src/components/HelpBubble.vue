<template>
  <div
    v-if="!isDismissed"
    data-testid="help-bubble"
    class="fixed bottom-4 right-4 z-50"
  >
    <!-- Expanded help panel -->
    <div
      v-if="isOpen"
      role="dialog"
      aria-labelledby="help-title"
      class="absolute bottom-14 right-0 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
    >
      <div class="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <h3 id="help-title" class="font-semibold">{{ title }}</h3>
        <button
          data-testid="help-close"
          @click="isOpen = false"
          class="text-white hover:text-blue-200 transition-colors"
          aria-label="Close help"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      <div class="p-4 text-sm text-gray-700 leading-relaxed">
        {{ content }}
      </div>
      <div class="px-4 pb-4">
        <button
          data-testid="help-dismiss"
          @click="dismissPermanently"
          class="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
        >
          Don't show again
        </button>
      </div>
    </div>

    <!-- Question mark button -->
    <button
      @click="isOpen = !isOpen"
      :aria-label="isOpen ? 'Close help' : 'Open help'"
      class="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-xl font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      ?
    </button>
  </div>
</template>

<script>
export default {
  name: 'HelpBubble',
  props: {
    storageKey: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isOpen: false,
      isDismissed: false
    }
  },
  mounted() {
    this.isDismissed = localStorage.getItem(this.storageKey) === 'true'
  },
  methods: {
    dismissPermanently() {
      localStorage.setItem(this.storageKey, 'true')
      this.isDismissed = true
    }
  }
}
</script>
