import type { Entry } from '../types'

const codeSegmentPattern = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g
export type WikiLinkEntry = Pick<Entry, 'id' | 'title' | 'content'>

function escapeMarkdownLabel(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function transformOutsideCode(content: string, transform: (segment: string) => string) {
  return content.split(codeSegmentPattern).map((segment, index) => index % 2 ? segment : transform(segment)).join('')
}

export function expandWikiLinks(content: string, entries: WikiLinkEntry[]) {
  return transformOutsideCode(content, (segment) => segment.replace(/\[\[([^\]\n]+)\]\]/g, (_match, rawValue: string) => {
    const value = rawValue.trim()
    const storedLink = /^entry:([^|]+)\|(.+)$/.exec(value)
    const target = storedLink
      ? entries.find((entry) => entry.id === storedLink[1].trim())
      : entries.find((entry) => entry.title.trim().toLocaleLowerCase() === value.toLocaleLowerCase())
    const label = target?.title ?? storedLink?.[2].trim() ?? value
    const destination = target ? `#entry-${encodeURIComponent(target.id)}` : '#entry-missing'
    return `[${escapeMarkdownLabel(label)}](${destination})`
  }))
}

export function referencesEntry(content: string, target: Pick<Entry, 'id' | 'title'>) {
  let referenced = false
  transformOutsideCode(content, (segment) => {
    if (segment.includes(`[[entry:${target.id}|`)) referenced = true
    if (segment.toLocaleLowerCase().includes(`[[${target.title.trim().toLocaleLowerCase()}]]`)) referenced = true
    return segment
  })
  return referenced
}
