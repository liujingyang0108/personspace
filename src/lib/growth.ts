import type { AppData, Entry, EntryCategory } from '../types'
import { addDays, fromLocalISO, toLocalISO } from './date'

export type GrowthMovement = -1 | 0 | 1 | 2

export type GrowthDay = {
  date: string
  score: number
  movement: GrowthMovement
  position: number
  hasAction: boolean
  tasks: { total: number; completed: number }
  plans: { total: number; achieved: number; averageRate: number }
  growthEntries: Array<{ id: string; title: string }>
  reflections: number
  reasons: string[]
}

function timestampDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : toLocalISO(date)
}

export function entryCountsTowardGrowth(entry: Entry, category?: EntryCategory) {
  return entry.growthOverride ?? category?.countsTowardGrowth ?? false
}

function rawDay(data: AppData, date: string) {
  const tasks = data.tasks.filter((task) => task.dueDate === date)
  const completedTasks = tasks.filter((task) => task.completed)
  const planItems = data.plans
    .filter((plan) => !plan.archived)
    .flatMap((plan) => plan.items
      .filter((item) => item.date === date)
      .map((item) => ({ title: plan.title, target: item.target, actual: item.actual })))
  const growthEntries = data.entries
    .filter((entry) => timestampDate(entry.createdAt) === date)
    .filter((entry) => entryCountsTowardGrowth(entry, data.categories.find((category) => category.id === entry.categoryId)))
    .map((entry) => ({ id: entry.id, title: entry.title }))
  const reflections = data.reflections.filter((reflection) => reflection.date === date).length

  const taskRate = tasks.length === 0 ? 0 : completedTasks.length / tasks.length
  const planRates = planItems.map((item) => item.target === 0 ? 1 : Math.min(1, item.actual / item.target))
  const averagePlanRate = planRates.length === 0 ? 0 : planRates.reduce((sum, rate) => sum + rate, 0) / planRates.length
  const achievedPlans = planRates.filter((rate) => rate >= 1).length
  const score = Math.round(taskRate * 35 + averagePlanRate * 35 + (growthEntries.length > 0 ? 20 : 0) + (reflections > 0 ? 10 : 0))
  const hasAction = completedTasks.length > 0 || planItems.some((item) => item.actual > 0) || growthEntries.length > 0 || reflections > 0
  const reasons = [
    ...(tasks.length > 0 ? [`任务完成 ${completedTasks.length}/${tasks.length}`] : []),
    ...(planItems.length > 0 ? [`计划达标 ${achievedPlans}/${planItems.length}`] : []),
    ...growthEntries.map((entry) => `成长记录：${entry.title}`),
    ...(reflections > 0 ? ['完成了当天复盘'] : []),
  ]

  return {
    date,
    score,
    hasAction,
    tasks: { total: tasks.length, completed: completedTasks.length },
    plans: { total: planItems.length, achieved: achievedPlans, averageRate: Math.round(averagePlanRate * 100) },
    growthEntries,
    reflections,
    reasons: reasons.length > 0 ? reasons : ['当天没有产生可计入成长的行动'],
  }
}

export function buildGrowthTimeline(data: AppData, endDate: string, days = 30): GrowthDay[] {
  if (days <= 0) return []
  const requestedStart = toLocalISO(addDays(fromLocalISO(endDate), -(days - 1)))
  const datedActivity = [
    ...data.tasks.flatMap((task) => task.dueDate ? [task.dueDate] : []),
    ...data.entries.map((entry) => timestampDate(entry.createdAt)).filter(Boolean),
    ...data.plans.flatMap((plan) => plan.items.map((item) => item.date)),
    ...data.reflections.map((reflection) => reflection.date),
  ].sort()
  const firstActivity = datedActivity[0]
  const calculationStart = firstActivity && firstActivity < requestedStart ? firstActivity : requestedStart
  const rawStart = addDays(fromLocalISO(calculationStart), -1)
  const rawLength = Math.round((fromLocalISO(endDate).getTime() - rawStart.getTime()) / 86_400_000) + 1
  const rawDays = Array.from({ length: rawLength }, (_, index) => rawDay(data, toLocalISO(addDays(rawStart, index))))
  let inactiveStreak = 0
  let position = 0

  return rawDays.map((day, index) => {
    const hasStarted = Boolean(firstActivity && day.date >= firstActivity)
    inactiveStreak = !hasStarted || day.hasAction ? 0 : inactiveStreak + 1
    const previousScore = rawDays[index - 1]?.score ?? 0
    const delta = day.score - previousScore
    let movement: GrowthMovement = !hasStarted || !day.hasAction ? 0 : delta >= 20 ? 2 : delta >= 8 ? 1 : delta <= -8 ? -1 : 0
    if (hasStarted && !day.hasAction && inactiveStreak >= 3 && inactiveStreak % 3 === 0) movement = -1
    position = Math.max(0, position + movement)
    return { ...day, movement, position }
  }).filter((day) => day.date >= requestedStart)
}

export function movementLabel(movement: GrowthMovement) {
  if (movement === 2) return '明显进步'
  if (movement === 1) return '向前一步'
  if (movement === -1) return '暂时后退'
  return '保持原位'
}
