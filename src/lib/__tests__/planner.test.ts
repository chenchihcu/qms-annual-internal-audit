import { describe, it, expect } from 'vitest'
import {
  annualAuditFrequencyForLevel,
  autoArrangePlan,
  calculateDepartmentPriority,
  cycleMonthStatus,
  describeArrangementImpact,
  osBandToScale,
  scaleToOsBand,
  STAKEHOLDER_WEIGHTS,
} from '../planner'
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

describe('scaleToOsBand / osBandToScale', () => {
  it('maps stored scale to nearest band for display', () => {
    expect(scaleToOsBand(1)).toBe('low')
    expect(scaleToOsBand(2)).toBe('low')
    expect(scaleToOsBand(3)).toBe('mid')
    expect(scaleToOsBand(4)).toBe('high')
    expect(scaleToOsBand(5)).toBe('high')
  })

  it('writes canonical 1/3/5 when user picks a band', () => {
    expect(osBandToScale('low')).toBe(1)
    expect(osBandToScale('mid')).toBe(3)
    expect(osBandToScale('high')).toBe(5)
  })
})

describe('describeArrangementImpact', () => {
  it('explains sort, frequency, and timing for high customer-facing departments', () => {
    const impact = describeArrangementImpact(
      baseDept({
        stakeholders: ['客戶', '法規/認證'],
        riskOccurrence: 5,
        riskSeverity: 5,
      }),
      '高',
    )
    expect(impact.summary).toMatch(/本部門 QP · 優先 \d+ · 年約 3 次 · 偏早/)
    expect(impact.sortLine).toMatch(/QP 排序：優先分數/)
    expect(impact.frequencyLine).toMatch(/年次數：約 3 次/)
    expect(impact.timingLine).toMatch(/偏計畫窗口前半/)
  })

  it('uses balanced timing for low-risk departments without customer/reg tags', () => {
    const impact = describeArrangementImpact(
      baseDept({
        stakeholders: ['員工'],
        riskOccurrence: 1,
        riskSeverity: 1,
      }),
      '低',
    )
    expect(annualAuditFrequencyForLevel('低')).toBe(1)
    expect(impact.summary).toMatch(/年約 1 次 · 均衡/)
    expect(impact.timingLine).toMatch(/均衡分散/)
  })
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
    expect(cycleMonthStatus('擬定')).toBe(null)
    expect(cycleMonthStatus('滿意')).toBe(null)
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

  it('uses procedureRisks priority when provided', () => {
    const departments = [
      baseDept({ id: 'a', riskOccurrence: 1, riskSeverity: 1 }),
      baseDept({ id: 'b', riskOccurrence: 1, riskSeverity: 1 }),
    ]
    const entries = [
      { qpCode: 'QP-A', departmentId: 'a', departmentName: '管理部', process: 'A', documents: 'QP-A', auditCategory: '系統稽核' as const, owner: '主管' },
      { qpCode: 'QP-B', departmentId: 'b', departmentName: '生產部', process: 'B', documents: 'QP-B', auditCategory: '系統稽核' as const, owner: '主管' },
    ]
    const rows = autoArrangePlan({
      departments,
      planEntries: entries,
      auditYear: 2026,
      planWindowStart: '2026-02-01',
      planWindowEnd: '2026-11-30',
      procedureRisks: [{
        id: 'risk-low',
        qpCode: 'QP-A',
        departmentId: 'a',
        inherentRisk: 5,
        previousInternalNcrCount: 5,
        previousThirdPartyNcrCount: 5,
        overdueOpenNcrCount: 5,
        customerComplaintLevel: 5,
        changeImpact: 5,
        monthsSinceLastAudit: 5,
        evidenceReference: 'test',
        updatedAt: '2026-01-01',
      }],
    })
    expect(rows[0].qpCode).toBe('QP-A')
    expect(rows[0].riskLevel).toBe('高')
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
})
