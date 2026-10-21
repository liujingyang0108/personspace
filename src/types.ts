export type Visibility = 'private' | 'public'

export type EntryCategory = {
  id: string
  name: string
  color: string
  icon: string
  description: string
  template: string
  countsTowardGrowth?: boolean
}

export type Entry = {
  id: string
  title: string
  content: string
  categoryId: string
  tags: string[]
  visibility: Visibility
  createdAt: string
  updatedAt: string
  growthOverride?: boolean
}

export type Task = {
  id: string
  title: string
  dueLabel: string
  dueDate?: string
  dueTime?: string
  completed: boolean
  tone: 'sage' | 'amber' | 'blue'
  createdAt?: string
}

export type DistributionMode = 'even' | 'rampUp' | 'rampDown'

export type PlanItem = {
  date: string
  target: number
  actual: number
}

export type Plan = {
  id: string
  title: string
  total: number
  unit: string
  startDate: string
  endDate: string
  activeWeekdays: number[]
  distributionMode: DistributionMode
  reminderStart: string
  reminderCheckin: string
  items: PlanItem[]
  createdAt: string
  archived?: boolean
}

export type Reflection = {
  id: string
  date: string
  wins: string
  lessons: string
  tomorrow: string
  createdAt: string
}

export type ProfileSettings = {
  slug: string
  displayName: string
  headline: string
  bio: string
  currentFocus: string
  published: boolean
}

export type AppData = {
  profile: ProfileSettings
  categories: EntryCategory[]
  entries: Entry[]
  tasks: Task[]
  plans: Plan[]
  reflections: Reflection[]
}
