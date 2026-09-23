import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  buildAuditScheduleRows,
  defaultScheduleFilter,
  filterScheduleRows,
} from '../auditSchedule'

describe('auditSchedule', () => {
  it('builds rows from audits with plan metadata', () => {
    const state = createDemoState()
    const rows = buildAuditScheduleRows(state.companies.jiurun, state.companySettings.jiurun.scoringRules)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toMatchObject({
      auditId: expect.any(String),
      qpCode: expect.any(String),
      department: expect.any(String),
      status: expect.any(String),
    })
  })

  it('defaults to in-progress filter when audits are active', () => {
    const state = createDemoState()
    const audit = state.companies.jiurun.audits[0]
    audit.status = '執行中'
    const rows = buildAuditScheduleRows(state.companies.jiurun, state.companySettings.jiurun.scoringRules)
    expect(defaultScheduleFilter(rows)).toBe('inProgress')
    expect(filterScheduleRows(rows, 'inProgress', 'all').some((row) => row.auditId === audit.id)).toBe(true)
  })
})
