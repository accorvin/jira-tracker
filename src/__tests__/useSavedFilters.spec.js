/**
 * Tests for useSavedFilters composable - following TDD practices.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSavedFilters } from '../composables/useSavedFilters'

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn((key) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value }),
  removeItem: vi.fn((key) => { delete localStorageMock.store[key] })
}
global.localStorage = localStorageMock

describe('useSavedFilters', () => {
  beforeEach(() => {
    localStorageMock.store = {}
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
  })

  it('initializes with empty filters and null activeFilterId', () => {
    const { filters, activeFilterId, activeFilter } = useSavedFilters()

    expect(filters.value).toEqual([])
    expect(activeFilterId.value).toBeNull()
    expect(activeFilter.value).toBeNull()
  })

  it('loads saved filters from localStorage on init', () => {
    const savedFilters = [
      { id: 'abc123', name: 'My Teams', teams: ['Team A', 'Team B'], components: [] }
    ]
    localStorageMock.store.priorityFilters = JSON.stringify(savedFilters)

    const { filters } = useSavedFilters('priorityFilters')

    expect(filters.value).toEqual(savedFilters)
  })

  it('loads activeFilterId from localStorage on init', () => {
    localStorageMock.store.priorityFilters = JSON.stringify([
      { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
    ])
    localStorageMock.store['priorityFilters-active'] = 'abc123'

    const { activeFilterId } = useSavedFilters('priorityFilters')

    expect(activeFilterId.value).toBe('abc123')
  })

  it('computes activeFilter from activeFilterId', () => {
    const savedFilters = [
      { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] },
      { id: 'def456', name: 'Platform', teams: [], components: ['UI', 'API'] }
    ]
    localStorageMock.store.priorityFilters = JSON.stringify(savedFilters)
    localStorageMock.store['priorityFilters-active'] = 'def456'

    const { activeFilter } = useSavedFilters('priorityFilters')

    expect(activeFilter.value).toEqual({ id: 'def456', name: 'Platform', teams: [], components: ['UI', 'API'] })
  })

  it('returns null activeFilter when activeFilterId is null', () => {
    localStorageMock.store.priorityFilters = JSON.stringify([
      { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
    ])

    const { activeFilter } = useSavedFilters('priorityFilters')

    expect(activeFilter.value).toBeNull()
  })

  it('uses default storageKey when none provided', () => {
    const savedFilters = [
      { id: 'abc123', name: 'Test', teams: [], components: ['UI'] }
    ]
    localStorageMock.store.savedFilters = JSON.stringify(savedFilters)

    const { filters } = useSavedFilters()

    expect(filters.value).toEqual(savedFilters)
  })

  describe('createFilter', () => {
    it('creates a filter and returns its ID', () => {
      const { filters, createFilter } = useSavedFilters('priorityFilters')

      const id = createFilter({ name: 'My Teams', teams: ['Team B', 'Team A'], components: ['API'] })

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
      expect(filters.value).toHaveLength(1)
      expect(filters.value[0]).toEqual({
        id,
        name: 'My Teams',
        teams: ['Team A', 'Team B'],
        components: ['API'],
        targetReleases: [],
        labels: [],
        matchMode: 'any'
      })
    })

    it('creates a filter with targetReleases, labels, and matchMode', () => {
      const { filters, createFilter } = useSavedFilters('priorityFilters')

      const id = createFilter({
        name: 'Full Filter',
        teams: ['Team A'],
        components: ['UI'],
        targetReleases: ['rhoai-3.4', 'rhoai-3.3'],
        labels: ['3.4-committed'],
        matchMode: 'all'
      })

      expect(filters.value[0]).toEqual({
        id,
        name: 'Full Filter',
        teams: ['Team A'],
        components: ['UI'],
        targetReleases: ['rhoai-3.3', 'rhoai-3.4'],
        labels: ['3.4-committed'],
        matchMode: 'all'
      })
    })

    it('defaults missing new fields when creating a filter', () => {
      const { filters, createFilter } = useSavedFilters('priorityFilters')

      createFilter({ name: 'Legacy', teams: ['Team A'], components: [] })

      expect(filters.value[0].targetReleases).toEqual([])
      expect(filters.value[0].labels).toEqual([])
      expect(filters.value[0].matchMode).toBe('any')
    })

    it('sorts teams and components alphabetically', () => {
      const { filters, createFilter } = useSavedFilters('priorityFilters')

      createFilter({ name: 'Test', teams: ['Zebra', 'Alpha', 'Middle'], components: ['UI', 'API', 'Backend'] })

      expect(filters.value[0].teams).toEqual(['Alpha', 'Middle', 'Zebra'])
      expect(filters.value[0].components).toEqual(['API', 'Backend', 'UI'])
    })

    it('sorts targetReleases alphabetically', () => {
      const { filters, createFilter } = useSavedFilters('priorityFilters')

      createFilter({ name: 'Test', teams: [], components: [], targetReleases: ['rhoai-3.4', 'rhoai-3.2', 'rhoai-3.3'] })

      expect(filters.value[0].targetReleases).toEqual(['rhoai-3.2', 'rhoai-3.3', 'rhoai-3.4'])
    })

    it('persists filters to localStorage after create', () => {
      const { createFilter } = useSavedFilters('priorityFilters')

      createFilter({ name: 'My Teams', teams: ['Team A'], components: [] })

      const savedCall = localStorageMock.setItem.mock.calls.find(
        ([key]) => key === 'priorityFilters'
      )
      expect(savedCall).toBeTruthy()
      const saved = JSON.parse(savedCall[1])
      expect(saved).toHaveLength(1)
      expect(saved[0].name).toBe('My Teams')
    })

    it('appends to existing filters', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'existing', name: 'Existing', teams: ['Team A'], components: [] }
      ])

      const { filters, createFilter } = useSavedFilters('priorityFilters')

      createFilter({ name: 'New Filter', teams: ['Team B'], components: ['UI'] })

      expect(filters.value).toHaveLength(2)
      expect(filters.value[0].name).toBe('Existing')
      expect(filters.value[1].name).toBe('New Filter')
    })
  })

  describe('updateFilter', () => {
    it('updates a filter by id', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
      ])

      const { filters, updateFilter } = useSavedFilters('priorityFilters')

      updateFilter('abc123', { name: 'Renamed', teams: ['Team A', 'Team B'], components: ['UI'] })

      expect(filters.value[0]).toEqual({ id: 'abc123', name: 'Renamed', teams: ['Team A', 'Team B'], components: ['UI'] })
    })

    it('persists after update', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
      ])

      const { updateFilter } = useSavedFilters('priorityFilters')
      localStorageMock.setItem.mockClear()

      updateFilter('abc123', { name: 'Updated', teams: ['Team B'] })

      const savedCall = localStorageMock.setItem.mock.calls.find(
        ([key]) => key === 'priorityFilters'
      )
      expect(savedCall).toBeTruthy()
      const saved = JSON.parse(savedCall[1])
      expect(saved[0].name).toBe('Updated')
    })

    it('allows partial updates (name only)', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: ['UI'] }
      ])

      const { filters, updateFilter } = useSavedFilters('priorityFilters')

      updateFilter('abc123', { name: 'Renamed' })

      expect(filters.value[0].name).toBe('Renamed')
      expect(filters.value[0].teams).toEqual(['Team A'])
      expect(filters.value[0].components).toEqual(['UI'])
    })

    it('allows partial updates (teams only)', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: ['UI'] }
      ])

      const { filters, updateFilter } = useSavedFilters('priorityFilters')

      updateFilter('abc123', { teams: ['Team B', 'Team C'] })

      expect(filters.value[0].name).toBe('My Teams')
      expect(filters.value[0].teams).toEqual(['Team B', 'Team C'])
    })

    it('does nothing for non-existent filter id', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
      ])

      const { filters, updateFilter } = useSavedFilters('priorityFilters')
      localStorageMock.setItem.mockClear()

      updateFilter('nonexistent', { name: 'Updated' })

      expect(filters.value).toHaveLength(1)
      expect(filters.value[0].name).toBe('My Teams')
    })
  })

  describe('deleteFilter', () => {
    it('removes a filter by id', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] },
        { id: 'def456', name: 'Platform', teams: [], components: ['UI'] }
      ])

      const { filters, deleteFilter } = useSavedFilters('priorityFilters')

      deleteFilter('abc123')

      expect(filters.value).toHaveLength(1)
      expect(filters.value[0].id).toBe('def456')
    })

    it('clears activeFilterId if deleted filter was active', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
      ])
      localStorageMock.store['priorityFilters-active'] = 'abc123'

      const { activeFilterId, deleteFilter } = useSavedFilters('priorityFilters')

      expect(activeFilterId.value).toBe('abc123')
      deleteFilter('abc123')
      expect(activeFilterId.value).toBeNull()
    })

    it('does not clear activeFilterId if a different filter was deleted', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] },
        { id: 'def456', name: 'Platform', teams: [], components: ['UI'] }
      ])
      localStorageMock.store['priorityFilters-active'] = 'def456'

      const { activeFilterId, deleteFilter } = useSavedFilters('priorityFilters')

      deleteFilter('abc123')
      expect(activeFilterId.value).toBe('def456')
    })

    it('persists after delete', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
      ])

      const { deleteFilter } = useSavedFilters('priorityFilters')
      localStorageMock.setItem.mockClear()

      deleteFilter('abc123')

      const savedCall = localStorageMock.setItem.mock.calls.find(
        ([key]) => key === 'priorityFilters'
      )
      expect(savedCall).toBeTruthy()
      const saved = JSON.parse(savedCall[1])
      expect(saved).toHaveLength(0)
    })
  })

  describe('setActiveFilter', () => {
    it('sets activeFilterId', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
      ])

      const { activeFilterId, setActiveFilter } = useSavedFilters('priorityFilters')

      setActiveFilter('abc123')
      expect(activeFilterId.value).toBe('abc123')
    })

    it('sets activeFilterId to null for All Issues', () => {
      localStorageMock.store.priorityFilters = JSON.stringify([
        { id: 'abc123', name: 'My Teams', teams: ['Team A'], components: [] }
      ])
      localStorageMock.store['priorityFilters-active'] = 'abc123'

      const { activeFilterId, setActiveFilter } = useSavedFilters('priorityFilters')

      setActiveFilter(null)
      expect(activeFilterId.value).toBeNull()
    })

    it('persists activeFilterId to localStorage', () => {
      const { setActiveFilter } = useSavedFilters('priorityFilters')
      localStorageMock.setItem.mockClear()

      setActiveFilter('abc123')

      const savedCall = localStorageMock.setItem.mock.calls.find(
        ([key]) => key === 'priorityFilters-active'
      )
      expect(savedCall).toBeTruthy()
      expect(savedCall[1]).toBe('abc123')
    })

    it('removes activeFilterId from localStorage when set to null', () => {
      localStorageMock.store['priorityFilters-active'] = 'abc123'

      const { setActiveFilter } = useSavedFilters('priorityFilters')
      localStorageMock.removeItem.mockClear()

      setActiveFilter(null)

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('priorityFilters-active')
    })
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorageMock.store.priorityFilters = 'not valid json'

    const { filters, activeFilterId } = useSavedFilters('priorityFilters')

    expect(filters.value).toEqual([])
    expect(activeFilterId.value).toBeNull()
  })
})
