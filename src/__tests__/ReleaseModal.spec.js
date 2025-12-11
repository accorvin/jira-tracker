/**
 * Tests for ReleaseModal.vue component - following TDD practices.
 * Tests written BEFORE implementation.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ReleaseModal from '../components/ReleaseModal.vue'

describe('ReleaseModal', () => {
  const mockRelease = {
    name: 'rhoai-3.2',
    planDate: '2024-11-30',
    codeFreeze: '2024-12-20',
    releaseDate: '2025-01-15'
  }

  it('renders when show prop is true', () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const modal = wrapper.find('[data-testid="release-modal"]')
    expect(modal.exists()).toBe(true)
  })

  it('does not render when show prop is false', () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: false, release: null }
    })

    const modal = wrapper.find('[data-testid="release-modal"]')
    expect(modal.exists()).toBe(false)
  })

  it('shows "Add Release" title when no release prop provided', () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const title = wrapper.find('[data-testid="modal-title"]')
    expect(title.text()).toBe('Add Release')
  })

  it('shows "Edit Release" title when release prop provided', () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: mockRelease }
    })

    const title = wrapper.find('[data-testid="modal-title"]')
    expect(title.text()).toBe('Edit Release')
  })

  it('pre-fills form fields when editing existing release', () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: mockRelease }
    })

    const nameInput = wrapper.find('[data-testid="release-name-input"]')
    const planDateInput = wrapper.find('[data-testid="plan-date-input"]')
    const codeFreezeInput = wrapper.find('[data-testid="code-freeze-input"]')
    const releaseDateInput = wrapper.find('[data-testid="release-date-input"]')

    expect(nameInput.element.value).toBe('rhoai-3.2')
    expect(planDateInput.element.value).toBe('2024-11-30')
    expect(codeFreezeInput.element.value).toBe('2024-12-20')
    expect(releaseDateInput.element.value).toBe('2025-01-15')
  })

  it('has empty fields when adding new release', () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const nameInput = wrapper.find('[data-testid="release-name-input"]')
    const planDateInput = wrapper.find('[data-testid="plan-date-input"]')
    const codeFreezeInput = wrapper.find('[data-testid="code-freeze-input"]')
    const releaseDateInput = wrapper.find('[data-testid="release-date-input"]')

    expect(nameInput.element.value).toBe('')
    expect(planDateInput.element.value).toBe('')
    expect(codeFreezeInput.element.value).toBe('')
    expect(releaseDateInput.element.value).toBe('')
  })

  it('shows validation error when release name is empty on submit', async () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const form = wrapper.find('form')
    await form.trigger('submit')

    const error = wrapper.find('[data-testid="name-error"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('required')
  })

  it('shows validation error when release name does not match pattern', async () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const nameInput = wrapper.find('[data-testid="release-name-input"]')
    await nameInput.setValue('invalid-name')

    const form = wrapper.find('form')
    await form.trigger('submit')

    const error = wrapper.find('[data-testid="name-error"]')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('rhoai-X.Y')
  })

  it('emits save with release data on valid submit', async () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const nameInput = wrapper.find('[data-testid="release-name-input"]')
    const planDateInput = wrapper.find('[data-testid="plan-date-input"]')
    const codeFreezeInput = wrapper.find('[data-testid="code-freeze-input"]')
    const releaseDateInput = wrapper.find('[data-testid="release-date-input"]')

    await nameInput.setValue('rhoai-3.3')
    await planDateInput.setValue('2025-02-28')
    await codeFreezeInput.setValue('2025-03-15')
    await releaseDateInput.setValue('2025-04-01')

    const form = wrapper.find('form')
    await form.trigger('submit')

    expect(wrapper.emitted('save')).toBeTruthy()
    expect(wrapper.emitted('save')[0][0]).toEqual({
      name: 'rhoai-3.3',
      planDate: '2025-02-28',
      codeFreeze: '2025-03-15',
      releaseDate: '2025-04-01'
    })
  })

  it('emits cancel when cancel button clicked', async () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const cancelButton = wrapper.find('[data-testid="cancel-btn"]')
    await cancelButton.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('emits cancel when clicking backdrop', async () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const backdrop = wrapper.find('[data-testid="modal-backdrop"]')
    await backdrop.trigger('click')

    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('does not emit cancel when clicking modal content', async () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: null }
    })

    const content = wrapper.find('[data-testid="modal-content"]')
    await content.trigger('click')

    expect(wrapper.emitted('cancel')).toBeFalsy()
  })

  it('resets form when modal is reopened for new release', async () => {
    const wrapper = mount(ReleaseModal, {
      props: { show: true, release: mockRelease }
    })

    // First, it should have the mock release data
    let nameInput = wrapper.find('[data-testid="release-name-input"]')
    expect(nameInput.element.value).toBe('rhoai-3.2')

    // Change to add mode (no release)
    await wrapper.setProps({ release: null })

    nameInput = wrapper.find('[data-testid="release-name-input"]')
    expect(nameInput.element.value).toBe('')
  })
})
