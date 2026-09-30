import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { procedureFieldErrors } from '../auditProfileValidation'
import { procedureSourceReady, standardReady } from '../workflowStatus'

describe('auditProfileValidation', () => {
  it('flags missing formal record location as incomplete', () => {
    const state = createDemoState()
    const profile = state.auditProfile
    expect(procedureFieldErrors(profile).formalRecordLocation).toBe('尚未指定保存位置')
    expect(procedureSourceReady(state)).toBe(false)
  })

  it('clears procedure field errors when all three fields are valid', () => {
    const state = createDemoState()
    const profile = state.auditProfile
    profile.auditProcedureCode = 'QP-28'
    profile.auditProcedureVersion = 'Rev.6'
    profile.formalRecordLocation = '品保部文件櫃 A-1'
    expect(procedureFieldErrors(profile)).toEqual({})
    expect(procedureSourceReady(state)).toBe(true)
  })

  it('does not require certificate text or applicability confirmation', () => {
    const state = createDemoState()
    const profile = state.auditProfile
    profile.certificateScope = ''
    profile.certificateReference = ''
    profile.applicableStandards.forEach((standard) => {
      standard.confirmationStatus = 'pending'
    })
    expect(standardReady(state)).toBe(true)
  })
})
