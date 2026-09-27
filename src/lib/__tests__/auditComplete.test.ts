import { describe, expect, it } from 'vitest'
import { isProcedureComplete } from '../auditComplete'
import { scoreProcedureAudit } from '../scoring'
import type { ChecklistItem, ProcedureAudit } from '../../types'

const baseAudit = (items: ChecklistItem[]): ProcedureAudit => ({
  id: 'audit-1',
  qpCode: 'QP-01',
  departmentId: 'd1',
  department: '管理部',
  process: 'p',
  documents: 'd',
  notifyDate: '',
  auditDate: '',
  departmentManager: '主管',
  auditors: '稽核員',
  auditCategory: '系統稽核',
  items,
})

const item = (
  judgment: ChecklistItem['judgment'],
  objectiveEvidence = '',
): ChecklistItem => ({
  id: Math.random().toString(),
  category: '測試',
  no: 1,
  content: 'test',
  judgment,
  description: '',
  objectiveEvidence,
})

describe('isProcedureComplete', () => {
  it('is false when any item lacks judgment', () => {
    expect(isProcedureComplete(baseAudit([item('符合', 'QR-01'), item(null)]))).toBe(false)
  })

  it('is true when all items judged including 不適用', () => {
    expect(isProcedureComplete(baseAudit([item('符合', 'QR-01'), item('不適用')]))).toBe(true)
  })

  it('is false when conform items lack objective evidence', () => {
    expect(isProcedureComplete(baseAudit([item('符合'), item('符合', 'QR-01')]))).toBe(false)
  })

  it('is true when all conform/不符 items have objective evidence', () => {
    expect(
      isProcedureComplete(baseAudit([item('符合', 'QR-01'), item('不符', 'QR-02')])),
    ).toBe(true)
  })

  it('does not report scored when incomplete', () => {
    const result = scoreProcedureAudit(baseAudit([item('符合', 'QR-01'), item(null)]))
    expect(result.score).toBeNull()
  })

  it('does not score when conform items lack objective evidence', () => {
    const result = scoreProcedureAudit(baseAudit([item('符合'), item('符合', 'QR-01')]))
    expect(result.score).toBeNull()
    expect(result.status).toBe('incomplete')
    expect(isProcedureComplete(baseAudit([item('符合'), item('符合', 'QR-01')]))).toBe(false)
  })
})
