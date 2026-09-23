import { describe, it, expect } from 'vitest'
import { buildMergedCertificateCoverage, buildSharedCoverage, deriveInternalAuditComplete } from '../coverage'
import { createDemoState } from '../../data/demoData'
import type { CompanyData } from '../../types'

describe('buildMergedCertificateCoverage', () => {
  it('reports gaps for demo company with partial audits', () => {
    const demo = createDemoState()
    const settings = demo.companySettings.jiurun
    const report = buildMergedCertificateCoverage(
      demo.companies.jiurun,
      settings.auditYear,
      settings.scoringRules,
    )
    expect(report.gaps.length).toBeGreaterThan(0)
    expect(deriveInternalAuditComplete(demo.companies.jiurun, settings.auditYear)).toBe(false)
  })

  it('reports unscheduled plan rows', () => {
    const base = createDemoState().companies.jiurun
    const company: CompanyData = {
      ...base,
      audits: [],
      planRows: base.planRows.map((r, i) =>
        i === 0 ? { ...r, months: Array(12).fill(null) } : r,
      ),
    }
    const gaps = buildSharedCoverage(company, 2026)
    expect(gaps.some((g) => g.reason === 'unscheduled')).toBe(true)
  })
})
