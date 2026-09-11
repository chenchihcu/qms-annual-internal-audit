import { describe, it, expect } from 'vitest'
import { isSeedChecklistItem } from '../checklistItem'
import type { ChecklistItem } from '../../types'

describe('isSeedChecklistItem', () => {
  it('treats origin seed as seed', () => {
    expect(
      isSeedChecklistItem({
        id: '1',
        category: '一般',
        no: 1,
        content: '',
        judgment: null,
        description: '',
        origin: 'seed',
      }),
    ).toBe(true)
  })

  it('treats custom and carryforward as non-seed', () => {
    const base: ChecklistItem = {
      id: '1',
      category: '自訂',
      no: 1,
      content: '',
      judgment: null,
      description: '',
      origin: 'custom',
    }
    expect(isSeedChecklistItem(base)).toBe(false)
    expect(isSeedChecklistItem({ ...base, origin: 'carryforward', category: '跨年追蹤' })).toBe(false)
  })
})
