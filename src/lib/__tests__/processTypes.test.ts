import { describe, expect, it } from 'vitest'
import { PROCESS_TYPES, PROCESS_TYPE_DEFINITIONS, isSuggestedTarget } from '../processTypes'

describe('procedure × risk-source matrix', () => {
  it('suggests targets only for classified procedures whose type watches the source kind', () => {
    const types = { 'QP-21|dept-prod': 'production' as const, 'QP-17|dept-admin': 'purchasing' as const }
    expect(isSuggestedTarget(types, 'QP-21', 'dept-prod', 'customer_complaint')).toBe(true)
    expect(isSuggestedTarget(types, 'QP-17', 'dept-admin', 'customer_complaint')).toBe(false)
    expect(isSuggestedTarget(types, 'QP-17', 'dept-admin', 'major_change')).toBe(true)
    expect(isSuggestedTarget(types, 'QP-04', 'dept-prod', 'major_change')).toBe(false)
    expect(isSuggestedTarget(undefined, 'QP-21', 'dept-prod', 'customer_complaint')).toBe(false)
  })

  it('lists every process type with at least the audit-finding concern', () => {
    for (const type of PROCESS_TYPES) {
      expect(PROCESS_TYPE_DEFINITIONS[type].concerns).toContain('稽核缺失')
    }
  })
})
