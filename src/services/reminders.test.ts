import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '../types'
import { checkReminders } from './reminders'

const values = new Map<string, string>()
const reminderData: AppData = {
  profile: {
    slug: 'test',
    displayName: '测试',
    headline: '',
    bio: '',
    currentFocus: '',
    published: false,
  },
  categories: [],
  entries: [],
  tasks: [{
    id: 'task-1',
    title: '晚间复盘',
    dueLabel: '今天',
    dueDate: '2026-10-19',
    dueTime: '21:30',
    completed: false,
    tone: 'blue',
  }],
  plans: [],
  reflections: [],
}

beforeEach(() => {
  values.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-19T22:00:00+08:00'))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
  vi.stubGlobal('window', {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('checkReminders', () => {
  it('returns each due reminder only once', () => {
    expect(checkReminders(reminderData)).toHaveLength(1)
    expect(checkReminders(reminderData)).toEqual([])
  })

  it('continues with an empty sent history when stored JSON is malformed', () => {
    values.set('life-os:sent-reminders:v1', '{not-json')

    expect(checkReminders(reminderData)).toMatchObject([
      { title: '今日任务提醒', body: '晚间复盘' },
    ])
  })
})
