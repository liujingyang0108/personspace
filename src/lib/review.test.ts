import { describe, expect, it } from 'vitest'
import type { AppData } from '../types'
import { buildDailyReviewSummary } from './review'

const data: AppData = {
  profile: { slug: 'me', displayName: '我', headline: '', bio: '', currentFocus: '', published: false },
  categories: [
    { id: 'work', name: '工作记录', color: '#000', icon: 'file', description: '', template: '' },
    { id: 'reading', name: '读书感想', color: '#000', icon: 'book', description: '', template: '' },
  ],
  tasks: [
    { id: 'done', title: '完成文档', dueLabel: '今天', dueDate: '2026-10-20', completed: true, tone: 'sage' },
    { id: 'pending', title: '整理资料', dueLabel: '今天', dueDate: '2026-10-20', completed: false, tone: 'amber' },
    { id: 'overdue', title: '回复邮件', dueLabel: '昨天', dueDate: '2026-10-19', completed: false, tone: 'blue' },
    { id: 'tomorrow', title: '阅读论文', dueLabel: '明天', dueDate: '2026-10-21', completed: false, tone: 'sage' },
  ],
  entries: [
    { id: 'entry-1', title: '工作', content: '', categoryId: 'work', tags: [], visibility: 'private', createdAt: '2026-10-20T02:00:00+08:00', updatedAt: '2026-10-20T02:00:00+08:00' },
    { id: 'entry-2', title: '读书', content: '', categoryId: 'reading', tags: [], visibility: 'private', createdAt: '2026-10-20T15:00:00+08:00', updatedAt: '2026-10-20T15:00:00+08:00' },
  ],
  plans: [{
    id: 'plan', title: '背单词', total: 3000, unit: '个', startDate: '2026-10-20', endDate: '2026-11-18', activeWeekdays: [0, 1, 2, 3, 4, 5, 6], distributionMode: 'even', reminderStart: '08:00', reminderCheckin: '22:00', createdAt: '2026-10-20T00:00:00+08:00',
    items: [
      { date: '2026-10-20', target: 100, actual: 60 },
      { date: '2026-10-21', target: 100, actual: 0 },
    ],
  }],
  reflections: [],
}

describe('每日复盘自动汇总', () => {
  it('只统计指定日期的数据，并区分逾期和明日事项', () => {
    const summary = buildDailyReviewSummary(data, '2026-10-20')

    expect(summary.tasks).toEqual({ total: 2, completed: 1, pending: 1, overdue: 1 })
    expect(summary.entries.total).toBe(2)
    expect(summary.entries.categories.map((item) => item.name)).toEqual(['工作记录', '读书感想'])
    expect(summary.plans).toMatchObject({ total: 1, target: 100, actual: 60, achieved: 0 })
    expect(summary.plans.items).toEqual([{ title: '背单词', unit: '个', target: 100, actual: 60 }])
    expect(summary.draft.wins).toContain('完成任务：完成文档')
    expect(summary.draft.lessons).toContain('逾期待处理：回复邮件')
    expect(summary.draft.tomorrow).toContain('明日任务：阅读论文')
    expect(summary.draft.tomorrow).toContain('明日计划：背单词 100 个')
  })

  it('没有数据时生成明确的空状态草稿', () => {
    const empty = buildDailyReviewSummary({ ...data, tasks: [], entries: [], plans: [] }, '2026-10-20')

    expect(empty.draft.wins).toContain('暂无已完成任务')
    expect(empty.draft.lessons).toContain('没有从任务和计划中发现')
    expect(empty.draft.tomorrow).toContain('暂无已安排')
  })
})
