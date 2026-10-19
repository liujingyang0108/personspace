import type { AppData } from '../types'
import { todayISO } from '../lib/date'

const SENT_KEY = 'life-os:sent-reminders:v1'

type Reminder = { id: string; title: string; body: string; time: string }

function remindersForToday(data: AppData): Reminder[] {
  const today = todayISO()
  const taskReminders = data.tasks
    .filter((task) => !task.completed && task.dueDate === today && task.dueTime)
    .map((task) => ({ id: `task:${task.id}:${today}`, title: '今日任务提醒', body: task.title, time: task.dueTime! }))
  const planReminders = data.plans
    .filter((plan) => !plan.archived && plan.items.some((item) => item.date === today && item.actual < item.target))
    .flatMap((plan) => [
      { id: `plan:start:${plan.id}:${today}`, title: '计划开始提醒', body: plan.title, time: plan.reminderStart },
      { id: `plan:check:${plan.id}:${today}`, title: '计划完成回顾', body: `别忘了记录“${plan.title}”的今日进度`, time: plan.reminderCheckin },
    ])
  return [...taskReminders, ...planReminders]
}

function sentIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SENT_KEY) || '[]') as string[])
  } catch {
    return new Set()
  }
}

export function checkReminders(data: AppData): Reminder[] {
  const now = new Date()
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const sent = sentIds()
  const due = remindersForToday(data).filter((reminder) => reminder.time <= current && !sent.has(reminder.id))
  if (!due.length) return []
  for (const reminder of due) {
    sent.add(reminder.id)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(reminder.title, { body: reminder.body, tag: reminder.id })
    }
  }
  localStorage.setItem(SENT_KEY, JSON.stringify([...sent].slice(-200)))
  return due
}

export async function requestReminderPermission() {
  if (!('Notification' in window)) return 'unsupported' as const
  return Notification.requestPermission()
}

export function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported' as const
  return Notification.permission
}
