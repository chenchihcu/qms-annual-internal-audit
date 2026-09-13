import { describe, expect, it } from 'vitest'
import { deriveMonthStatus, getDisplayMonthStatus } from '../planStatus'
import type { ChecklistItem, NCR, PlanRow, ProcedureAudit } from '../../types'

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
  months: Array(12).fill(null).map((_, i) => (i === 2 ? '擬定' : null)) as PlanRow['months'],
  manualOverride: false,
  ...overrides,
})

const item = (judgment: ChecklistItem['judgment']): ChecklistItem => ({
  id: 'chk-1',
  category: '測試',
  no: 1,
  content: '項目',
  judgment,
  description: '',
})

const baseAudit = (items: ChecklistItem[], partial: Partial<ProcedureAudit> = {}): ProcedureAudit => ({
  id: 'audit-QP-16-dept-qa',
  qpCode: 'QP-16',
  departmentId: 'dept-qa',
  department: '品保部',
  process: '製程/最終檢驗',
  documents: 'QP-16',
  notifyDate: '2026-03-01',
  auditDate: '2026-03-15',
  plannedMonth: 3,
  departmentManager: '品保部經理',
  auditors: '王稽核',
  auditCategory: '系統稽核',
  items,
  ...partial,
})

const baseNcr = (partial: Partial<NCR> = {}): NCR => ({
  id: 'ncr-1',
  ncrNumber: 'NCR-2026-001',
  qpCode: 'QP-16',
  departmentId: 'dept-qa',
  department: '品保部',
  process: '製程/最終檢驗',
  description: '不合格品隔離區標示不完整',
  date: '2026-03-15',
  status: '矯正中',
  rootCause: '原因',
  correctiveAction: '措施',
  verificationEvidence: '',
  ...partial,
})

describe('deriveMonthStatus', () => {
  it('returns null for unscheduled month', () => {
    expect(deriveMonthStatus(baseRow(), 0, [], [], 2026)).toBeNull()
  })

  it('returns 擬定 when scheduled but audit incomplete', () => {
    expect(deriveMonthStatus(baseRow(), 2, [baseAudit([item(null)])], [], 2026)).toBe('擬定')
  })

  it('returns 滿意 when complete with all conform and no NCR', () => {
    expect(deriveMonthStatus(baseRow(), 2, [baseAudit([item('符合')])], [], 2026)).toBe('滿意')
  })

  it('returns 矯正中 when complete with open NCR', () => {
    expect(
      deriveMonthStatus(
        baseRow(),
        2,
        [baseAudit([item('不符')])],
        [baseNcr({ status: '矯正中' })],
        2026,
      ),
    ).toBe('矯正中')
  })

  it('returns 矯正圓滿 when all NCRs closed with verification', () => {
    expect(
      deriveMonthStatus(
        baseRow(),
        2,
        [baseAudit([item('不符')])],
        [
          baseNcr({
            status: '結案',
            verificationEvidence: '複查合格',
          }),
        ],
        2026,
      ),
    ).toBe('矯正圓滿')
  })

  it('returns 不滿意 when complete with 不符 but no NCR yet', () => {
    expect(deriveMonthStatus(baseRow(), 2, [baseAudit([item('不符')])], [], 2026)).toBe('不滿意')
  })

  it('applies derived status to all scheduled months when complete', () => {
    const row = baseRow({
      months: Array(12)
        .fill(null)
        .map((_, i) => (i <= 2 ? '擬定' : null)) as PlanRow['months'],
    })
    const audit = baseAudit([item('符合')], { plannedMonth: 1, auditDate: '2026-01-15' })

    for (const monthIndex of [0, 1, 2]) {
      expect(deriveMonthStatus(row, monthIndex, [audit], [], 2026)).toBe('滿意')
    }
  })

  it('returns 矯正圓滿 when all NCRs closed even when checklist incomplete', () => {
    expect(
      deriveMonthStatus(
        baseRow(),
        2,
        [baseAudit([item(null)])],
        [
          baseNcr({
            status: '結案',
            rootCause: '原因',
            correctiveAction: '措施',
            verificationEvidence: '複查合格',
          }),
        ],
        2026,
      ),
    ).toBe('矯正圓滿')
  })

  it('returns 矯正中 on scheduled months with open NCR even when checklist incomplete', () => {
    const row = baseRow({
      months: Array(12)
        .fill(null)
        .map((_, i) => (i === 2 ? '擬定' : null)) as PlanRow['months'],
    })

    expect(
      deriveMonthStatus(
        row,
        2,
        [baseAudit([item(null)])],
        [baseNcr({ status: '矯正中' })],
        2026,
      ),
    ).toBe('矯正中')
  })
})

describe('getDisplayMonthStatus', () => {
  it('prefers manual override over derived status', () => {
    const row = baseRow({
      manualMonthOverrides: Array(12).fill(null).map((_, i) => (i === 2 ? '滿意' : null)),
    })
    expect(getDisplayMonthStatus(row, 2, [], [], 2026)).toBe('滿意')
  })
})
