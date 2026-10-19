import { beforeEach, describe, expect, it, vi } from 'vitest'
import { seedData } from '../data/seed'
import { localStore } from './localStore'

const values = new Map<string, string>()

beforeEach(() => {
  values.clear()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
})

describe('localStore', () => {
  it('returns the supplied defaults when no saved data exists', () => {
    expect(localStore.load(seedData)).toBe(seedData)
  })

  it('merges partial saved data with current defaults', () => {
    values.set('life-os:data:v1', JSON.stringify({
      profile: { displayName: '新名称' },
      entries: [],
    }))

    const loaded = localStore.load(seedData)

    expect(loaded.profile.displayName).toBe('新名称')
    expect(loaded.profile.slug).toBe(seedData.profile.slug)
    expect(loaded.categories).toEqual(seedData.categories)
    expect(loaded.entries).toEqual([])
  })

  it('returns the supplied defaults when saved JSON is malformed', () => {
    values.set('life-os:data:v1', '{not-json')

    expect(localStore.load(seedData)).toBe(seedData)
  })
})
