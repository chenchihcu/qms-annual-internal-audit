import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { companySettingsFor } from '../../types'
import { countCurrentYearOpenObservations, countPriorOpenObservations } from '../dashboardMetrics'

describe('dashboardMetrics', () => {
  it('counts current-year open observations from ledger only', () => {
    const state = createDemoState()
    const companyId = state.activeCompanyId
    const year = companySettingsFor(state, companyId).auditYear
    const openCurrent = state.companies[companyId].observations.filter(
      (o) => o.status === 'open' && o.year === year,
    ).length
    expect(countCurrentYearOpenObservations(state, companyId)).toBe(openCurrent)
  })

  it('counts prior-year open observations including archives', () => {
    const state = createDemoState()
    const companyId = state.activeCompanyId
    const year = companySettingsFor(state, companyId).auditYear
    state.companies[companyId].observations.push({
      id: 'obs-prior-open',
      year: year - 1,
      qpCode: 'QP-01',
      departmentId: 'dept-qa',
      department: '品保部',
      process: '製程/最終檢驗',
      content: '前年度待追蹤',
      description: '',
      owner: '',
      dueDate: '',
      occurrenceDate: `${year - 1}-06-01`,
      status: 'open',
      sourceType: 'internal_audit',
    })
    expect(countPriorOpenObservations(state, companyId)).toBeGreaterThan(0)
  })
})
