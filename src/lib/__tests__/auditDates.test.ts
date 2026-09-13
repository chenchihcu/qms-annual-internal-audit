import { describe, expect, it } from 'vitest'
import { carryPlanDatesToAudit } from '../auditDates'
import type { PlanRow, ProcedureAudit } from '../../types'

const row: PlanRow = {
  id: 'plan-QP-05-dept-qa',
  qpCode: 'QP-05',
  departmentId: 'dept-qa',
  sequence: 1,
  riskLevel: '中',
  department: '品保部',
  process: '量測儀器及設備管理程序',
  documents: 'QP-05',
  auditUnit: '品保部',
  owner: '陳智富',
  auditors: '王稽核',
  auditCategory: '系統稽核',
  months: Array(12).fill(null).map((_, i) => (i === 2 ? '擬定' : null)) as PlanRow['months'],
  manualOverride: false,
}

const emptyAudit: ProcedureAudit = {
  id: 'audit-QP-05-dept-qa',
  qpCode: 'QP-05',
  departmentId: 'dept-qa',
  department: '品保部',
  process: '量測儀器及設備管理程序',
  documents: 'QP-05',
  notifyDate: '',
  auditDate: '',
  departmentManager: '品保部經理',
  auditors: '王稽核',
  auditCategory: '系統稽核',
  items: [],
}

describe('carryPlanDatesToAudit', () => {
  it('fills notify and audit dates from first scheduled month when empty', () => {
    const carried = carryPlanDatesToAudit(row, emptyAudit, 2026)
    expect(carried.plannedMonth).toBe(3)
    expect(carried.notifyDate).toBe('2026-03-01')
    expect(carried.auditDate).toBe('2026-03-15')
  })

  it('does not overwrite existing header dates', () => {
    const carried = carryPlanDatesToAudit(
      row,
      { ...emptyAudit, notifyDate: '2026-04-01', auditDate: '2026-04-20', plannedMonth: 4 },
      2026,
    )
    expect(carried.notifyDate).toBe('2026-04-01')
    expect(carried.auditDate).toBe('2026-04-20')
    expect(carried.plannedMonth).toBe(4)
  })
})
