import type { AppData, Entry, Plan } from '../types'
import { addDays, toLocalISO, todayISO } from '../lib/date'
import { buildPlanItems } from '../lib/plan'

const now = new Date()
const today = todayISO()
const monthLater = toLocalISO(addDays(now, 29))

const wordPlan: Plan = {
  id: 'plan-vocabulary',
  title: '一个月掌握 3000 个单词',
  total: 3000,
  unit: '个单词',
  startDate: today,
  endDate: monthLater,
  activeWeekdays: [0, 1, 2, 3, 4, 5, 6],
  distributionMode: 'even',
  reminderStart: '08:00',
  reminderCheckin: '21:30',
  items: buildPlanItems(3000, today, monthLater, [0, 1, 2, 3, 4, 5, 6], 'even'),
  createdAt: now.toISOString(),
}

const entries: Entry[] = [
  {
    id: 'entry-1',
    title: '先建立节奏，再追求速度',
    content: '今天重新整理了长期计划。与其一次安排太多，不如先找到每天愿意重复的最小动作。',
    categoryId: 'category-diary',
    tags: ['复盘', '节奏'],
    visibility: 'private',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  },
  {
    id: 'entry-2',
    title: '《把时间当作朋友》读书摘记',
    content: '真正重要的是接受积累需要时间，并为重复做正确的事情留下空间。',
    categoryId: 'category-reading',
    tags: ['阅读', '时间'],
    visibility: 'public',
    createdAt: addDays(now, -2).toISOString(),
    updatedAt: addDays(now, -2).toISOString(),
  },
]

export const seedData: AppData = {
  profile: {
    slug: 'liubai',
    displayName: '留白',
    headline: '生活里真正留下来的，通常不是答案，而是认真想过的痕迹。',
    bio: '工作、阅读、成长与一些正在发生的事情。',
    currentFocus: '认真生活，持续记录。',
    published: true,
  },
  categories: [
    { id: 'category-work', name: '工作记录', color: '#52796f', icon: 'briefcase', description: '记录项目进展、问题和下一步', template: '今日进展：\n\n遇到的问题：\n\n下一步：', countsTowardGrowth: false },
    { id: 'category-diary', name: '日记', color: '#bb7b58', icon: 'book', description: '记录当天发生的事情与感受', template: '今天发生了什么：\n\n我的感受：\n\n想留给明天的话：', countsTowardGrowth: false },
    { id: 'category-reading', name: '读书感想', color: '#6f7896', icon: 'library', description: '整理书籍、摘录与自己的理解', template: '书名：\n作者：\n\n触动我的内容：\n\n我的理解：', countsTowardGrowth: true },
  ],
  entries,
  tasks: [
    { id: 'task-1', title: '完成今日 100 个单词', dueLabel: '今天 21:30 前', dueDate: today, dueTime: '21:30', completed: false, tone: 'sage', createdAt: now.toISOString() },
    { id: 'task-2', title: '整理本周工作记录', dueLabel: '今天', dueDate: today, completed: false, tone: 'amber', createdAt: now.toISOString() },
    { id: 'task-3', title: '晚间复盘 10 分钟', dueLabel: '今晚 22:00', dueDate: today, dueTime: '22:00', completed: false, tone: 'blue', createdAt: now.toISOString() },
  ],
  plans: [wordPlan],
  reflections: [],
}
