import { describe, it, expect } from 'vitest'
import {
  scoreChecklistItems,
  calculateAnnualScore,
  formatScoreDisplay,
  isChecklistItemPending,
} from '../scoring'
import type { ChecklistItem, ProcedureAudit } from '../../types'

function item(
  judgment: ChecklistItem['judgment'],
  description = '',
  id = Math.random().toString(),
): ChecklistItem {
  return { id, category: '測試', no: 1, content: 'test', judgment, description }
}

describe('isChecklistItemPending', () => {
  it('treats 不適用 without description as pending', () => {
    expect(isChecklistItemPending(item('不適用', ''))).toBe(true)
    expect(isChecklistItemPending(item('不適用', '本證書無此客戶'))).toBe(false)
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
    const items = [item('符合'), item('不適用', '不適用原因'), item('不符')]
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
    expect(formatScoreDisplay(result)).toBe('未評')
  })

  it('marks incomplete when partial judgments remain', () => {
    const items = [item('符合'), item(null)]
    const result = scoreChecklistItems(items)
    expect(result.status).toBe('incomplete')
    expect(formatScoreDisplay(result)).toBe('未完成')
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
    expect(formatScoreDisplay(result)).toBe('不適用')
  })

  it('counts dual items as two scoring units', () => {
    const dual: ChecklistItem = {
      id: 'dual-1',
      category: '雙證',
      no: 4,
      content: '雙證',
      judgment: null,
      description: '',
      certificateScope: 'dual',
      judgmentByCompany: { jiurun: '符合', zhenglongxing: '符合' },
    }
    const result = scoreChecklistItems([dual])
    expect(result.applicableItems).toBe(2)
    expect(result.score).toBe(100)
  })

  it('scores judged dual side while other side remains pending', () => {
    const dual: ChecklistItem = {
      id: 'dual-partial',
      category: '雙證',
      no: 4,
      content: '雙證',
      judgment: null,
      description: '',
      certificateScope: 'dual',
      judgmentByCompany: { jiurun: '符合', zhenglongxing: null },
    }
    const result = scoreChecklistItems([dual])
    expect(result.breakdown.pending).toBe(1)
    expect(result.applicableItems).toBe(1)
    expect(result.status).toBe('incomplete')
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
    expect(summary.overallStatus).toBe('scored')
    expect(summary.totalNCR).toBe(1)
    expect(summary.departmentScores).toHaveLength(2)
  })

  it('excludes unevaluated audits from overall score', () => {
    const base = {
      notifyDate: '',
      auditDate: '',
      departmentManager: '',
      auditors: '',
      auditCategory: '系統稽核' as const,
      process: 'p',
      documents: 'd',
    }
    const audits: ProcedureAudit[] = [
      {
        ...base,
        id: 'a1',
        qpCode: 'QP-15',
        departmentId: 'd1',
        department: '品保部',
        items: [item('符合')],
      },
      {
        ...base,
        id: 'a2',
        qpCode: 'QP-09',
        departmentId: 'd2',
        department: '業務部',
        items: [item(null)],
      },
    ]
    const summary = calculateAnnualScore(audits)
    expect(summary.overallScore).toBe(100)
    expect(summary.departmentScores.find((d) => d.auditId === 'a2')?.status).toBe('unevaluated')
  })

  it('marks overall incomplete when any audit is incomplete', () => {
    const summary = calculateAnnualScore([
      {
        id: 'a1',
        qpCode: 'QP-01',
        departmentId: 'd1',
        department: '管理部',
        process: 'p',
        documents: 'd',
        notifyDate: '',
        auditDate: '',
        departmentManager: '',
        auditors: '',
        auditCategory: '系統稽核',
        items: [item('符合'), item(null)],
      },
    ])
    expect(summary.overallStatus).toBe('incomplete')
  })

  it('returns unevaluated overall when no scored audits', () => {
    const summary = calculateAnnualScore([
      {
        id: 'a1',
        qpCode: 'QP-01',
        departmentId: 'd1',
        department: '管理部',
        process: 'p',
        documents: 'd',
        notifyDate: '',
        auditDate: '',
        departmentManager: '',
        auditors: '',
        auditCategory: '系統稽核',
        items: [item(null)],
      },
    ])
    expect(summary.overallScore).toBeNull()
    expect(summary.overallStatus).toBe('unevaluated')
  })
})
