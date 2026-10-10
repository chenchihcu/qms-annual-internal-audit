import { describe, expect, it } from 'vitest'
import seed from '../../data/checklists.seed.json'
import { PROCESS_TYPES, PROCESS_TYPE_DEFINITIONS, QP_PROCESS_TYPES, isSuggestedTarget, processTypesFor } from '../processTypes'

describe('procedure × risk-source matrix', () => {
  it('suggests targets from the fixed QP mapping only when the type watches the source kind', () => {
    expect(isSuggestedTarget('QP-21', 'customer_complaint')).toBe(true)
    expect(isSuggestedTarget('QP-17', 'customer_complaint')).toBe(false)
    expect(isSuggestedTarget('QP-17', 'major_change')).toBe(true)
    expect(isSuggestedTarget('QP-04', 'major_change')).toBe(false)
    expect(isSuggestedTarget('QR-28-04', 'customer_complaint')).toBe(false)
  })

  it('maps every seed QP and leaves QR forms out; QP-15 carries both design and purchasing', () => {
    const qpCodes = new Set(seed.proceduresRaw.map((p) => p.procedureCode))
    expect(Object.keys(QP_PROCESS_TYPES).sort()).toEqual([...qpCodes].sort())
    expect(processTypesFor('QR-28-04')).toEqual([])
    expect(processTypesFor('QR-28-05')).toEqual([])
    expect(processTypesFor('QP-15')).toEqual(['design', 'purchasing'])
    expect(isSuggestedTarget('QP-15', 'major_change')).toBe(true)
  })

  it('lists every process type with at least the audit-finding concern', () => {
    for (const type of PROCESS_TYPES) {
      expect(PROCESS_TYPE_DEFINITIONS[type].concerns).toContain('稽核缺失')
    }
  })
})
