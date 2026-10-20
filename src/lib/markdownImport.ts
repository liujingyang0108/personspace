export const MAX_MARKDOWN_FILE_SIZE = 2 * 1024 * 1024

export function prepareMarkdownImport(fileName: string, source: string, currentTitle: string, currentContent: string) {
  const importedContent = source.replace(/\r\n?/g, '\n').trim()
  const fileTitle = fileName.replace(/\.(?:md|markdown)$/i, '').trim()
  const headingTitle = importedContent.match(/^#\s+(.+)$/m)?.[1].trim()
  const title = currentTitle.trim() || headingTitle || fileTitle || '导入的记录'
  const content = currentContent.trim()
    ? `${currentContent.trimEnd()}\n\n---\n\n${importedContent}`
    : importedContent

  return { title, content }
}
