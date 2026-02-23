import { ref } from 'vue'
import { getAdminStatus, saveAdminList } from '../services/api'

const isAdmin = ref(false)
const adminList = ref([])
const adminLoading = ref(false)
const adminError = ref(null)

export function useAdmin() {
  const fetchAdminStatus = async () => {
    adminLoading.value = true
    adminError.value = null
    try {
      const data = await getAdminStatus()
      isAdmin.value = data.isAdmin === true
      adminList.value = data.admins || []
    } catch (error) {
      // In Vite dev mode, grant admin access so the UI is fully usable locally
      isAdmin.value = import.meta.env.DEV === true
      adminList.value = []
      adminError.value = import.meta.env.DEV ? null : error.message
    } finally {
      adminLoading.value = false
    }
  }

  const saveAdmins = async (list) => {
    adminError.value = null
    try {
      await saveAdminList(list)
      adminList.value = list
    } catch (error) {
      adminError.value = error.message
    }
  }

  const resetAdmin = () => {
    isAdmin.value = false
    adminList.value = []
    adminLoading.value = false
    adminError.value = null
  }

  return {
    isAdmin,
    adminList,
    adminLoading,
    adminError,
    fetchAdminStatus,
    saveAdmins,
    resetAdmin
  }
}
