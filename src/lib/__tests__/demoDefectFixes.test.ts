import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { carryPlanDatesToAudit, resolvePlannedMonthFromPlan } from '../auditDates'
import { checkPlanRowImpartiality } from '../impartiality'
import { calculateAnnualScore } from '../scoring'
import { isProcedureComplete } from '../auditComplete'
import { scoreProcedureAudit } from '../scoring'

describe('demo defect fixes', () => {
  it('jiurun dashboard annual score is not scored while plan procedures remain unjudged', () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const summary = calculateAnnualScore(company.audits, state.companySettings.jiurun.scoringRules)
    expect(summary.overallScore).toBeNull()
  })

  it('bulk-conform style audit without evidence is not complete or scored', () => {
    const state = createDemoState()
    const audit = state.companies.zhenglongxing.audits.find((a) => a.qpCode === 'QP-05')
    expect(audit).toBeTruthy()
    audit!.items.forEach((i) => {
      if (!i.judgment) i.judgment = '符合'
    })
    expect(isProcedureComplete(audit!)).toBe(false)
    expect(scoreProcedureAudit(audit!).score).toBe(100)
  })

  it('zhenglongxing QP-05 checklist dates align with plan first scheduled month', () => {
    const state = createDemoState()
    const company = state.companies.zhenglongxing
    const row = company.planRows.find((r) => r.qpCode === 'QP-05' && r.departmentId === 'dept-qa')
    const audit = company.audits.find((a) => a.qpCode === 'QP-05' && a.departmentId === 'dept-qa')
    expect(row).toBeTruthy()
    expect(audit).toBeTruthy()
    const plannedMonth = resolvePlannedMonthFromPlan(row!)
    expect(audit!.plannedMonth).toBe(plannedMonth)
    expect(audit!.notifyDate).toBe(`2026-${String(plannedMonth).padStart(2, '0')}-01`)
    const synced = carryPlanDatesToAudit(row!, audit!, state.companySettings.zhenglongxing.auditYear)
    expect(synced.plannedMonth).toBe(plannedMonth)
  })

  it('demo includes impartiality conflict per company on plan rows', () => {
    const state = createDemoState()
    for (const companyId of ['jiurun', 'zhenglongxing'] as const) {
      const company = state.companies[companyId]
      const conflict = company.planRows.some(
        (row) => checkPlanRowImpartiality(row, company.departments) !== null,
      )
      expect(conflict, `${companyId} should have impartiality conflict`).toBe(true)
    }
  })

  it('each company has at least one fully judged procedure with evidence', () => {
    const state = createDemoState()
    for (const companyId of ['jiurun', 'zhenglongxing'] as const) {
      const company = state.companies[companyId]
      expect(company.audits.some(isProcedureComplete)).toBe(true)
    }
  })

  it('zhenglongxing keyCustomerName is set for print header', () => {
    const state = createDemoState()
    expect(state.companies.zhenglongxing.keyCustomerName).toBeTruthy()
  })
})
