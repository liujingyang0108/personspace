import type { DistributionMode, PlanItem } from '../types'
import { addDays, fromLocalISO, toLocalISO } from './date'

export function datesInRange(startDate: string, endDate: string, activeWeekdays: number[]) {
  const start = fromLocalISO(startDate)
  const end = fromLocalISO(endDate)
  const dates: string[] = []

  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    if (activeWeekdays.includes(cursor.getDay())) dates.push(toLocalISO(cursor))
  }

  return dates
}

function weightsFor(length: number, mode: DistributionMode) {
  if (mode === 'even') return Array.from({ length }, () => 1)
  if (mode === 'rampUp') return Array.from({ length }, (_, index) => 0.7 + (0.6 * index) / Math.max(length - 1, 1))
  return Array.from({ length }, (_, index) => 1.3 - (0.6 * index) / Math.max(length - 1, 1))
}

export function distributeIntegerTotal(total: number, weights: number[]) {
  if (total < 0 || !Number.isFinite(total)) throw new Error('计划总量必须是非负数字')
  if (weights.length === 0) return []

  const safeTotal = Math.round(total)
  const weightSum = weights.reduce((sum, weight) => sum + Math.max(weight, 0), 0)
  if (weightSum === 0) return Array.from({ length: weights.length }, () => 0)

  const raw = weights.map((weight) => (safeTotal * Math.max(weight, 0)) / weightSum)
  const values = raw.map(Math.floor)
  let remainder = safeTotal - values.reduce((sum, value) => sum + value, 0)

  const remainderOrder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)

  for (let index = 0; index < remainder; index += 1) {
    values[remainderOrder[index % remainderOrder.length].index] += 1
  }

  return values
}

export function buildPlanItems(
  total: number,
  startDate: string,
  endDate: string,
  activeWeekdays: number[],
  mode: DistributionMode,
): PlanItem[] {
  const dates = datesInRange(startDate, endDate, activeWeekdays)
  const targets = distributeIntegerTotal(total, weightsFor(dates.length, mode))
  return dates.map((date, index) => ({ date, target: targets[index], actual: 0 }))
}

export function planProgress(items: PlanItem[]) {
  const total = items.reduce((sum, item) => sum + item.target, 0)
  const actual = items.reduce((sum, item) => sum + item.actual, 0)
  return { total, actual, percent: total === 0 ? 0 : Math.min(100, Math.round((actual / total) * 100)) }
}
