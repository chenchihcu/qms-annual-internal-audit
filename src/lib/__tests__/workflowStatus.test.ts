import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  canCompleteAuditReport,
  canProceedToNextTab,
  getPdcaOverview,
  getTabWorkflowStatus,
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

  it('requires persisted inherent risk for risk tab exit', () => {
    const state = createDemoState()
    state.workspace.procedureRisks = []
    expect(canProceedToNextTab(state, 'risk')).toBe(false)
    const status = getTabWorkflowStatus(state, 'risk')
    expect(status.gaps).toHaveLength(1)
    expect(status.gaps[0].message).toMatch(/固有風險已存檔 \d+\/\d+/)
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
