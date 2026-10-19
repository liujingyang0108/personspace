import { describe, expect, it } from 'vitest'
import { buildPlanItems, distributeIntegerTotal } from './plan'

describe('计划分配', () => {
  it('将 3000 个单词平均分配到 30 天', () => {
    const values = distributeIntegerTotal(3000, Array.from({ length: 30 }, () => 1))
    expect(values).toHaveLength(30)
    expect(values.every((value) => value === 100)).toBe(true)
  })

  it('不能整除时仍保持总量准确', () => {
    const values = distributeIntegerTotal(3001, Array.from({ length: 30 }, () => 1))
    expect(values.reduce((sum, value) => sum + value, 0)).toBe(3001)
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1)
  })

  it('只在选定的执行日生成计划', () => {
    const items = buildPlanItems(700, '2026-10-19', '2026-10-25', [1, 2, 3, 4, 5, 6, 0], 'even')
    expect(items).toHaveLength(7)
    expect(items.reduce((sum, item) => sum + item.target, 0)).toBe(700)
  })

  it('递增模式后期任务量更高', () => {
    const items = buildPlanItems(700, '2026-10-19', '2026-10-25', [1, 2, 3, 4, 5, 6, 0], 'rampUp')
    expect(items.at(-1)!.target).toBeGreaterThan(items[0].target)
    expect(items.reduce((sum, item) => sum + item.target, 0)).toBe(700)
  })
})
