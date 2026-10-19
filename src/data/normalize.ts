import type { AppData } from '../types'

export function normalizeAppData(value: Partial<AppData>, defaults: AppData): AppData {
  return {
    ...defaults,
    ...value,
    profile: { ...defaults.profile, ...value.profile },
    categories: value.categories ?? defaults.categories,
    entries: value.entries ?? defaults.entries,
    tasks: value.tasks ?? defaults.tasks,
    plans: value.plans ?? defaults.plans,
    reflections: value.reflections ?? defaults.reflections,
  }
}
