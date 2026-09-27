import { describe, it, expect } from 'vitest'
import { CHECKLIST_SEED } from '../../data/checklistLoader'
import {
  getChecklistDisplayCategory,
  getChecklistDisplayContent,
  isSeedChecklistItem,
} from '../checklistItem'
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

  it('presents legacy two-company seed copy as one shared work item without changing the source item', () => {
    const legacy: ChecklistItem = {
      id: 'qp03-10',
      category: '管審紀錄（雙證）',
      no: 10,
      content: '九潤精密、正隆興精密是否各有一份管理審查會議紀錄（同一人主持仍須分開備查），且內容涵蓋管審輸入與決議。',
      judgment: null,
      description: '',
      origin: 'seed',
    }

    expect(getChecklistDisplayCategory(legacy)).toBe('管理審查紀錄')
    expect(getChecklistDisplayContent(legacy)).toBe('組織是否保存管理審查會議紀錄，並涵蓋管理審查輸入事項與決議？')
    expect(getChecklistDisplayContent(legacy)).not.toMatch(/九潤|正隆興|雙證/)
    expect(legacy.category).toBe('管審紀錄（雙證）')
    expect(legacy.content).toContain('九潤精密、正隆興精密')
    expect(legacy.no).toBe(10)
  })

  it('leaves custom text unchanged even if it matches legacy company-specific wording', () => {
    const custom: ChecklistItem = {
      id: 'custom-1',
      category: '自訂',
      no: 1,
      content: '九潤精密、正隆興精密是否各有一份管理審查會議紀錄（同一人主持仍須分開備查），且內容涵蓋管審輸入與決議。',
      judgment: null,
      description: '',
      origin: 'custom',
    }

    expect(getChecklistDisplayCategory(custom)).toBe('自訂')
    expect(getChecklistDisplayContent(custom)).toBe(custom.content)
  })

  it('covers every legacy company-specific seed entry in the rendered checklist copy', () => {
    const legacyEntries = Object.values(CHECKLIST_SEED.procedures)
      .filter((procedure) => !procedure._pending)
      .flatMap((procedure) => procedure.categories.flatMap((category) =>
        category.items.map((question) => ({ ...question, category: category.name })),
      ))
      .filter((question) => /九潤|正隆興|兩公司|雙法人|雙證/.test(`${question.content} ${question.category}`))
      .map((question, index): ChecklistItem => ({
        id: `seed-legacy-${index}`,
        category: question.category ?? '',
        no: question.no,
        content: question.content,
        judgment: null,
        description: '',
        origin: 'seed',
      }))

    expect(legacyEntries.length).toBeGreaterThan(0)
    for (const item of legacyEntries) {
      expect(`${getChecklistDisplayCategory(item)} ${getChecklistDisplayContent(item)}`).not.toMatch(
        /九潤|正隆興|兩公司|雙法人|雙證/,
      )
    }
  })
})
