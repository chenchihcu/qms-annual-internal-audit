import { describe, expect, it } from 'vitest'
import type { ProcedureRiskRecord } from '../../types'
import { RISK_FACTOR_KEYS } from '../risk'
import type { DerivedRiskFactors } from '../riskDerivation'
import { buildWorkingValues } from '../riskWorkingValues'

function derived(complaint: number | undefined): DerivedRiskFactors {
  const result = {} as DerivedRiskFactors
  for (const key of RISK_FACTOR_KEYS) result[key] = { status: 'no_data', sources: [], note: '' }
  result.inherentRisk = { status: 'derived', suggested: 3, sources: [], note: '' }
  result.customerComplaintLevel = complaint == null
    ? { status: 'no_data', sources: [], note: '' }
    : { status: 'derived', suggested: complaint, sources: [], note: '' }
  return result
}

/** 未登錄視為 0 件前：系統無值，使用者手填 0 件（分級 1）並選理由。 */
const legacyManualZero: ProcedureRiskRecord = {
  id: 'r1',
  qpCode: 'QP-01',
  departmentId: 'dept-qa',
  inherentRisk: 3,
  customerComplaintLevel: 1,
  evidenceReference: '',
  updatedAt: 'x',
  assessmentYear: 2026,
  status: 'approved',
  manualFactors: ['customerComplaintLevel'],
  overrides: [{ factor: 'customerComplaintLevel', value: 1, reason: '查無客訴', at: 'x' }],
}

describe('buildWorkingValues manual overrides', () => {
  it('treats a manual value equal to the current system value as automatic', () => {
    const working = buildWorkingValues(legacyManualZero, derived(1))
    expect(working.values.customerComplaintLevel).toBe(1)
    expect(working.manual).not.toContain('customerComplaintLevel')
  })

  it('lets a later registration replace an old manual zero instead of staying overridden', () => {
    const working = buildWorkingValues(legacyManualZero, derived(2))
    expect(working.values.customerComplaintLevel).toBe(2)
    expect(working.manual).not.toContain('customerComplaintLevel')
  })

  it('keeps a manual value while the system value is unchanged since the override', () => {
    const record: ProcedureRiskRecord = {
      ...legacyManualZero,
      customerComplaintLevel: 3,
      overrides: [{ factor: 'customerComplaintLevel', suggested: 2, value: 3, reason: '調查結論', at: 'x' }],
    }
    const working = buildWorkingValues(record, derived(2))
    expect(working.values.customerComplaintLevel).toBe(3)
    expect(working.manual).toContain('customerComplaintLevel')
  })

  it('keeps a manual value when the system still has no value', () => {
    const working = buildWorkingValues(legacyManualZero, derived(undefined))
    expect(working.values.customerComplaintLevel).toBe(1)
    expect(working.manual).toContain('customerComplaintLevel')
  })
})
