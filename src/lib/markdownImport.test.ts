import { describe, expect, it } from 'vitest'
import { prepareMarkdownImport } from './markdownImport'

describe('Markdown file import', () => {
  it('uses the first heading as the title and normalizes line endings', () => {
    expect(prepareMarkdownImport('notes.md', '# 学习记录\r\n\r\n正文', '', '')).toEqual({
      title: '学习记录',
      content: '# 学习记录\n\n正文',
    })
  })

  it('falls back to the file name when no heading exists', () => {
    expect(prepareMarkdownImport('项目复盘.markdown', '正文', '', '').title).toBe('项目复盘')
  })

  it('appends to existing content without replacing the current title', () => {
    expect(prepareMarkdownImport('new.md', '新内容', '原标题', '原内容')).toEqual({
      title: '原标题',
      content: '原内容\n\n---\n\n新内容',
    })
  })
})
