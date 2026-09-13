import { describe, expect, it } from 'vitest'
import {
  describeStakeholderScheduleEffect,
  filterPlanRowsByStakeholder,
  stakeholderTagHint,
} from '../stakeholderSchedule'
import type { PlanRow, StakeholderTag } from '../../types'

describe('describeStakeholderScheduleEffect', () => {
  it('describes early-window tags', () => {
    expect(describeStakeholderScheduleEffect(['客戶', '法規/認證'])).toContain('前段')
    expect(describeStakeholderScheduleEffect(['客戶', '法規/認證'])).toContain('客戶')
  })

  it('describes empty tags', () => {
    expect(describeStakeholderScheduleEffect([])).toContain('尚未設定')
  })

  it('combines priority and early tags', () => {
    const text = describeStakeholderScheduleEffect(['客戶', '經營層'])
    expect(text).toContain('前段')
    expect(text).toContain('優先序')
  })
})

describe('stakeholderTagHint', () => {
  it('includes weight for each tag', () => {
    expect(stakeholderTagHint('客戶')).toContain('10')
    expect(stakeholderTagHint('員工')).toContain('5')
  })
})

describe('filterPlanRowsByStakeholder', () => {
  const departments = [
    { id: 'dept-sales', stakeholders: ['客戶'] as StakeholderTag[] },
    { id: 'dept-admin', stakeholders: ['法規/認證'] as StakeholderTag[] },
  ]

  const rows: PlanRow[] = [
    {
      id: 'plan-QP-01-dept-sales',
      qpCode: 'QP-01',
      departmentId: 'dept-sales',
      sequence: 1,
      riskLevel: '中',
      department: '業務部',
      process: 'p',
      documents: 'd',
      auditUnit: '品保部',
      owner: '主管',
      auditors: '稽核員',
      auditCategory: '系統稽核',
      months: Array(12).fill(null),
      manualOverride: false,
    },
    {
      id: 'plan-QP-02-dept-admin',
      qpCode: 'QP-02',
      departmentId: 'dept-admin',
      sequence: 2,
      riskLevel: '低',
      department: '管理部',
      process: 'p',
      documents: 'd',
      auditUnit: '品保部',
      owner: '主管',
      auditors: '稽核員',
      auditCategory: '系統稽核',
      months: Array(12).fill(null),
      manualOverride: false,
    },
  ]

  it('returns all rows when filter is null', () => {
    expect(filterPlanRowsByStakeholder(rows, null, departments)).toHaveLength(2)
  })

  it('filters rows by department stakeholder tag', () => {
    const filtered = filterPlanRowsByStakeholder(rows, '客戶', departments)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].departmentId).toBe('dept-sales')
  })
})
