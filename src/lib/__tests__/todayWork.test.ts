import { describe, expect, it } from 'vitest'
import { buildTodayWork } from '../todayWork'
import type { ChecklistItem, CompanyData, NCR, PlanRow, ProcedureAudit } from '../../types'

const item = (judgment: ChecklistItem['judgment']): ChecklistItem => ({
  id: 'chk-1',
  category: '測試',
  no: 1,
  content: '項目',
  judgment,
  description: '',
})

const baseRow = (overrides: Partial<PlanRow> = {}): PlanRow => ({
  id: 'plan-QP-16-dept-qa',
  qpCode: 'QP-16',
  departmentId: 'dept-qa',
  sequence: 1,
  riskLevel: '中',
  department: '品保部',
  process: '製程/最終檢驗',
  documents: 'QP-16',
  auditUnit: '品保部',
  owner: '品保部經理',
  auditors: '王稽核',
  auditCategory: '系統稽核',
  months: Array(12).fill(null).map((_, i) => (i === 8 ? '擬定' : null)) as PlanRow['months'],
  manualOverride: false,
  ...overrides,
})

const baseAudit = (items: ChecklistItem[]): ProcedureAudit => ({
  id: 'audit-QP-16-dept-qa',
  qpCode: 'QP-16',
  departmentId: 'dept-qa',
  department: '品保部',
  process: '製程/最終檢驗',
  documents: 'QP-16',
  notifyDate: '2026-09-01',
  auditDate: '2026-09-15',
  plannedMonth: 9,
  departmentManager: '品保部經理',
  auditors: '王稽核',
  auditCategory: '系統稽核',
  items,
})

const baseNcr = (partial: Partial<NCR> = {}): NCR => ({
  id: 'ncr-1',
  ncrNumber: 'NCR-2026-001',
  qpCode: 'QP-16',
  departmentId: 'dept-qa',
  department: '品保部',
  process: '製程/最終檢驗',
  description: '不合格品隔離區標示不完整',
  date: '2026-09-15',
  status: '矯正中',
  rootCause: '',
  correctiveAction: '',
  verificationEvidence: '',
  ...partial,
})

const company = (partial: Partial<CompanyData>): CompanyData => ({
  name: '九潤精密',
  departments: [],
  planRows: [],
  audits: [],
  ncrs: [],
  observations: [],
  suggestions: [],
  ...partial,
})

describe('buildTodayWork', () => {
  it('lists scheduled procedures in current month that are not 滿意/矯正圓滿', () => {
    const summary = buildTodayWork(
      company({
        planRows: [baseRow()],
        audits: [baseAudit([item(null)])],
        ncrs: [],
      }),
      2026,
      new Date('2026-09-13'),
    )

    expect(summary.month).toBe(9)
    expect(summary.procedures).toHaveLength(1)
    expect(summary.procedures[0].qpCode).toBe('QP-16')
    expect(summary.procedures[0].status).toBe('擬定')
  })

  it('excludes 矯正圓滿 procedures even when checklist incomplete', () => {
    const summary = buildTodayWork(
      company({
        planRows: [baseRow()],
        audits: [baseAudit([item(null)])],
        ncrs: [
          baseNcr({
            status: '結案',
            rootCause: '原因',
            correctiveAction: '措施',
            verificationEvidence: '複查合格',
          }),
        ],
      }),
      2026,
      new Date('2026-09-13'),
    )

    expect(summary.procedures).toHaveLength(0)
  })

  it('includes open NCRs with dueDate only when set', () => {
    const summary = buildTodayWork(
      company({
        ncrs: [
          baseNcr({ id: 'ncr-a', ncrNumber: 'NCR-2026-001', dueDate: '2026-09-30' }),
          baseNcr({ id: 'ncr-b', ncrNumber: 'NCR-2026-002', qpCode: 'QP-05' }),
        ],
      }),
      2026,
      new Date('2026-09-13'),
    )

    expect(summary.openNcrs).toHaveLength(2)
    expect(summary.openNcrs[0].dueDate).toBe('2026-09-30')
    expect(summary.openNcrs[1].dueDate).toBeUndefined()
  })
})
