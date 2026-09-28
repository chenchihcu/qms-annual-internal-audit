import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { procedureFieldErrors } from '../auditProfileValidation'
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

  it('does not require certificate text or applicability confirmation', () => {
    const state = createDemoState()
    const profile = state.companyAuditProfiles.jiurun
    profile.certificateScope = ''
    profile.certificateReference = ''
    profile.applicableStandards.forEach((standard) => {
      standard.confirmationStatus = 'pending'
    })
    expect(standardReady(state, 'jiurun')).toBe(true)
  })
})
