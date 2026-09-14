import { describe, it, expect } from 'vitest'
import {
  scoreChecklistItems,
  calculateAnnualScore,
  formatScoreDisplay,
} from '../scoring'
import type { ChecklistItem, PlanRow, ProcedureAudit } from '../../types'

function item(
  judgment: ChecklistItem['judgment'],
  id = Math.random().toString(),
  objectiveEvidence = '',
): ChecklistItem {
  return {
    id,
    category: '測試',
    no: 1,
    content: 'test',
    judgment,
    description: '',
    objectiveEvidence,
  }
}

const basePlanRow = (qpCode: string, departmentId: string, department: string): PlanRow => ({
  id: `plan-${qpCode}-${departmentId}`,
  qpCode,
  departmentId,
  sequence: 1,
  riskLevel: '中',
  department,
  process: 'p',
  documents: 'd',
  auditUnit: '品保部',
  owner: '主管',
  auditors: '王稽核',
  auditCategory: '系統稽核',
  months: Array(12).fill(null).map((_, i) => (i === 2 ? '擬定' : null)) as PlanRow['months'],
  manualOverride: false,
})

describe('scoreChecklistItems', () => {
  it('calculates full score for all conform with evidence', () => {
    const items = [
      item('符合', '1', 'QR-01'),
      item('符合', '2', 'QR-01'),
      item('符合', '3', 'QR-01'),
    ]
    const result = scoreChecklistItems(items)
    expect(result.score).toBe(100)
    expect(result.status).toBe('scored')
    expect(result.applicableItems).toBe(3)
  })

  it('excludes 不適用 from denominator', () => {
    const items = [item('符合', '1', 'QR-01'), item('不適用'), item('不符', '3', 'QR-02')]
    const result = scoreChecklistItems(items)
    expect(result.applicableItems).toBe(2)
    expect(result.score).toBe(50)
  })

  it('applies observation partial score', () => {
    const items = [item('符合', '1', 'QR-01'), item('觀察')]
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

  it('marks not_applicable when all items are N/A', () => {
    const items = [item('不適用'), item('不適用')]
    const result = scoreChecklistItems(items)
    expect(result.score).toBeNull()
    expect(result.status).toBe('not_applicable')
    expect(formatScoreDisplay(result)).toBe('不適用')
  })

  it('marks unevaluated when conform lacks objective evidence', () => {
    const items = [item('符合'), item('符合', '2', 'QR-01')]
    const result = scoreChecklistItems(items)
    expect(result.score).toBeNull()
    expect(result.status).toBe('unevaluated')
  })
})

describe('calculateAnnualScore', () => {
  const base = {
    notifyDate: '',
    auditDate: '',
    departmentManager: '',
    auditors: '',
    auditCategory: '系統稽核' as const,
    process: 'p',
    documents: 'd',
  }

  it('aggregates across procedure audits when all scheduled are scored', () => {
    const planRows = [
      basePlanRow('QP-15', 'd1', '品保部'),
      basePlanRow('QP-09', 'd2', '業務部'),
    ]
    const audits: ProcedureAudit[] = [
      {
        ...base,
        id: 'a1',
        qpCode: 'QP-15',
        departmentId: 'd1',
        department: '品保部',
        items: [item('符合', '1', 'QR-01'), item('符合', '2', 'QR-01')],
      },
      {
        ...base,
        id: 'a2',
        qpCode: 'QP-09',
        departmentId: 'd2',
        department: '業務部',
        items: [item('符合', '3', 'QR-02'), item('不符', '4', 'QR-03')],
      },
    ]
    const summary = calculateAnnualScore(audits, undefined, planRows)
    expect(summary.overallScore).toBe(75)
    expect(summary.overallStatus).toBe('scored')
    expect(summary.allScheduledScored).toBe(true)
    expect(summary.totalNCR).toBe(1)
    expect(summary.departmentScores).toHaveLength(2)
  })

  it('does not report overall scored when scheduled procedures remain unjudged', () => {
    const planRows = [
      basePlanRow('QP-15', 'd1', '品保部'),
      basePlanRow('QP-09', 'd2', '業務部'),
    ]
    const audits: ProcedureAudit[] = [
      {
        ...base,
        id: 'a1',
        qpCode: 'QP-15',
        departmentId: 'd1',
        department: '品保部',
        items: [item('符合', '1', 'QR-01')],
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
    const summary = calculateAnnualScore(audits, undefined, planRows)
    expect(summary.overallScore).toBeNull()
    expect(summary.overallStatus).toBe('unevaluated')
    expect(summary.allScheduledScored).toBe(false)
    expect(summary.scoredProcedures).toBe(1)
    expect(summary.scheduledProcedures).toBe(2)
    expect(summary.departmentScores.find((d) => d.auditId === 'a2')?.status).toBe('unevaluated')
  })

  it('returns unevaluated overall when no scored audits', () => {
    const planRows = [basePlanRow('QP-01', 'd1', '管理部')]
    const summary = calculateAnnualScore(
      [
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
      ],
      undefined,
      planRows,
    )
    expect(summary.overallScore).toBeNull()
    expect(summary.overallStatus).toBe('unevaluated')
  })
})
