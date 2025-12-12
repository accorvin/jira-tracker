<template>
  <div
    v-if="violations.length"
    class="hygiene-warning"
    @mouseenter="showPopupOnHover"
    @mouseleave="hidePopupOnLeave"
  >
    <button
      @click.stop="togglePopup"
      class="warning-icon pulse"
      aria-label="View hygiene issues"
      type="button"
    >
      <!-- Warning triangle SVG icon -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="icon"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </button>

    <div v-if="showPopup" ref="popup" class="popup">
      <h4 class="popup-header">Hygiene Issues ({{ violations.length }})</h4>
      <ul class="violations-list">
        <li v-for="violation in violations" :key="violation.id" class="violation-item">
          {{ violation.message }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  violations: {
    type: Array,
    required: true,
    default: () => []
  }
})

const showPopup = ref(false)
const popup = ref(null)
const isClickedOpen = ref(false) // Track if popup was opened by click (sticky) vs hover

function togglePopup() {
  showPopup.value = !showPopup.value
  isClickedOpen.value = showPopup.value // If opening via click, mark as sticky
}

function showPopupOnHover() {
  // Only show on hover if not already clicked open
  if (!isClickedOpen.value) {
    showPopup.value = true
  }
}

function hidePopupOnLeave() {
  // Only hide on mouse leave if it wasn't opened by click
  if (!isClickedOpen.value) {
    showPopup.value = false
  }
}

function handleClickOutside(event) {
  if (showPopup.value && popup.value && !popup.value.contains(event.target)) {
    // Check if click is on the warning icon button
    const button = event.target.closest('.warning-icon')
    if (!button) {
      showPopup.value = false
      isClickedOpen.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.hygiene-warning {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 10;
}

.warning-icon {
  background: #dc2626;
  border: none;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.warning-icon:hover {
  transform: scale(1.05);
}

.warning-icon .icon {
  width: 1.25rem;
  height: 1.25rem;
  color: white;
}

/* Pulse animation */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  50% {
    transform: scale(1.2);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.6);
  }
}

.pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

.popup {
  position: absolute;
  top: 2.75rem;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 0.75rem;
  min-width: 300px;
  max-width: 400px;
  z-index: 20;
}

.popup-header {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.violations-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.violation-item {
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  background: #fef2f2;
  border-left: 3px solid #dc2626;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: #374151;
}

.violation-item:last-child {
  margin-bottom: 0;
}
</style>
