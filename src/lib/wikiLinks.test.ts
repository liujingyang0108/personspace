import { describe, expect, it } from 'vitest'
import type { Entry } from '../types'
import { expandWikiLinks, referencesEntry } from './wikiLinks'

const entries: Entry[] = [{
  id: 'entry-target',
  title: '项目复盘',
  content: '',
  categoryId: 'work',
  tags: [],
  visibility: 'private',
  createdAt: '2026-10-20T08:00:00.000Z',
  updatedAt: '2026-10-20T08:00:00.000Z',
}]

describe('record wiki links', () => {
  it('resolves title and stable id links', () => {
    expect(expandWikiLinks('参见 [[项目复盘]]', entries)).toBe('参见 [项目复盘](#entry-entry-target)')
    expect(expandWikiLinks('参见 [[entry:entry-target|旧标题]]', entries)).toBe('参见 [项目复盘](#entry-entry-target)')
  })

  it('marks missing records and leaves code examples unchanged', () => {
    expect(expandWikiLinks('[[已删除]]', entries)).toBe('[已删除](#entry-missing)')
    expect(expandWikiLinks('`[[项目复盘]]`', entries)).toBe('`[[项目复盘]]`')
    expect(expandWikiLinks('```md\n[[项目复盘]]\n```', entries)).toBe('```md\n[[项目复盘]]\n```')
  })

  it('finds backlinks without counting code examples', () => {
    expect(referencesEntry('后续见 [[entry:entry-target|项目复盘]]', entries[0])).toBe(true)
    expect(referencesEntry('```md\n[[项目复盘]]\n```', entries[0])).toBe(false)
  })
})
