import { describe, it, expect } from 'vitest'
import {
  shouldPropagateAuditAuditorsToPlan,
  shouldPropagatePlanAuditorsToAudit,
} from '../auditorSync'

describe('auditor sync', () => {
  it('propagates plan → audit when audit is empty', () => {
    expect(shouldPropagatePlanAuditorsToAudit('', '王大明', '')).toBe(true)
  })

  it('propagates plan → audit when audit still matches previous plan value', () => {
    expect(shouldPropagatePlanAuditorsToAudit('王大明', '李稽核', '王大明')).toBe(true)
  })

  it('does not propagate plan → audit when audit was customized', () => {
    expect(shouldPropagatePlanAuditorsToAudit('王大明', '李稽核', '陳自訂')).toBe(false)
  })

  it('propagates audit → plan when plan is empty', () => {
    expect(shouldPropagateAuditAuditorsToPlan('', '王大明', '')).toBe(true)
  })

  it('propagates audit → plan when plan still matches previous audit value', () => {
    expect(shouldPropagateAuditAuditorsToPlan('王大明', '李稽核', '王大明')).toBe(true)
  })

  it('does not propagate audit → plan when plan was customized', () => {
    expect(shouldPropagateAuditAuditorsToPlan('王大明', '李稽核', '計畫自訂')).toBe(false)
  })
})
