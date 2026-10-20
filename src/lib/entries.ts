import type { Entry } from '../types'

export function replaceEntry(entries: Entry[], nextEntry: Entry) {
  return entries.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry))
}

export function toggleEntryVisibility(entries: Entry[], id: string, updatedAt: string) {
  return entries.map((entry) => (
    entry.id === id
      ? { ...entry, visibility: entry.visibility === 'public' ? 'private' as const : 'public' as const, updatedAt }
      : entry
  ))
}

export function removeEntry(entries: Entry[], id: string) {
  return entries.filter((entry) => entry.id !== id)
}
