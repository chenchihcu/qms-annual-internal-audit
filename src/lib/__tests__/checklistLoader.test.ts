import { describe, it, expect } from 'vitest'
import { mergeChecklistWithSeed, createChecklistForProcedure } from '../../data/checklistLoader'
import type { ChecklistItem } from '../../types'

describe('createChecklistForProcedure', () => {
  it('includes QP-03 management review items with AS9100 clauses', () => {
    const items = createChecklistForProcedure('QP-03', '品保部')
    const item9 = items.find((i) => i.no === 9)
    const item10 = items.find((i) => i.no === 10)
    expect(item9?.category).toBe('管審輸入')
    expect(item9?.as9100Clauses).toEqual(['9.3.2'])
    expect(item10?.category).toBe('管審紀錄（雙證）')
    expect(item10?.as9100Clauses).toEqual(['9.3.3'])
  })
})

describe('mergeChecklistWithSeed', () => {
  it('appends new seed items without duplicating category+no', () => {
    const seedItems = createChecklistForProcedure('QP-01', '品保部')
    const partial: ChecklistItem[] = seedItems.slice(0, 2).map((i) => ({
      ...i,
      judgment: '符合',
      description: '',
    }))
    const merged = mergeChecklistWithSeed(partial, 'QP-01', '品保部')
    expect(merged.length).toBe(seedItems.length)
    expect(merged.filter((i) => i.no === 1)).toHaveLength(1)
  })
})
