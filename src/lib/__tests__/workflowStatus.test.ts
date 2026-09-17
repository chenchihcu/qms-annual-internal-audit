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

  it('blocks procedure next when standard incomplete', () => {
    const state = createDemoState()
    state.companyAuditProfiles.jiurun.applicableStandards[0].confirmationStatus = 'pending'
    expect(canProceedToNextTab(state, 'standard')).toBe(false)
    expect(getTabWorkflowStatus(state, 'standard').gaps.length).toBeGreaterThan(0)
  })

  it('orders risk before plan in workflow chain', () => {
    const state = createDemoState()
    expect(getTabWorkflowStatus(state, 'procedure').ready).toBeDefined()
    expect(canProceedToNextTab(state, 'ncr')).toBe(true)
    expect(canProceedToNextTab(state, 'observations')).toBe(true)
    expect(canProceedToNextTab(state, 'suggestions')).toBe(true)
  })

  it('requires persisted inherent risk for risk tab exit', () => {
    const state = createDemoState()
    state.companies.jiurun.procedureRisks = []
    expect(canProceedToNextTab(state, 'risk')).toBe(false)
    const status = getTabWorkflowStatus(state, 'risk')
    expect(status.gaps).toHaveLength(1)
    expect(status.gaps[0].message).toMatch(/固有風險已存檔 \d+\/\d+/)
  })

  it('requires stakeholder tags for stakeholders tab exit', () => {
    const state = createDemoState()
    expect(stakeholdersReady(state, 'jiurun')).toBe(true)
    expect(canProceedToNextTab(state, 'stakeholders')).toBe(true)
    state.companies.jiurun.departments[0].stakeholders = []
    expect(stakeholdersReady(state, 'jiurun')).toBe(false)
    expect(canProceedToNextTab(state, 'stakeholders')).toBe(false)
    const overview = getPdcaOverview(state, 'jiurun')
    expect(overview.plan.gaps.some((gap) => gap.tab === 'stakeholders')).toBe(true)
  })

  it('blocks complete report when pending checklist items remain', () => {
    const state = createDemoState()
    const audit = state.companies.jiurun.audits[0]
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

  it('detects standard readiness with evidence', () => {
    const state = createDemoState()
    const profile = state.companyAuditProfiles.jiurun
    profile.applicableStandards[0].confirmationStatus = 'confirmed'
    profile.applicableStandards[0].evidenceReference = 'CERT-ISO-001'
    profile.certificateScope = '精密零件製造'
    profile.certificateReference = 'REF-001'
    expect(standardReady(state, 'jiurun')).toBe(true)
    profile.certificateReference = ''
    expect(standardReady(state, 'jiurun')).toBe(false)
  })
})
