import { describe, it, expect } from 'vitest'
import {
  ATTENTION_SCORE_THRESHOLD,
  buildProcedureAttentionRows,
  filterAttentionRows,
  isNeedsAttention,
  sortAttentionRows,
} from '../dashboardAttention'
import type { ChecklistItem, PlanRow, ProcedureAudit } from '../../types'

function item(judgment: ChecklistItem['judgment']): ChecklistItem {
  return { id: Math.random().toString(), category: '測試', no: 1, content: 'test', judgment, description: '' }
}

function planRow(overrides: Partial<PlanRow> & Pick<PlanRow, 'qpCode' | 'department'>): PlanRow {
  const { qpCode, department, ...rest } = overrides
  return {
    id: `plan-${qpCode}`,
    qpCode,
    departmentId: 'dept-qa',
    sequence: 1,
    riskLevel: '低',
    department,
    process: 'p',
    documents: qpCode,
    auditUnit: '品保部',
    owner: '主管',
    auditors: '稽核員',
    auditCategory: '系統稽核',
    months: Array.from({ length: 12 }, () => null),
    manualOverride: false,
    ...rest,
  }
}

function audit(overrides: Partial<ProcedureAudit> & Pick<ProcedureAudit, 'qpCode' | 'department'>): ProcedureAudit {
  const { qpCode, department, ...rest } = overrides
  return {
    id: `audit-${qpCode}`,
    qpCode,
    departmentId: 'dept-qa',
    department,
    process: 'p',
    documents: qpCode,
    notifyDate: '',
    auditDate: '',
    departmentManager: '',
    auditors: '',
    auditCategory: '系統稽核',
    items: [],
    ...rest,
  }
}

describe('buildProcedureAttentionRows', () => {
  it('joins focus rows with matching audits and scoring', () => {
    const rows = buildProcedureAttentionRows(
      [planRow({ qpCode: 'QP-16', department: '品保部', riskLevel: '中' })],
      [
        audit({
          qpCode: 'QP-16',
          department: '品保部',
          status: '執行中',
          items: [item('符合'), item('不符')],
        }),
      ],
    )

    const matched = rows.find((row) => row.qpCode === 'QP-16' && row.department === '品保部')
    expect(matched).toBeTruthy()
    expect(matched?.auditId).toBe('audit-QP-16')
    expect(matched?.status).toBe('執行中')
    expect(matched?.score).toBe(50)
    expect(matched?.judgedCount).toBe(2)
    expect(matched?.totalItems).toBe(2)
  })

  it('defaults missing audits to 規劃中 with null score', () => {
    const rows = buildProcedureAttentionRows(
      [planRow({ qpCode: 'QP-01', department: '管理部' })],
      [],
    )

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.status).toBe('規劃中')
      expect(row.score).toBeNull()
      expect(row.judgedCount).toBe(0)
    }
  })
})

describe('isNeedsAttention', () => {
  it('flags high/medium risk, low scores, in-progress, and process/config audits', () => {
    expect(isNeedsAttention({
      sheet: '01',
      qpCode: 'QP-01',
      department: '品保部',
      owner: 'a',
      riskLevel: '高',
      auditCategory: '系統稽核',
      status: '規劃中',
      score: null,
      judgedCount: 0,
      totalItems: 3,
    })).toBe(true)

    expect(isNeedsAttention({
      sheet: '02',
      qpCode: 'QP-02',
      department: '品保部',
      owner: 'a',
      riskLevel: '低',
      auditCategory: '系統稽核',
      status: '已回報',
      score: 70,
      judgedCount: 8,
      totalItems: 8,
    })).toBe(true)

    expect(isNeedsAttention({
      sheet: '03',
      qpCode: 'QP-03',
      department: '品保部',
      owner: 'a',
      riskLevel: '低',
      auditCategory: '系統稽核',
      status: '執行中',
      score: null,
      judgedCount: 0,
      totalItems: 2,
    })).toBe(true)

    expect(isNeedsAttention({
      sheet: 'QR-28-04',
      qpCode: 'QR-28-04',
      department: '生產製造部',
      owner: 'a',
      riskLevel: '低',
      auditCategory: '製程稽核',
      status: '規劃中',
      score: null,
      judgedCount: 0,
      totalItems: 18,
    })).toBe(true)
  })

  it('excludes reported high-score low-risk system audits', () => {
    expect(isNeedsAttention({
      sheet: '04',
      qpCode: 'QP-04',
      department: '管理部',
      owner: 'a',
      riskLevel: '低',
      auditCategory: '系統稽核',
      status: '已回報',
      score: 95,
      judgedCount: 4,
      totalItems: 4,
    })).toBe(false)
  })
})

describe('filterAttentionRows', () => {
  const rows = [
    {
      sheet: '01',
      qpCode: 'QP-01',
      department: '品保部',
      owner: 'a',
      riskLevel: '低' as const,
      auditCategory: '系統稽核' as const,
      status: '已回報' as const,
      score: 95,
      judgedCount: 3,
      totalItems: 3,
    },
    {
      sheet: '02',
      qpCode: 'QP-02',
      department: '生產製造部',
      owner: 'b',
      riskLevel: '中' as const,
      auditCategory: '系統稽核' as const,
      status: '規劃中' as const,
      score: null,
      judgedCount: 0,
      totalItems: 4,
    },
  ]

  it('filters scored rows only', () => {
    expect(filterAttentionRows(rows, 'scored')).toHaveLength(1)
    expect(filterAttentionRows(rows, 'scored')[0]?.qpCode).toBe('QP-01')
  })

  it('filters high/medium risk rows', () => {
    expect(filterAttentionRows(rows, 'highMediumRisk')).toHaveLength(1)
    expect(filterAttentionRows(rows, 'highMediumRisk')[0]?.qpCode).toBe('QP-02')
  })
})

describe('sortAttentionRows', () => {
  it('sorts by risk then score then qpCode', () => {
    const sorted = sortAttentionRows([
      {
        sheet: '03',
        qpCode: 'QP-03',
        department: '品保部',
        owner: 'a',
        riskLevel: '低',
        auditCategory: '系統稽核',
        status: '規劃中',
        score: 90,
        judgedCount: 2,
        totalItems: 2,
      },
      {
        sheet: '01',
        qpCode: 'QP-01',
        department: '品保部',
        owner: 'a',
        riskLevel: '高',
        auditCategory: '系統稽核',
        status: '規劃中',
        score: null,
        judgedCount: 0,
        totalItems: 2,
      },
      {
        sheet: '02',
        qpCode: 'QP-02',
        department: '品保部',
        owner: 'a',
        riskLevel: '低',
        auditCategory: '系統稽核',
        status: '規劃中',
        score: 60,
        judgedCount: 2,
        totalItems: 2,
      },
    ])

    expect(sorted.map((row) => row.qpCode)).toEqual(['QP-01', 'QP-02', 'QP-03'])
  })
})

describe('ATTENTION_SCORE_THRESHOLD', () => {
  it('uses 80 as the low-score cutoff', () => {
    expect(ATTENTION_SCORE_THRESHOLD).toBe(80)
  })
})
