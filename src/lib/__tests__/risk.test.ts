import { describe, it, expect } from 'vitest'
import {
  calculateRiskLevel,
  calculateRiskIndex,
  clampRiskValue,
  calculateProcedurePriority,
  countToScale,
  scaleToCountLabel,
  scaleToBandLabel,
  monthsToScale,
  scaleToMonthsLabel,
  inherentScaleFromSeed,
  scaleToInherentLabel,
  formatFactorLabel,
  assessProcedurePriority,
  inherentFloorLevel,
  seedInherentScale,
  effectiveRiskStatus,
  plannerReadyRisks,
  riskConfirmBlockers,
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
    expect(result.missingFactors).toContain('客戶抱怨件數')
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

describe('risk factor label mappings', () => {
  it('maps NCR counts to scale and labels', () => {
    expect(countToScale(0)).toBe(1)
    expect(countToScale(1)).toBe(2)
    expect(countToScale(2)).toBe(3)
    expect(countToScale(3)).toBe(4)
    expect(countToScale(4)).toBe(5)
    expect(countToScale(99)).toBe(5)
    expect(scaleToCountLabel(undefined)).toBe('—')
    expect(scaleToCountLabel(1)).toBe('0件')
    expect(scaleToCountLabel(5)).toBe('≥4件')
  })

  it('maps three-band and months scales', () => {
    expect(scaleToBandLabel(1)).toBe('無')
    expect(scaleToBandLabel(3)).toBe('中')
    expect(scaleToBandLabel(5)).toBe('高')
    expect(monthsToScale(0)).toBe(1)
    expect(monthsToScale(11)).toBe(2)
    expect(monthsToScale(24)).toBe(5)
    expect(scaleToMonthsLabel(4)).toBe('18–23月')
  })

  it('maps inherent seed and legacy display bands', () => {
    expect(inherentScaleFromSeed('高')).toBe(5)
    expect(inherentScaleFromSeed('中')).toBe(3)
    expect(inherentScaleFromSeed('低')).toBe(1)
    expect(scaleToInherentLabel(2)).toBe('低')
    expect(scaleToInherentLabel(3)).toBe('中')
    expect(scaleToInherentLabel(4)).toBe('高')
  })

  it('formatFactorLabel routes by field kind', () => {
    expect(formatFactorLabel('previousInternalNcrCount', 3)).toBe('2件')
    expect(formatFactorLabel('customerComplaintLevel', 1)).toBe('0件')
    expect(formatFactorLabel('changeImpact', 3)).toBe('2件')
    expect(formatFactorLabel('inherentRisk', 5)).toBe('高')
  })

})

describe('calculateRiskIndex', () => {
  it('clamps values to 1-5', () => {
    expect(calculateRiskIndex(0, 10)).toBe(5)
    expect(calculateRiskIndex(3, 3)).toBe(9)
  })
})

describe('clampRiskValue', () => {
  it('clamps to valid range', () => {
    expect(clampRiskValue(0)).toBe(1)
    expect(clampRiskValue(6)).toBe(5)
  })
})

describe('assessProcedurePriority (P0 scoring guards)', () => {
  it('gives no formal level while any factor is undecided, instead of imputing 中', () => {
    for (const inherentRisk of [1, 3, 5]) {
      const result = assessProcedurePriority({ inherentRisk })
      expect(result.level).toBeNull()
      expect(result.missingKeys).toHaveLength(6)
      expect(result.provisional).toBe(true)
    }
    expect(assessProcedurePriority({ inherentRisk: 5 }).score).toBe(66)
  })

  it('scores unavailable-with-reason factors at 3 and then grants a level', () => {
    const result = assessProcedurePriority(
      { inherentRisk: 3, previousInternalNcrCount: 1, previousThirdPartyNcrCount: 1, overdueOpenNcrCount: 1, monthsSinceLastAudit: 1 },
      { customerComplaintLevel: '客訴系統未開放查詢', changeImpact: '變更紀錄未取得' },
    )
    expect(result.missingKeys).toEqual([])
    expect(result.unavailableKeys).toEqual(['customerComplaintLevel', 'changeImpact'])
    expect(result.score).toBe(9 + 4 + 3 + 3 + 9 + 6 + 2)
    expect(result.level).toBe('低')
  })

  it('ignores blank unavailable reasons (still missing)', () => {
    const result = assessProcedurePriority({ inherentRisk: 3 }, { changeImpact: '  ' })
    expect(result.missingKeys).toContain('changeImpact')
  })

  it('applies the inherent floor: 固有高 with no events is at least 中', () => {
    const result = assessProcedurePriority({
      inherentRisk: 5,
      previousInternalNcrCount: 1,
      previousThirdPartyNcrCount: 1,
      overdueOpenNcrCount: 1,
      customerComplaintLevel: 1,
      changeImpact: 1,
      monthsSinceLastAudit: 1,
    })
    expect(result.score).toBe(32)
    expect(result.formulaLevel).toBe('低')
    expect(result.level).toBe('中')
    expect(result.floorApplied).toBe(true)
  })

  it('does not floor 固有中 or 固有低', () => {
    const all1 = { previousInternalNcrCount: 1, previousThirdPartyNcrCount: 1, overdueOpenNcrCount: 1, customerComplaintLevel: 1, changeImpact: 1, monthsSinceLastAudit: 1 }
    expect(assessProcedurePriority({ inherentRisk: 3, ...all1 }).level).toBe('低')
    expect(assessProcedurePriority({ inherentRisk: 3, ...all1 }).floorApplied).toBe(false)
    expect(inherentFloorLevel(1)).toBeNull()
  })
})

describe('seed inherent risk (G1 regression)', () => {
  it('reads the procedure seed, not the plan row level written by auto-arrange', () => {
    expect(seedInherentScale('QP-01', 'dept-qa', '中')).toBe(1)
    expect(seedInherentScale('QP-03', 'dept-qa', '低')).toBe(3)
  })

  it('falls back to the plan row only for rows outside the seed', () => {
    expect(seedInherentScale('QP-99', 'dept-x', '高')).toBe(5)
  })

})

describe('procedure risk status helpers', () => {
  const complete = {
    id: 'r1',
    qpCode: 'QP-01',
    departmentId: 'dept-qa',
    inherentRisk: 1,
    previousInternalNcrCount: 1,
    previousThirdPartyNcrCount: 1,
    overdueOpenNcrCount: 1,
    customerComplaintLevel: 1,
    changeImpact: 1,
    monthsSinceLastAudit: 1,
    evidenceReference: '',
    updatedAt: '2026-01-01',
  }

  it('derives legacy / stale / year status without rewriting data', () => {
    expect(effectiveRiskStatus(undefined, 2026)).toBe('none')
    expect(effectiveRiskStatus(complete, 2026)).toBe('legacy')
    expect(effectiveRiskStatus({ ...complete, assessmentYear: 2025, status: 'approved' }, 2026)).toBe('stale')
    expect(effectiveRiskStatus({ ...complete, assessmentYear: 2026 }, 2026)).toBe('draft')
    expect(effectiveRiskStatus({ ...complete, assessmentYear: 2026, status: 'approved' }, 2026)).toBe('approved')
  })

  it('plannerReadyRisks keeps only this year confirmed/approved records with a level', () => {
    const company = {
      planRows: [],
      procedureRisks: [
        { ...complete, id: 'a', assessmentYear: 2026, status: 'confirmed' as const },
        { ...complete, id: 'b', assessmentYear: 2026, status: 'draft' as const },
        { ...complete, id: 'c', assessmentYear: 2025, status: 'approved' as const },
        { ...complete, id: 'd' },
        { ...complete, id: 'e', assessmentYear: 2026, status: 'confirmed' as const, changeImpact: undefined },
      ],
    } as unknown as CompanyData
    expect(plannerReadyRisks(company, 2026).map((r) => r.id)).toEqual(['a'])
  })

  it('blocks confirmation for missing factors and 中／高 complaint without basis', () => {
    expect(riskConfirmBlockers(complete)).toEqual([])
    expect(riskConfirmBlockers({ ...complete, customerComplaintLevel: 2 })).toEqual(['客戶抱怨件數缺依據'])
    expect(riskConfirmBlockers({ ...complete, customerComplaintLevel: 2, factorSources: { customerComplaintLevel: ['e1'] } })).toEqual([])
    expect(riskConfirmBlockers({ ...complete, customerComplaintLevel: 5, factorBasis: { customerComplaintLevel: 'CC-2026-01' } })).toEqual([])
    expect(riskConfirmBlockers({ ...complete, changeImpact: undefined })).toEqual(['重大變更件數未填'])
  })
})
