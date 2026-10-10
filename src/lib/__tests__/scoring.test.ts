import { describe, it, expect } from 'vitest'
import {
  scoreChecklistItems,
  isChecklistItemPending,
  checklistPendingReason,
} from '../scoring'
import type { ChecklistItem } from '../../types'

function item(
  judgment: ChecklistItem['judgment'],
  description = '',
  id = Math.random().toString(),
): ChecklistItem {
  const needsEvidence = judgment === '符合' || judgment === '不符'
  return {
    id,
    category: '測試',
    no: 1,
    content: 'test',
    judgment,
    description,
    objectiveEvidence: needsEvidence ? '佐證紀錄' : '',
    notApplicableReason: judgment === '不適用' ? description : undefined,
  }
}

describe('isChecklistItemPending', () => {
  it('treats 不適用 without description as pending', () => {
    expect(isChecklistItemPending(item('不適用', ''))).toBe(true)
    expect(isChecklistItemPending(item('不適用', '本證書無此客戶'))).toBe(false)
  })
})

describe('checklistPendingReason', () => {
  it('names why an item cannot be scored yet', () => {
    expect(checklistPendingReason(item(null))).toBe('未判定')
    expect(checklistPendingReason({ ...item('符合'), objectiveEvidence: '' })).toBe('缺客觀證據')
    expect(checklistPendingReason(item('不適用', ''))).toBe('缺不適用理由')
    expect(checklistPendingReason(item('符合'))).toBeNull()
    expect(checklistPendingReason(item('觀察', '觀察說明'))).toBeNull()
  })
})

describe('scoreChecklistItems', () => {
  it('calculates full score for all conform', () => {
    const items = [item('符合'), item('符合'), item('符合')]
    const result = scoreChecklistItems(items)
    expect(result.score).toBe(100)
    expect(result.status).toBe('scored')
    expect(result.applicableItems).toBe(3)
  })

  it('excludes 不適用 from denominator when description provided', () => {
    const items = [item('符合'), item('不適用', '不適用原因'), item('不符', '')]
    const result = scoreChecklistItems(items)
    expect(result.applicableItems).toBe(2)
    expect(result.score).toBe(50)
  })

  it('applies observation partial score', () => {
    const items = [item('符合'), item('觀察')]
    const result = scoreChecklistItems(items)
    expect(result.score).toBe(75)
  })

  it('marks unevaluated when no applicable items and pending remain', () => {
    const items = [item(null), item(null)]
    const result = scoreChecklistItems(items)
    expect(result.score).toBeNull()
    expect(result.status).toBe('unevaluated')
  })

  it('marks incomplete when partial judgments remain', () => {
    const items = [item('符合'), item(null)]
    const result = scoreChecklistItems(items)
    expect(result.status).toBe('incomplete')
    expect(result.breakdown.pending).toBe(1)
  })

  it('marks incomplete when all 不適用 lack description', () => {
    const items = [item('不適用'), item('不適用')]
    const result = scoreChecklistItems(items)
    expect(result.status).toBe('incomplete')
    expect(result.breakdown.pending).toBe(2)
  })

  it('marks not_applicable when all items are N/A with description', () => {
    const items = [item('不適用', '原因'), item('不適用', '原因')]
    const result = scoreChecklistItems(items)
    expect(result.score).toBeNull()
    expect(result.status).toBe('not_applicable')
  })

  it('scores one shared checklist item once', () => {
    const shared: ChecklistItem = {
      ...item('符合'),
      certificateScope: 'shared',
    }
    const result = scoreChecklistItems([shared])
    expect(result.totalItems).toBe(1)
    expect(result.applicableItems).toBe(1)
    expect(result.score).toBe(100)
  })

  it('does not infer a judgment from legacy per-company values', () => {
    const legacy: ChecklistItem = {
      ...item(null),
      certificateScope: 'shared',
      judgmentByCompany: { jiurun: '符合', zhenglongxing: '符合' },
    }
    const result = scoreChecklistItems([legacy])
    expect(result.breakdown.pending).toBe(1)
    expect(result.applicableItems).toBe(0)
    expect(result.status).toBe('unevaluated')
  })
})
