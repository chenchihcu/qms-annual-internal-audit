import { describe, it, expect } from 'vitest'
import { createDemoState, STORAGE_KEY } from './demoData'
import { PROCEDURE_PLAN_TEMPLATE } from './procedurePlan'

const DEMO_AUDIT_PAIRS = [
  { qpCode: 'QP-28', departmentId: 'dept-qa' },
  { qpCode: 'QP-16', departmentId: 'dept-qa' },
  { qpCode: 'QP-20', departmentId: 'dept-admin' },
] as const

describe('createDemoState smoke', () => {
  it('does not throw', () => {
    expect(() => createDemoState()).not.toThrow()
  })

  it('uses v6 storage key and version', () => {
    const state = createDemoState()
    expect(state.version).toBe(6)
    expect(STORAGE_KEY).toBe('qms-annual-internal-audit-v6')
  })

  it('demo audits align to PROCEDURE_PLAN_TEMPLATE', () => {
    const state = createDemoState()
    const audits = state.companies.jiurun.audits

    expect(audits).toHaveLength(DEMO_AUDIT_PAIRS.length)

    for (const { qpCode, departmentId } of DEMO_AUDIT_PAIRS) {
      const audit = audits.find((a) => a.qpCode === qpCode && a.departmentId === departmentId)
      expect(audit, `missing demo audit ${qpCode}/${departmentId}`).toBeDefined()

      const entry = PROCEDURE_PLAN_TEMPLATE.find(
        (e) => e.qpCode === qpCode && e.departmentId === departmentId,
      )
      expect(entry, `no template entry for ${qpCode}/${departmentId}`).toBeDefined()
      expect(audit!.process).toBe(entry!.process)
      expect(audit!.auditCategory).toBe(entry!.auditCategory)
    }
  })
})
