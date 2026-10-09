import { describe, expect, it } from 'vitest'
import type { ProcedureRiskRecord } from '../../types'
import { applyRiskApprove, applyRiskConfirm, applyRiskSave } from '../procedureRiskRecords'

const KEY = { qpCode: 'QP-01', departmentId: 'dept-qa' }
const FULL = {
  inherentRisk: 1,
  previousInternalNcrCount: 1,
  previousThirdPartyNcrCount: 1,
  overdueOpenNcrCount: 1,
  customerComplaintLevel: 1,
  changeImpact: 1,
  monthsSinceLastAudit: 1,
}

function save(records: ProcedureRiskRecord[], patch: Partial<ProcedureRiskRecord>, auditYear = 2026) {
  return applyRiskSave(records, { ...KEY, patch, auditYear, now: '2026-02-01T00:00:00.000Z', newId: 'risk-new' })
}

describe('procedure risk record lifecycle', () => {
  it('stamps the assessment year and starts as draft', () => {
    const [record] = save([], { ...FULL, evidenceReference: '' })
    expect(record.assessmentYear).toBe(2026)
    expect(record.status).toBe('draft')
    expect(record.id).toBe('risk-new')
  })

  it('confirms only complete drafts of the current year', () => {
    const complete = save([], { ...FULL, evidenceReference: '' })
    expect(applyRiskConfirm(complete, [KEY], 2026, 'now')[0].status).toBe('confirmed')

    const incomplete = save([], { inherentRisk: 1, evidenceReference: '' })
    expect(applyRiskConfirm(incomplete, [KEY], 2026, 'now')[0].status).toBe('draft')

    expect(applyRiskConfirm(complete, [KEY], 2027, 'now')[0].status).toBe('draft')
  })

  it('approval freezes a revision snapshot; later edits revoke approval but keep history', () => {
    const confirmed = applyRiskConfirm(save([], { ...FULL, evidenceReference: 'ev' }), [KEY], 2026, 'c')
    const approved = applyRiskApprove(confirmed, 2026, '主任', '2026-02-02T00:00:00.000Z', () => 'rev-1')
    expect(approved[0].status).toBe('approved')
    expect(approved[0].approvedBy).toBe('主任')
    expect(approved[0].revisions).toHaveLength(1)
    expect(approved[0].revisions![0].snapshot).toMatchObject({ score: 20, level: '低', evidenceReference: 'ev' })

    const unchanged = save(approved, { evidenceReference: 'ev' })
    expect(unchanged[0].status).toBe('approved')

    const edited = save(approved, { previousInternalNcrCount: 4 })
    expect(edited[0].status).toBe('draft')
    expect(edited[0].approvedAt).toBeUndefined()
    expect(edited[0].revisions).toHaveLength(1)
  })

  it('re-saving a prior-year record moves it to this year as draft', () => {
    const prior = save([], { ...FULL, evidenceReference: '' }, 2025)
    const approvedPrior = applyRiskApprove(applyRiskConfirm(prior, [KEY], 2025, 'c'), 2025, '主任', 'a', () => 'rev')
    const resaved = save(approvedPrior, {})
    expect(resaved[0].assessmentYear).toBe(2026)
    expect(resaved[0].status).toBe('draft')
    expect(resaved[0].revisions).toHaveLength(1)
  })

  it('appends override reasons without dropping earlier ones', () => {
    const first = applyRiskSave([], {
      ...KEY,
      patch: { ...FULL, evidenceReference: '' },
      overrides: [{ factor: 'inherentRisk', suggested: 1, value: 3, reason: '新製程', at: 't1' }],
      auditYear: 2026,
      now: 't1',
      newId: 'r',
    })
    const second = applyRiskSave(first, {
      ...KEY,
      patch: { changeImpact: 5 },
      overrides: [{ factor: 'changeImpact', value: 5, reason: '產線搬遷', at: 't2' }],
      auditYear: 2026,
      now: 't2',
      newId: 'r',
    })
    expect(second[0].overrides?.map((o) => o.reason)).toEqual(['新製程', '產線搬遷'])
  })
})
