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

  it('keeps the v8 seed behind the current v14 storage key', () => {
    const state = createDemoState()
    expect(state.version).toBe(8)
    expect(state.trash).toEqual([])
    expect(STORAGE_KEY).toBe('qms-annual-internal-audit-v14')
  })

  it('defaults ISO 9001 to the current edition without confirming applicability', () => {
    const state = createDemoState()
    const iso9001 = state.companyAuditProfiles.jiurun.applicableStandards.find((item) => item.name === 'ISO 9001')

    expect(iso9001).toMatchObject({ version: '2026', confirmationStatus: 'pending' })
    expect(iso9001).not.toHaveProperty('evidenceReference')
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
