import type { AppData, EntryCategory } from '../types'
import { addDays, fromLocalISO, toLocalISO } from './date'

export type DailyReviewSummary = ReturnType<typeof buildDailyReviewSummary>

function timestampDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : toLocalISO(date)
}

function bullet(lines: string[]) {
  return lines.map((line) => `- ${line}`).join('\n')
}

function categoryBreakdown(categoryIds: string[], categories: EntryCategory[]) {
  const counts = new Map<string, number>()
  categoryIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1))

  return [...counts.entries()].map(([id, count]) => ({
    id,
    name: categories.find((category) => category.id === id)?.name ?? '未分类',
    count,
  }))
}

export function buildDailyReviewSummary(data: AppData, date: string) {
  const tomorrow = toLocalISO(addDays(fromLocalISO(date), 1))
  const todayTasks = data.tasks.filter((task) => task.dueDate === date)
  const completedTasks = todayTasks.filter((task) => task.completed)
  const pendingTasks = todayTasks.filter((task) => !task.completed)
  const overdueTasks = data.tasks.filter((task) => task.dueDate && task.dueDate < date && !task.completed)
  const tomorrowTasks = data.tasks.filter((task) => task.dueDate === tomorrow && !task.completed)

  const entries = data.entries.filter((entry) => timestampDate(entry.createdAt) === date)
  const entryCategories = categoryBreakdown(entries.map((entry) => entry.categoryId), data.categories)

  const plans = data.plans
    .filter((plan) => !plan.archived)
    .flatMap((plan) => plan.items
      .filter((item) => item.date === date)
      .map((item) => ({ title: plan.title, unit: plan.unit, target: item.target, actual: item.actual })))
  const tomorrowPlans = data.plans
    .filter((plan) => !plan.archived)
    .flatMap((plan) => plan.items
      .filter((item) => item.date === tomorrow)
      .map((item) => ({ title: plan.title, unit: plan.unit, target: item.target, actual: item.actual })))

  const planTarget = plans.reduce((sum, plan) => sum + plan.target, 0)
  const planActual = plans.reduce((sum, plan) => sum + plan.actual, 0)
  const achievedPlans = plans.filter((plan) => plan.actual >= plan.target)
  const unfinishedPlans = plans.filter((plan) => plan.actual < plan.target)

  const wins = [
    ...completedTasks.map((task) => `完成任务：${task.title}`),
    ...achievedPlans.map((plan) => `完成计划：${plan.title} ${plan.actual}/${plan.target} ${plan.unit}`),
    ...(entries.length > 0
      ? [`新增记录：${entries.length} 条（${entryCategories.map((item) => `${item.name} ${item.count} 条`).join('、')}）`]
      : []),
  ]
  const lessons = [
    ...pendingTasks.map((task) => `今日待完成：${task.title}`),
    ...overdueTasks.map((task) => `逾期待处理：${task.title}`),
    ...unfinishedPlans.map((plan) => `计划待推进：${plan.title} ${plan.actual}/${plan.target} ${plan.unit}`),
  ]
  const nextSteps = [
    ...tomorrowTasks.map((task) => `明日任务：${task.title}`),
    ...tomorrowPlans.map((plan) => `明日计划：${plan.title} ${plan.target} ${plan.unit}`),
  ]

  return {
    date,
    tomorrow,
    tasks: { total: todayTasks.length, completed: completedTasks.length, pending: pendingTasks.length, overdue: overdueTasks.length },
    entries: { total: entries.length, categories: entryCategories },
    plans: { items: plans, total: plans.length, target: planTarget, actual: planActual, achieved: achievedPlans.length },
    draft: {
      wins: bullet(wins.length > 0 ? wins : ['今天暂无已完成任务、达标计划或新增记录。']),
      lessons: bullet(lessons.length > 0 ? lessons : ['目前没有从任务和计划中发现待调整事项。']),
      tomorrow: bullet(nextSteps.length > 0 ? nextSteps : ['明天暂无已安排的任务或计划目标。']),
    },
  }
}
