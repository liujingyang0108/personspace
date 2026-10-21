import { describe, expect, it } from 'vitest'
import { seedData } from './seed'
import { normalizeAppData } from './normalize'

describe('数据兼容处理', () => {
  it('为旧分类补充成长贡献设置', () => {
    const oldCategories = seedData.categories.map(({ countsTowardGrowth: _ignored, ...category }) => category)
    const normalized = normalizeAppData({ categories: oldCategories }, seedData)

    expect(normalized.categories.find((category) => category.id === 'category-reading')?.countsTowardGrowth).toBe(true)
    expect(normalized.categories.find((category) => category.id === 'category-work')?.countsTowardGrowth).toBe(false)
  })

  it('旧的自定义分类默认不计入成长', () => {
    const normalized = normalizeAppData({
      categories: [{ id: 'custom', name: '随手写', color: '#000', icon: 'file', description: '', template: '' }],
    }, seedData)

    expect(normalized.categories[0].countsTowardGrowth).toBe(false)
  })
})
