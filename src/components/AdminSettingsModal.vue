<template>
  <div
    v-if="show"
    data-testid="admin-modal"
    class="fixed inset-0 z-50"
  >
    <div
      data-testid="admin-modal-backdrop"
      class="absolute inset-0 bg-black bg-opacity-50"
      @click="$emit('close')"
    ></div>
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        class="bg-white rounded-lg shadow-xl p-6 w-[28rem] pointer-events-auto"
        @click.stop
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-gray-900">Admin Settings</h2>
          <button
            data-testid="close-admin-modal"
            @click="$emit('close')"
            class="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <svg class="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p class="text-sm text-gray-500 mb-4">
          Admins can manage releases, toggle enforcement rules, and approve/dismiss proposals.
        </p>

        <!-- Admin list -->
        <div class="space-y-2 mb-4">
          <div
            v-for="email in localAdmins"
            :key="email"
            data-testid="admin-item"
            class="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md"
          >
            <span class="text-sm text-gray-800">{{ email }}</span>
            <div class="flex items-center gap-2">
              <span
                v-if="email === currentUserEmail"
                class="text-xs text-gray-400"
              >you</span>
              <button
                v-if="email !== currentUserEmail"
                data-testid="remove-admin-btn"
                @click="removeAdmin(email)"
                class="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Remove admin"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Add new admin -->
        <div class="flex gap-2">
          <input
            data-testid="new-admin-input"
            v-model="newEmail"
            type="text"
            placeholder="user@redhat.com"
            class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            @keyup.enter="addAdmin"
          />
          <button
            data-testid="add-admin-btn"
            @click="addAdmin"
            class="px-3 py-2 text-sm font-medium bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            Add
          </button>
        </div>
        <p
          v-if="emailError"
          data-testid="email-error"
          class="mt-1 text-sm text-red-600"
        >
          {{ emailError }}
        </p>

        <p
          v-if="adminError"
          class="mt-3 text-sm text-red-600"
        >
          {{ adminError }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { useAdmin } from '../composables/useAdmin'
import { useAuth } from '../composables/useAuth'

export default {
  name: 'AdminSettingsModal',
  props: {
    show: {
      type: Boolean,
      required: true
    }
  },
  emits: ['close'],
  setup() {
    const { adminList, adminError, saveAdmins } = useAdmin()
    const { user } = useAuth()
    return { adminList, adminError, saveAdmins, authUser: user }
  },
  data() {
    return {
      newEmail: '',
      emailError: null
    }
  },
  computed: {
    currentUserEmail() {
      return this.authUser?.email || ''
    },
    localAdmins() {
      return [...this.adminList]
    }
  },
  watch: {
    show() {
      this.newEmail = ''
      this.emailError = null
    }
  },
  methods: {
    async addAdmin() {
      this.emailError = null
      const email = this.newEmail.trim().toLowerCase()

      if (!email) {
        this.emailError = 'Email address is required'
        return
      }

      if (!email.endsWith('@redhat.com')) {
        this.emailError = 'Only @redhat.com email addresses are allowed'
        return
      }

      if (this.adminList.includes(email)) {
        this.emailError = 'This email is already an admin'
        return
      }

      const updated = [...this.adminList, email]
      await this.saveAdmins(updated)
      this.newEmail = ''
    },

    async removeAdmin(email) {
      const updated = this.adminList.filter(e => e !== email)
      await this.saveAdmins(updated)
    }
  }
}
</script>
