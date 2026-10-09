import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  canCompleteAuditReport,
  canProceedToNextTab,
  getPdcaOverview,
  getTabWorkflowStatus,
  riskSourceGaps,
  standardReady,
  stakeholdersReady,
} from '../workflowStatus'

describe('workflowStatus', () => {
  it('marks dashboard ready to proceed to standard', () => {
    const state = createDemoState()
    expect(canProceedToNextTab(state, 'dashboard')).toBe(true)
  })

  it('routes procedure readiness gaps to system settings', () => {
    const state = createDemoState()
    state.auditProfile.applicableStandards[0].confirmationStatus = 'pending'
    state.auditProfile.certificateScope = ''
    state.auditProfile.certificateReference = ''
    const overview = getPdcaOverview(state, 'jiurun')
    expect(overview.plan.gaps.some((gap) => gap.message === '適用標準與證書依據未完整')).toBe(false)
    expect(overview.plan.gaps.filter((gap) => /程序來源/.test(gap.message)).every((gap) => gap.tab === 'system-settings')).toBe(true)
    expect(getTabWorkflowStatus(state, 'system-settings').ready).toBe(true)
    expect(canProceedToNextTab(state, 'ncr')).toBe(true)
    expect(canProceedToNextTab(state, 'observations')).toBe(true)
    expect(canProceedToNextTab(state, 'suggestions')).toBe(true)
  })

  it('requires confirmed risk assessments of the current year for risk tab exit', () => {
    const state = createDemoState()
    state.workspace.procedureRisks = []
    expect(canProceedToNextTab(state, 'risk')).toBe(false)
    const status = getTabWorkflowStatus(state, 'risk')
    expect(status.gaps).toHaveLength(1)
    expect(status.gaps[0].message).toMatch(/方案風險已確認 0\/\d+/)

    const year = state.settings.auditYear
    const full = { previousInternalNcrCount: 1, previousThirdPartyNcrCount: 1, overdueOpenNcrCount: 1, customerComplaintLevel: 1, changeImpact: 1, monthsSinceLastAudit: 1 }
    state.workspace.procedureRisks = state.workspace.planRows.map((row, index) => ({
      id: `r-${index}`,
      qpCode: row.qpCode,
      departmentId: row.departmentId,
      inherentRisk: 1,
      ...full,
      evidenceReference: '',
      updatedAt: 'x',
      assessmentYear: year,
      status: 'draft' as const,
    }))
    expect(canProceedToNextTab(state, 'risk')).toBe(false)

    state.workspace.procedureRisks = state.workspace.procedureRisks.map((record) => ({ ...record, status: 'confirmed' as const }))
    expect(canProceedToNextTab(state, 'risk')).toBe(true)

    state.workspace.procedureRisks = state.workspace.procedureRisks.map((record) => ({ ...record, assessmentYear: year - 1 }))
    expect(canProceedToNextTab(state, 'risk')).toBe(false)
  })

  it('reports risk-source gaps on the tab and in the PDCA plan overview', () => {
    const state = createDemoState()
    const co = state.workspace
    co.riskSourceCoverage = {}
    expect(riskSourceGaps(co, '2026-03-31')).toEqual([
      '客戶抱怨尚未勾選「已全部登錄」',
      '重大變更尚未勾選「已全部登錄」',
      '第三方稽核缺失尚未勾選「已全部登錄」',
    ])
    const declared = { checkedThrough: '2026-03-31', reference: 'x', recordedAt: 'x' }
    co.riskSourceCoverage = { customer_complaint: declared, major_change: declared, third_party_audit: declared }
    expect(riskSourceGaps(co, '2026-03-31')).toEqual([])
    expect(riskSourceGaps(co, '2026-04-01')[0]).toContain('只到 2026-03-31')
    co.riskSourceEvents = [{
      id: 'e', kind: 'customer_complaint', externalReference: 'CC-1', date: '2026-02-01', summary: '', createdAt: 'x',
      targets: [{ qpCode: 'QP-01', departmentId: 'dept-qa', linkStatus: 'pending' }],
    }]
    expect(riskSourceGaps(co, '2026-03-31')).toEqual(['關聯待確認 1 筆'])

    co.riskSourceCoverage = {}
    const plan = getPdcaOverview(state).plan
    expect(plan.ready).toBe(false)
    expect(plan.gaps.filter((gap) => gap.tab === 'risk-sources').length).toBeGreaterThan(0)
  })

  it('requires stakeholder tags for stakeholders tab exit', () => {
    const state = createDemoState()
    expect(stakeholdersReady(state, 'jiurun')).toBe(true)
    expect(canProceedToNextTab(state, 'stakeholders')).toBe(true)
    state.workspace.departments[0].stakeholders = []
    expect(stakeholdersReady(state, 'jiurun')).toBe(false)
    expect(canProceedToNextTab(state, 'stakeholders')).toBe(false)
    const status = getTabWorkflowStatus(state, 'stakeholders')
    expect(status.gaps).toHaveLength(1)
    expect(status.gaps[0].message).toMatch(/利害關係人已標註 \d+\/\d+/)
    const overview = getPdcaOverview(state, 'jiurun')
    expect(overview.plan.gaps.some((gap) => gap.tab === 'stakeholders')).toBe(true)
  })

  it('blocks complete report when pending checklist items remain', () => {
    const state = createDemoState()
    const audit = state.workspace.audits[0]
    audit.reportReference = 'RPT-001'
    const pending = audit.items.find((item) => !item.judgment)
    if (pending) pending.judgment = null
    const result = canCompleteAuditReport(audit)
    if (audit.items.some((item) => !item.judgment)) {
      expect(result.ready).toBe(false)
      expect(result.gaps.some((gap) => gap.includes('待判定'))).toBe(true)
    }
  })

  it('summarizes PDCA overview gaps', () => {
    const state = createDemoState()
    const overview = getPdcaOverview(state)
    expect(overview.plan).toBeDefined()
    expect(overview.do).toBeDefined()
    expect(overview.check).toBeDefined()
    expect(overview.act).toBeDefined()
    expect(typeof overview.annualCloseReady).toBe('boolean')
  })

  it('merges check gaps into a single followups summary', () => {
    const state = createDemoState()
    const overview = getPdcaOverview(state)
    const followupGaps = overview.check.gaps.filter((gap) => gap.tab === 'followups')
    expect(followupGaps.length).toBeLessThanOrEqual(1)
    if (followupGaps.length === 1) {
      expect(followupGaps[0].message).toMatch(/待追蹤 \d+ 件/)
    }
    const status = getTabWorkflowStatus(state, 'followups')
    expect(status.gaps.length).toBeLessThanOrEqual(1)
    const pendingAdvisory = status.advisories.find((item) => /待追蹤 \d+ 件/.test(item.message))
    if (pendingAdvisory) {
      expect(pendingAdvisory.message).toMatch(/待追蹤 \d+ 件/)
    }
    const carryAdvisory = status.advisories.find((item) => item.message.includes('跨年待帶入'))
    if (carryAdvisory) {
      expect(carryAdvisory.message).toMatch(/跨年待帶入 \d+ 件，至觀察事項帶入/)
      expect(carryAdvisory.tab).toBe('observations')
    }
  })

  it('links plan lead auditor gap to personnel tab', () => {
    const state = createDemoState()
    state.annualPersonnelAssignments = state.annualPersonnelAssignments.filter(
      (item) => item.role !== 'internal_lead_auditor',
    )
    const status = getTabWorkflowStatus(state, 'plan')
    const leadGap = status.gaps.find((gap) => gap.message === '主任稽核員任命未完成')
    expect(leadGap?.tab).toBe('personnel')
  })

  it('uses unified lead auditor message on personnel tab', () => {
    const state = createDemoState()
    state.annualPersonnelAssignments = state.annualPersonnelAssignments.filter(
      (item) => item.role !== 'internal_lead_auditor',
    )
    const status = getTabWorkflowStatus(state, 'personnel')
    expect(status.gaps.some((gap) => gap.message === '主任稽核員任命未完成')).toBe(true)
  })

  it('does not duplicate open-list advisories on ncr tab', () => {
    const state = createDemoState()
    const status = getTabWorkflowStatus(state, 'ncr')
    expect(status.gaps).toHaveLength(0)
    expect(status.advisories.some((item) => item.message.includes('未結案 NCR'))).toBe(false)
  })

  it('does not duplicate open-list advisories on observations tab', () => {
    const state = createDemoState()
    const status = getTabWorkflowStatus(state, 'observations')
    expect(status.gaps).toHaveLength(0)
    expect(status.advisories.some((item) => item.message.includes('待追蹤觀察'))).toBe(false)
  })

  it('keeps standard readiness when certificate text is blank', () => {
    const state = createDemoState()
    const profile = state.auditProfile
    profile.applicableStandards[0].confirmationStatus = 'pending'
    profile.applicableStandards[1].confirmationStatus = 'pending'
    profile.certificateScope = ''
    profile.certificateReference = ''
    expect(standardReady(state, 'jiurun')).toBe(true)
  })
})
