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

  it('keeps demo seed at v15 storage key', () => {
    const state = createDemoState()
    expect(state.version).toBe(15)
    expect(state.trash).toEqual([])
    expect(STORAGE_KEY).toBe('qms-annual-internal-audit-v15')
  })

  it('defaults ISO 9001 to the current edition without confirming applicability', () => {
    const state = createDemoState()
    const iso9001 = state.auditProfile.applicableStandards.find((item) => item.name === 'ISO 9001')

    expect(iso9001).toMatchObject({ version: '2026', confirmationStatus: 'pending' })
  })

  it('demo audits align to PROCEDURE_PLAN_TEMPLATE', () => {
    const state = createDemoState()
    const audits = state.workspace.audits

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
