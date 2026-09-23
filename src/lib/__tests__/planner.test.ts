import { describe, it, expect } from 'vitest'
import {
  autoArrangePlan,
  buildAuditFocusOverview,
  calculateDepartmentPriority,
  cycleMonthStatus,
  getWindowMonths,
  STAKEHOLDER_WEIGHTS,
} from '../planner'
import { createDemoState } from '../../data/demoData'
import type { DepartmentProfile } from '../../types'
import type { MonthStatus, PlanRow } from '../../types'

const baseDept = (overrides: Partial<DepartmentProfile> = {}): DepartmentProfile => ({
  id: 'd1',
  name: '品保部',
  owner: '品保經理',
  auditUnit: '品保部',
  defaultAuditors: '稽核員A',
  stakeholders: ['客戶'],
  riskOccurrence: 3,
  riskSeverity: 4,
  ...overrides,
})

describe('calculateDepartmentPriority', () => {
  it('weights 客戶 and 法規/認證 highest', () => {
    const high = calculateDepartmentPriority(
      baseDept({ stakeholders: ['客戶', '法規/認證'] }),
    )
    const low = calculateDepartmentPriority(
      baseDept({ stakeholders: ['員工'], riskOccurrence: 1, riskSeverity: 1 }),
    )
    expect(high).toBeGreaterThan(low)
    expect(STAKEHOLDER_WEIGHTS['客戶']).toBe(10)
  })
})

describe('cycleMonthStatus', () => {
  it('cycles through legend states', () => {
    expect(cycleMonthStatus(null)).toBe('擬定')
    expect(cycleMonthStatus('擬定')).toBe('滿意')
    expect(cycleMonthStatus('矯正圓滿')).toBe(null)
  })
})

describe('autoArrangePlan', () => {
  it('schedules high-risk departments earlier and more frequently', () => {
    const departments: DepartmentProfile[] = [
      baseDept({
        id: 'high',
        name: '生產製造部',
        riskOccurrence: 5,
        riskSeverity: 5,
        stakeholders: ['客戶', '法規/認證'],
      }),
      baseDept({
        id: 'low',
        name: '管理部',
        riskOccurrence: 1,
        riskSeverity: 2,
        stakeholders: ['員工'],
      }),
    ]

    const entries = [
      { qpCode: 'QP-20', departmentId: 'high', departmentName: '生產製造部', process: '生產', documents: 'QP-20', auditCategory: '製程稽核' as const, owner: '主管' },
      { qpCode: 'QP-21', departmentId: 'high', departmentName: '生產製造部', process: '特殊製程', documents: 'QP-21', auditCategory: '製程稽核' as const, owner: '主管' },
      { qpCode: 'QP-28', departmentId: 'low', departmentName: '管理部', process: '內部稽核', documents: 'QP-28', auditCategory: '系統稽核' as const, owner: '主管' },
    ]

    const rows = autoArrangePlan({
      departments,
      planEntries: entries,
      auditYear: 2026,
      planWindowStart: '2026-02-01',
      planWindowEnd: '2026-11-30',
      managementReviewDate: '2026-12-10',
    })

    const highRows = rows.filter((r) => r.departmentId === 'high')
    const lowRows = rows.filter((r) => r.departmentId === 'low')

    const highCount = highRows.reduce((s, r) => s + r.months.filter(Boolean).length, 0)
    const lowCount = lowRows.reduce((s, r) => s + r.months.filter(Boolean).length, 0)
    expect(highCount).toBeGreaterThanOrEqual(lowCount)
    expect(highRows[0]?.riskLevel).toBe('高')
  })

  it('respects manual override rows', () => {
    const departments = [baseDept()]
    const existing: PlanRow[] = [
      {
        id: 'plan-QP-15-d1',
        qpCode: 'QP-15',
        departmentId: 'd1',
        sequence: 1,
        riskLevel: '中',
        department: '品保部',
        process: '進料檢驗',
        documents: 'QP-15',
        auditUnit: '品保部',
        owner: '品保經理',
        auditors: '自訂',
        auditCategory: '系統稽核',
        months: ['擬定', null, null, null, null, null, null, null, null, null, null, null] as MonthStatus[],
        manualOverride: true,
      },
    ]

    const rows = autoArrangePlan({
      departments,
      planEntries: [{ qpCode: 'QP-15', departmentId: 'd1', departmentName: '品保部', process: '進料', documents: 'QP-15', auditCategory: '系統稽核', owner: '主管' }],
      auditYear: 2026,
      planWindowStart: '2026-02-01',
      planWindowEnd: '2026-11-30',
      existingRows: [...existing],
    })

    expect(rows[0].manualOverride).toBe(true)
    expect(rows[0].months[0]).toBe('擬定')
    expect(rows[0].auditors).toBe('自訂')
  })

  it('leaves buffer before management review month', () => {
    const departments = [baseDept()]
    const rows = autoArrangePlan({
      departments,
      planEntries: [{ qpCode: 'QP-15', departmentId: 'd1', departmentName: '品保部', process: '進料', documents: 'QP-15', auditCategory: '系統稽核', owner: '主管' }],
      auditYear: 2026,
      planWindowStart: '2026-01-01',
      planWindowEnd: '2026-12-31',
      managementReviewDate: '2026-12-10',
    })
    const scheduled = rows[0].months
      .map((v, i) => (v ? i + 1 : null))
      .filter((m): m is number => m !== null)
    expect(scheduled.every((m) => m <= 11)).toBe(true)
  })

  it('uses earlier of management review and external audit for window end', () => {
    const months = getWindowMonths(
      2026,
      '2026-01-01',
      '2026-12-31',
      '2026-12-10',
      '2026-09-15',
    )
    expect(months.every((m) => m <= 8)).toBe(true)
    expect(months.length).toBeGreaterThan(0)
  })

  it('ignores external audit dates outside audit year', () => {
    const months = getWindowMonths(
      2026,
      '2026-01-01',
      '2026-12-31',
      undefined,
      '2027-03-15',
    )
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('prefers department owner over seed entry owner when arranging', () => {
    const departments = [
      baseDept({ owner: '部門主管甲' }),
    ]
    const rows = autoArrangePlan({
      departments,
      planEntries: [
        {
          qpCode: 'QP-15',
          departmentId: 'd1',
          departmentName: '品保部',
          process: '進料',
          documents: 'QP-15',
          auditCategory: '系統稽核',
          owner: '種子人名乙',
        },
      ],
      auditYear: 2026,
      planWindowStart: '2026-02-01',
      planWindowEnd: '2026-11-30',
    })
    expect(rows[0].owner).toBe('部門主管甲')
  })
})

describe('buildAuditFocusOverview', () => {
  it('uses plan row owner instead of seed legend when available', () => {
    const state = createDemoState()
    const planRow = state.company.planRows.find((r) => r.qpCode === 'QP-01')
    if (!planRow) return
    planRow.owner = '計畫列負責人'
    const focus = buildAuditFocusOverview(state.company.planRows)
    const match = focus.find((f) => f.qpCode === planRow.qpCode && f.department === planRow.department)
    expect(match?.owner).toBe('計畫列負責人')
  })
})
