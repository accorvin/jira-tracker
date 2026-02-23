/**
 * Tests for useAdmin composable - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  getAdminStatus: vi.fn(),
  saveAdminList: vi.fn()
}))

import { useAdmin } from '../composables/useAdmin'
import { getAdminStatus, saveAdminList } from '../services/api'

describe('useAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const { resetAdmin } = useAdmin()
    resetAdmin()
  })

  describe('initial state', () => {
    it('defaults isAdmin to false', () => {
      const { isAdmin } = useAdmin()
      expect(isAdmin.value).toBe(false)
    })

    it('defaults adminList to empty array', () => {
      const { adminList } = useAdmin()
      expect(adminList.value).toEqual([])
    })

    it('defaults adminLoading to false', () => {
      const { adminLoading } = useAdmin()
      expect(adminLoading.value).toBe(false)
    })

    it('defaults adminError to null', () => {
      const { adminError } = useAdmin()
      expect(adminError.value).toBe(null)
    })
  })

  describe('fetchAdminStatus', () => {
    it('sets isAdmin to true when API returns isAdmin true', async () => {
      getAdminStatus.mockResolvedValue({ isAdmin: true, admins: ['user@redhat.com'] })

      const { fetchAdminStatus, isAdmin } = useAdmin()
      await fetchAdminStatus()

      expect(isAdmin.value).toBe(true)
    })

    it('sets adminList when API returns admins array', async () => {
      getAdminStatus.mockResolvedValue({ isAdmin: true, admins: ['a@redhat.com', 'b@redhat.com'] })

      const { fetchAdminStatus, adminList } = useAdmin()
      await fetchAdminStatus()

      expect(adminList.value).toEqual(['a@redhat.com', 'b@redhat.com'])
    })

    it('sets isAdmin to false when API returns isAdmin false', async () => {
      getAdminStatus.mockResolvedValue({ isAdmin: false })

      const { fetchAdminStatus, isAdmin } = useAdmin()
      await fetchAdminStatus()

      expect(isAdmin.value).toBe(false)
    })

    it('does not set adminList when user is not admin', async () => {
      getAdminStatus.mockResolvedValue({ isAdmin: false })

      const { fetchAdminStatus, adminList } = useAdmin()
      await fetchAdminStatus()

      expect(adminList.value).toEqual([])
    })

    it('sets adminLoading during fetch', async () => {
      let resolvePromise
      getAdminStatus.mockReturnValue(new Promise(resolve => { resolvePromise = resolve }))

      const { fetchAdminStatus, adminLoading } = useAdmin()
      const promise = fetchAdminStatus()

      expect(adminLoading.value).toBe(true)

      resolvePromise({ isAdmin: true, admins: [] })
      await promise

      expect(adminLoading.value).toBe(false)
    })

    it('falls back to admin in dev mode on API failure', async () => {
      getAdminStatus.mockRejectedValue(new Error('Network error'))

      const { fetchAdminStatus, adminError, isAdmin } = useAdmin()
      await fetchAdminStatus()

      // Vitest runs with import.meta.env.DEV === true, so dev fallback grants admin
      expect(isAdmin.value).toBe(true)
      expect(adminError.value).toBe(null)
    })
  })

  describe('saveAdmins', () => {
    it('calls saveAdminList API with the list', async () => {
      saveAdminList.mockResolvedValue({ success: true, admins: ['x@redhat.com'] })

      const { saveAdmins } = useAdmin()
      await saveAdmins(['x@redhat.com'])

      expect(saveAdminList).toHaveBeenCalledWith(['x@redhat.com'])
    })

    it('updates adminList after successful save', async () => {
      saveAdminList.mockResolvedValue({ success: true, admins: ['x@redhat.com'] })

      const { saveAdmins, adminList } = useAdmin()
      await saveAdmins(['x@redhat.com'])

      expect(adminList.value).toEqual(['x@redhat.com'])
    })

    it('sets adminError on save failure', async () => {
      saveAdminList.mockRejectedValue(new Error('Forbidden'))

      const { saveAdmins, adminError } = useAdmin()
      await saveAdmins(['x@redhat.com'])

      expect(adminError.value).toBe('Forbidden')
    })
  })

  describe('resetAdmin', () => {
    it('resets all state to defaults', async () => {
      getAdminStatus.mockResolvedValue({ isAdmin: true, admins: ['a@redhat.com'] })

      const { fetchAdminStatus, resetAdmin, isAdmin, adminList, adminError } = useAdmin()
      await fetchAdminStatus()

      expect(isAdmin.value).toBe(true)

      resetAdmin()

      expect(isAdmin.value).toBe(false)
      expect(adminList.value).toEqual([])
      expect(adminError.value).toBe(null)
    })
  })

  describe('shared state', () => {
    it('shares state across multiple calls to useAdmin', async () => {
      getAdminStatus.mockResolvedValue({ isAdmin: true, admins: ['a@redhat.com'] })

      const instance1 = useAdmin()
      await instance1.fetchAdminStatus()

      const instance2 = useAdmin()
      expect(instance2.isAdmin.value).toBe(true)
      expect(instance2.adminList.value).toEqual(['a@redhat.com'])
    })
  })
})
