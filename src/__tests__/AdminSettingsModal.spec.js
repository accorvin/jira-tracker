/**
 * Tests for AdminSettingsModal.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AdminSettingsModal from '../components/AdminSettingsModal.vue'

// Mock useAdmin with real refs
const mockAdminList = ref(['admin1@redhat.com', 'admin2@redhat.com'])
const mockAdminError = ref(null)
const mockAdminLoading = ref(false)
const mockSaveAdmins = vi.fn()

vi.mock('../composables/useAdmin', () => ({
  useAdmin: () => ({
    isAdmin: ref(true),
    adminList: mockAdminList,
    adminLoading: mockAdminLoading,
    adminError: mockAdminError,
    saveAdmins: mockSaveAdmins
  })
}))

// Mock useAuth with real ref
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    user: ref({ email: 'admin1@redhat.com' })
  })
}))

describe('AdminSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminList.value = ['admin1@redhat.com', 'admin2@redhat.com']
    mockAdminError.value = null
    mockAdminLoading.value = false
    mockSaveAdmins.mockResolvedValue()
  })

  it('does not render when show is false', () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: false }
    })

    expect(wrapper.find('[data-testid="admin-modal"]').exists()).toBe(false)
  })

  it('renders when show is true', () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    expect(wrapper.find('[data-testid="admin-modal"]').exists()).toBe(true)
  })

  it('displays existing admins as list items', () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const items = wrapper.findAll('[data-testid="admin-item"]')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('admin1@redhat.com')
    expect(items[1].text()).toContain('admin2@redhat.com')
  })

  it('shows remove button for admins that are not the current user', () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const items = wrapper.findAll('[data-testid="admin-item"]')
    // admin1 is current user — no remove button
    expect(items[0].find('[data-testid="remove-admin-btn"]').exists()).toBe(false)
    // admin2 is not current user — has remove button
    expect(items[1].find('[data-testid="remove-admin-btn"]').exists()).toBe(true)
  })

  it('removes an admin when remove button clicked', async () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const removeBtn = wrapper.find('[data-testid="remove-admin-btn"]')
    await removeBtn.trigger('click')

    // Should have called saveAdmins without admin2
    expect(mockSaveAdmins).toHaveBeenCalledWith(['admin1@redhat.com'])
  })

  it('has an input to add new admin email', () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    expect(wrapper.find('[data-testid="new-admin-input"]').exists()).toBe(true)
  })

  it('adds a new admin when form submitted with valid email', async () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const input = wrapper.find('[data-testid="new-admin-input"]')
    await input.setValue('newadmin@redhat.com')

    const addBtn = wrapper.find('[data-testid="add-admin-btn"]')
    await addBtn.trigger('click')

    expect(mockSaveAdmins).toHaveBeenCalledWith([
      'admin1@redhat.com',
      'admin2@redhat.com',
      'newadmin@redhat.com'
    ])
  })

  it('shows validation error for non @redhat.com email', async () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const input = wrapper.find('[data-testid="new-admin-input"]')
    await input.setValue('user@gmail.com')

    const addBtn = wrapper.find('[data-testid="add-admin-btn"]')
    await addBtn.trigger('click')

    expect(wrapper.find('[data-testid="email-error"]').exists()).toBe(true)
    expect(mockSaveAdmins).not.toHaveBeenCalled()
  })

  it('shows validation error for empty email', async () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const addBtn = wrapper.find('[data-testid="add-admin-btn"]')
    await addBtn.trigger('click')

    expect(wrapper.find('[data-testid="email-error"]').exists()).toBe(true)
    expect(mockSaveAdmins).not.toHaveBeenCalled()
  })

  it('prevents adding duplicate admin', async () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const input = wrapper.find('[data-testid="new-admin-input"]')
    await input.setValue('admin1@redhat.com')

    const addBtn = wrapper.find('[data-testid="add-admin-btn"]')
    await addBtn.trigger('click')

    expect(wrapper.find('[data-testid="email-error"]').exists()).toBe(true)
    expect(mockSaveAdmins).not.toHaveBeenCalled()
  })

  it('emits close event when close button clicked', async () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const closeBtn = wrapper.find('[data-testid="close-admin-modal"]')
    await closeBtn.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close event when backdrop clicked', async () => {
    const wrapper = mount(AdminSettingsModal, {
      props: { show: true }
    })

    const backdrop = wrapper.find('[data-testid="admin-modal-backdrop"]')
    await backdrop.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
