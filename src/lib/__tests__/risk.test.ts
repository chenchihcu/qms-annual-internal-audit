import { describe, it, expect } from 'vitest'
import {
  calculateRiskLevel,
  calculateRiskIndex,
  suggestRiskBump,
  clampRiskValue,
  calculateProcedurePriority,
  buildEffectiveProcedureRisks,
} from '../risk'
import type { CompanyData } from '../../types'

describe('calculateRiskLevel', () => {
  it('returns 低 for index 1-4', () => {
    expect(calculateRiskLevel(1, 2)).toEqual({ index: 2, level: '低' })
    expect(calculateRiskLevel(2, 2)).toEqual({ index: 4, level: '低' })
  })

  it('returns 中 for index 5-14', () => {
    expect(calculateRiskLevel(2, 3)).toEqual({ index: 6, level: '中' })
    expect(calculateRiskLevel(3, 4)).toEqual({ index: 12, level: '中' })
  })

  it('returns 高 for index 15-25', () => {
    expect(calculateRiskLevel(3, 5)).toEqual({ index: 15, level: '高' })
    expect(calculateRiskLevel(5, 5)).toEqual({ index: 25, level: '高' })
  })
})

describe('calculateProcedurePriority', () => {
  it('marks missing evidence factors as provisional', () => {
    const result = calculateProcedurePriority({ inherentRisk: 5 })
    expect(result.provisional).toBe(true)
    expect(result.missingFactors).toContain('客戶抱怨')
  })

  it('calculates a complete high-priority result', () => {
    const result = calculateProcedurePriority({ inherentRisk: 5, previousInternalNcrCount: 5, previousThirdPartyNcrCount: 5, overdueOpenNcrCount: 4, customerComplaintLevel: 5, changeImpact: 4, monthsSinceLastAudit: 4 })
    expect(result.provisional).toBe(false)
    expect(result.level).toBe('高')
  })

  it('tracks prior third-party NCR independently from internal audit NCR', () => {
    const baseline = { inherentRisk: 3, previousInternalNcrCount: 1, previousThirdPartyNcrCount: 1, overdueOpenNcrCount: 1, customerComplaintLevel: 1, changeImpact: 1, monthsSinceLastAudit: 1 }
    const increasedExternal = calculateProcedurePriority({ ...baseline, previousThirdPartyNcrCount: 5 })
    expect(increasedExternal.score).toBeGreaterThan(calculateProcedurePriority(baseline).score)
  })
})

describe('calculateRiskIndex', () => {
  it('clamps values to 1-5', () => {
    expect(calculateRiskIndex(0, 10)).toBe(5)
    expect(calculateRiskIndex(3, 3)).toBe(9)
  })
})

describe('suggestRiskBump', () => {
  it('suggests higher occurrence when NCR and score are poor', () => {
    expect(suggestRiskBump(2, 3, 50)).toBeGreaterThan(2)
  })

  it('keeps value when audit is good', () => {
    expect(suggestRiskBump(2, 0, 95)).toBe(2)
  })
})

describe('clampRiskValue', () => {
  it('clamps to valid range', () => {
    expect(clampRiskValue(0)).toBe(1)
    expect(clampRiskValue(6)).toBe(5)
  })
})

describe('buildEffectiveProcedureRisks', () => {
  const baseCompany = {
    planRows: [
      { id: 'p1', qpCode: 'QP-01', departmentId: 'd1', department: '品保', riskLevel: '高' as const, months: Array(12).fill(null), manualOverride: false },
      { id: 'p2', qpCode: 'QP-02', departmentId: 'd2', department: '生產', riskLevel: '低' as const, months: Array(12).fill(null), manualOverride: false },
    ],
    procedureRisks: [
      {
        id: 'saved-1',
        qpCode: 'QP-01',
        departmentId: 'd1',
        inherentRisk: 4,
        evidenceReference: 'ev-1',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    ncrs: [
      { id: 'n1', qpCode: 'QP-02', departmentId: 'd2', status: '開立' as const, ncrNumber: 'NCR-1', description: '', rootCause: '', correctiveAction: '', preventiveAction: '', responsibleUnit: '', dueDate: '', openedAt: '', closedAt: null },
    ],
  } as unknown as CompanyData

  it('prefers persisted procedureRisks over plan fallbacks', () => {
    const risks = buildEffectiveProcedureRisks(baseCompany)
    expect(risks).toHaveLength(2)
    expect(risks[0].inherentRisk).toBe(4)
    expect(risks[0].evidenceReference).toBe('ev-1')
  })

  it('falls back to plan risk level when no saved record exists', () => {
    const risks = buildEffectiveProcedureRisks(baseCompany)
    expect(risks[1].inherentRisk).toBe(1)
    expect(risks[1].overdueOpenNcrCount).toBe(2)
  })
})
