import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { removeEntry, replaceEntry, toggleEntryVisibility } from './entries'

const entry: Entry = {
  id: 'entry-1',
  title: '原始标题',
  content: '正文',
  categoryId: 'diary',
  tags: ['记录'],
  visibility: 'private',
  createdAt: '2026-10-20T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
}

describe('entry collection helpers', () => {
  it('replaces an edited entry without disturbing the others', () => {
    const other = { ...entry, id: 'entry-2' }
    const edited = { ...entry, title: '修改后的标题', updatedAt: '2026-10-20T09:00:00.000Z' }

    expect(replaceEntry([entry, other], edited)).toEqual([edited, other])
  })

  it('toggles visibility and records the update time', () => {
    const [updated] = toggleEntryVisibility([entry], entry.id, '2026-10-20T10:00:00.000Z')

    expect(updated.visibility).toBe('public')
    expect(updated.updatedAt).toBe('2026-10-20T10:00:00.000Z')
    expect(toggleEntryVisibility([updated], entry.id, '2026-10-20T11:00:00.000Z')[0].visibility).toBe('private')
  })

  it('removes only the selected entry', () => {
    const other = { ...entry, id: 'entry-2' }

    expect(removeEntry([entry, other], entry.id)).toEqual([other])
  })
})
