import { describe, expect, it } from 'vitest'
import { isProcedureComplete } from '../lib/auditComplete'
import { calculateAnnualScore } from '../lib/scoring'
import { createDemoState, STORAGE_KEY } from './demoData'
import { PROCEDURE_PLAN_TEMPLATE } from './procedurePlan'

describe('demoData smoke (delivery gate)', () => {
  it('createDemoState does not throw and aligns QP/dept', () => {
    const state = createDemoState()
    expect(STORAGE_KEY).toContain('v9')
    expect(state.version).toBeGreaterThanOrEqual(12)
    expect(state.dataSource).toBe('demo')
    expect(state.companies.jiurun.planRows.length).toBeGreaterThan(0)
    for (const audit of state.companies.jiurun.audits) {
      const entry =
        PROCEDURE_PLAN_TEMPLATE.find(
          (e) => e.qpCode === audit.qpCode && e.departmentId === audit.departmentId,
        ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === audit.qpCode)
      expect(entry, `${audit.qpCode}|${audit.departmentId}`).toBeTruthy()
    }
  })

  it('each company demo includes at least one fully judged procedure with evidence', () => {
    const state = createDemoState()
    for (const companyId of ['jiurun', 'zhenglongxing'] as const) {
      const company = state.companies[companyId]
      expect(company.audits.some(isProcedureComplete)).toBe(true)
      const summary = calculateAnnualScore(
        company.audits,
        state.settings.scoringRules,
        company.planRows,
      )
      expect(summary.scoredProcedures).toBeGreaterThanOrEqual(1)
    }
  })
})
