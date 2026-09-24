import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { procedureFieldErrors, standardFieldErrors } from '../auditProfileValidation'
import { procedureSourceReady, standardReady } from '../workflowStatus'

describe('auditProfileValidation', () => {
  it('flags procedure sentinel version as incomplete', () => {
    const state = createDemoState()
    const profile = state.companyAuditProfiles.jiurun
    expect(procedureFieldErrors(profile).auditProcedureVersion).toBe('仍為待確認')
    expect(procedureSourceReady(state, 'jiurun')).toBe(false)
  })

  it('clears procedure field errors when all three fields are valid', () => {
    const state = createDemoState()
    const profile = state.companyAuditProfiles.jiurun
    profile.auditProcedureCode = 'QP-28'
    profile.auditProcedureVersion = 'Rev.6'
    profile.formalRecordLocation = '品保部文件櫃 A-1'
    expect(procedureFieldErrors(profile)).toEqual({})
    expect(procedureSourceReady(state, 'jiurun')).toBe(true)
  })

  it('maps standard gaps to field errors', () => {
    const state = createDemoState()
    const profile = state.companyAuditProfiles.jiurun
    const errors = standardFieldErrors(profile)
    expect(errors.confirmation).toBe('至少一項適用標準須標為已確認')
    expect(errors.certificateScope).toBe('尚未填寫')
    expect(errors.certificateReference).toBe('尚未填寫')
    expect(standardReady(state, 'jiurun')).toBe(false)
  })

  it('requires evidence on confirmed standards only', () => {
    const state = createDemoState()
    const profile = state.companyAuditProfiles.jiurun
    profile.applicableStandards[0].confirmationStatus = 'confirmed'
    profile.applicableStandards[0].evidenceReference = ''
    profile.certificateScope = '精密零件'
    profile.certificateReference = 'REF-001'
    const errors = standardFieldErrors(profile)
    expect(errors.evidenceByIndex[0]).toBe('尚未填寫')
    expect(standardReady(state, 'jiurun')).toBe(false)
  })
})
