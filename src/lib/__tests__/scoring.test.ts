import { describe, it, expect } from 'vitest'
import { scoreChecklistItems, calculateAnnualScore } from '../scoring'
import type { ChecklistItem, ProcedureAudit } from '../../types'

function item(judgment: ChecklistItem['judgment'], id = Math.random().toString()): ChecklistItem {
  return { id, category: '測試', no: 1, content: 'test', judgment, description: '' }
}

describe('scoreChecklistItems', () => {
  it('calculates full score for all conform', () => {
    const items = [item('符合'), item('符合'), item('符合')]
    const result = scoreChecklistItems(items)
    expect(result.score).toBe(100)
    expect(result.applicableItems).toBe(3)
  })

  it('excludes 不適用 from denominator', () => {
    const items = [item('符合'), item('不適用'), item('不符')]
    const result = scoreChecklistItems(items)
    expect(result.applicableItems).toBe(2)
    expect(result.score).toBe(50)
  })

  it('applies observation partial score', () => {
    const items = [item('符合'), item('觀察')]
    const result = scoreChecklistItems(items)
    expect(result.score).toBe(75)
  })

  it('returns null when no applicable items', () => {
    const items = [item('不適用'), item(null)]
    const result = scoreChecklistItems(items)
    expect(result.score).toBeNull()
    expect(result.applicableItems).toBe(0)
  })
})

describe('calculateAnnualScore', () => {
  it('aggregates across procedure audits', () => {
    const base = {
      notifyDate: '',
      auditDate: '',
      departmentManager: '',
      auditors: '',
      auditCategory: '系統稽核' as const,
    }
    const audits: ProcedureAudit[] = [
      {
        ...base,
        id: 'a1',
        qpCode: 'QP-15',
        departmentId: 'd1',
        department: '品保部',
        process: 'p',
        documents: 'd',
        items: [item('符合'), item('符合')],
      },
      {
        ...base,
        id: 'a2',
        qpCode: 'QP-09',
        departmentId: 'd2',
        department: '業務部',
        process: 'p',
        documents: 'd',
        items: [item('符合'), item('不符')],
      },
    ]
    const summary = calculateAnnualScore(audits)
    expect(summary.overallScore).toBe(75)
    expect(summary.totalNCR).toBe(1)
    expect(summary.departmentScores).toHaveLength(2)
  })
})
