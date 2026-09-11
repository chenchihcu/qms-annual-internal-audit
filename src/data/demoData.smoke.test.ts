import { describe, expect, it } from 'vitest'
import { createDemoState, STORAGE_KEY } from './demoData'
import { PROCEDURE_PLAN_TEMPLATE } from './procedurePlan'

describe('demoData smoke (delivery gate)', () => {
  it('createDemoState does not throw and aligns QP/dept', () => {
    const state = createDemoState()
    expect(STORAGE_KEY).toContain('v5')
    expect(state.version).toBeGreaterThanOrEqual(5)
    expect(state.companies.jiurun.planRows.length).toBeGreaterThan(0)
    for (const audit of state.companies.jiurun.audits) {
      const entry =
        PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === audit.qpCode && e.departmentId === audit.departmentId,
        ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === audit.qpCode)
      expect(entry, `${audit.qpCode}|${audit.departmentId}`).toBeTruthy()
    }
  })
})
