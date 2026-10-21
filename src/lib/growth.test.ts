import { describe, expect, it } from 'vitest'
import type { AppData, Entry } from '../types'
import { buildGrowthTimeline, entryCountsTowardGrowth } from './growth'

const base: AppData = {
  profile: { slug: 'me', displayName: '我', headline: '', bio: '', currentFocus: '', published: false },
  categories: [
    { id: 'reading', name: '读书感想', color: '#000', icon: 'book', description: '', template: '', countsTowardGrowth: true },
    { id: 'diary', name: '日记', color: '#000', icon: 'book', description: '', template: '', countsTowardGrowth: false },
  ],
  entries: [], tasks: [], plans: [], reflections: [],
}

function entry(id: string, categoryId: string, createdAt: string, growthOverride?: boolean): Entry {
  return { id, title: id, content: '', categoryId, tags: [], visibility: 'private', createdAt, updatedAt: createdAt, growthOverride }
}

describe('成长轨迹', () => {
  it('按分类规则统计成长记录，并允许单篇覆盖', () => {
    const reading = entry('读书心得', 'reading', '2026-10-20T10:00:00+08:00')
    const diary = entry('随手日记', 'diary', '2026-10-20T11:00:00+08:00')
    const promotedDiary = entry('学习结果', 'diary', '2026-10-20T12:00:00+08:00', true)

    expect(entryCountsTowardGrowth(reading, base.categories[0])).toBe(true)
    expect(entryCountsTowardGrowth(diary, base.categories[1])).toBe(false)
    expect(entryCountsTowardGrowth(promotedDiary, base.categories[1])).toBe(true)

    const [day] = buildGrowthTimeline({ ...base, entries: [reading, diary, promotedDiary] }, '2026-10-20', 1)
    expect(day.growthEntries.map((item) => item.title)).toEqual(['读书心得', '学习结果'])
    expect(day.score).toBe(20)
  })

  it('工作记录不重复加分，任务完成仍计入行动', () => {
    const data: AppData = {
      ...base,
      entries: [entry('工作完成记录', 'diary', '2026-10-20T11:00:00+08:00')],
      tasks: [{ id: 'task', title: '完成工作', dueLabel: '今天', dueDate: '2026-10-20', completed: true, tone: 'sage' }],
    }
    const [day] = buildGrowthTimeline(data, '2026-10-20', 1)

    expect(day.growthEntries).toHaveLength(0)
    expect(day.tasks).toEqual({ total: 1, completed: 1 })
    expect(day.score).toBe(35)
  })

  it('连续无行动时每三天后退一步', () => {
    const data = {
      ...base,
      entries: [entry('开始学习', 'reading', '2026-10-01T10:00:00+08:00')],
    }
    const timeline = buildGrowthTimeline(data, '2026-10-07', 7)
    expect(timeline.map((day) => day.movement)).toEqual([2, 0, 0, -1, 0, 0, -1])
  })
})
