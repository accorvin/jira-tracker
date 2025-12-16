<template>
  <div
    v-if="show"
    data-testid="release-modal"
    class="fixed inset-0 z-50"
  >
    <div
      data-testid="modal-backdrop"
      class="absolute inset-0 bg-black bg-opacity-50"
      @click="$emit('cancel')"
    ></div>
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        data-testid="modal-content"
        class="bg-white rounded-lg shadow-xl p-6 w-96 pointer-events-auto"
        @click.stop
      >
        <h2 data-testid="modal-title" class="text-xl font-bold text-gray-900 mb-4">
          {{ release ? 'Edit Release' : 'Add Release' }}
        </h2>

        <form @submit.prevent="handleSubmit">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Release Name
              </label>
              <input
                data-testid="release-name-input"
                v-model="form.name"
                type="text"
                placeholder="rhoai-3.4.EA1"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
              <p
                v-if="errors.name"
                data-testid="name-error"
                class="mt-1 text-sm text-red-600"
              >
                {{ errors.name }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Plan Due Date
              </label>
              <input
                data-testid="plan-date-input"
                v-model="form.planDate"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Code Freeze Date
              </label>
              <input
                data-testid="code-freeze-input"
                v-model="form.codeFreeze"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Release Date
              </label>
              <input
                data-testid="release-date-input"
                v-model="form.releaseDate"
                type="date"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              data-testid="cancel-btn"
              type="button"
              @click="$emit('cancel')"
              class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="save-btn"
              type="submit"
              class="px-4 py-2 bg-primary-700 text-white rounded-md hover:bg-primary-800 transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ReleaseModal',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    release: {
      type: Object,
      default: null
    }
  },
  emits: ['save', 'cancel'],
  data() {
    return {
      form: {
        name: '',
        planDate: '',
        codeFreeze: '',
        releaseDate: ''
      },
      errors: {
        name: null
      }
    }
  },
  watch: {
    release: {
      immediate: true,
      handler(newRelease) {
        if (newRelease) {
          this.form = {
            name: newRelease.name || '',
            planDate: newRelease.planDate || '',
            codeFreeze: newRelease.codeFreeze || '',
            releaseDate: newRelease.releaseDate || ''
          }
        } else {
          this.form = {
            name: '',
            planDate: '',
            codeFreeze: '',
            releaseDate: ''
          }
        }
        this.errors = { name: null }
      }
    }
  },
  methods: {
    handleSubmit() {
      this.errors = { name: null }

      if (!this.form.name.trim()) {
        this.errors.name = 'Release name is required'
        return
      }

      const pattern = /^rhoai-\d+\.\d+(\.[A-Za-z0-9]+)?$/
      if (!pattern.test(this.form.name)) {
        this.errors.name = 'Release name must match format rhoai-X.Y or rhoai-X.Y.Z (e.g., rhoai-3.2 or rhoai-3.4.EA1)'
        return
      }

      this.$emit('save', { ...this.form })
    }
  }
}
</script>
