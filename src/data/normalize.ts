import type { AppData } from '../types'

export function normalizeAppData(value: Partial<AppData>, defaults: AppData): AppData {
  const defaultCategories = new Map(defaults.categories.map((category) => [category.id, category]))
  return {
    ...defaults,
    ...value,
    profile: { ...defaults.profile, ...value.profile },
    categories: (value.categories ?? defaults.categories).map((category) => ({
      ...category,
      countsTowardGrowth: category.countsTowardGrowth ?? defaultCategories.get(category.id)?.countsTowardGrowth ?? false,
    })),
    entries: value.entries ?? defaults.entries,
    tasks: value.tasks ?? defaults.tasks,
    plans: value.plans ?? defaults.plans,
    reflections: value.reflections ?? defaults.reflections,
  }
}
