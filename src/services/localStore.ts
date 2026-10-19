import type { AppData } from '../types'
import { normalizeAppData } from '../data/normalize'

const STORAGE_KEY = 'life-os:data:v1'

export const localStore = {
  load(fallback: AppData): AppData {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return fallback
      const saved = JSON.parse(raw) as Partial<AppData>
      return normalizeAppData(saved, fallback)
    } catch {
      return fallback
    }
  },

  save(data: AppData) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  },

  clear() {
    window.localStorage.removeItem(STORAGE_KEY)
  },
}
