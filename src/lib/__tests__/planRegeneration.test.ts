import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import type { AppState, PlanRow } from '../../types'
import {
  buildRegeneratedPlanRows,
  describePlanChanges,
  isPlanApprovalCurrent,
  openCarryForwardByKey,
  planApprovalSignature,
} from '../planRegeneration'

function scheduledMonths(row: PlanRow): number[] {
  return row.months.flatMap((status, index) => (status ? [index + 1] : []))
}

function freshState(): AppState {
  const state = createDemoState()
  state.workspace.planRows = state.workspace.planRows.map((row) => ({ ...row, manualOverride: false }))
  state.workspace.procedureRisks = []
  return state
}

describe('buildRegeneratedPlanRows', () => {
  it('keeps the buffer month before the external audit date', () => {
    const state = freshState()
    const year = state.settings.auditYear
    state.settings.planWindowStart = `${year}-01-01`
    state.settings.planWindowEnd = `${year}-12-31`
    state.settings.managementReviewDate = undefined
    state.externalAuditPrep = { ...state.externalAuditPrep, externalAuditDate: `${year}-06-15` }
    const rows = buildRegeneratedPlanRows(state)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => scheduledMonths(row).every((month) => month <= 5))).toBe(true)
  })

  it('ignores unconfirmed risk records so seed and department O×S still drive the plan', () => {
    const state = freshState()
    const target = state.workspace.planRows[0]
    const baseline = buildRegeneratedPlanRows(state).find((row) => row.id === target.id)!
    state.workspace.procedureRisks = [{
      id: 'draft',
      qpCode: target.qpCode,
      departmentId: target.departmentId,
      inherentRisk: 5,
      previousInternalNcrCount: 5,
      previousThirdPartyNcrCount: 5,
      overdueOpenNcrCount: 5,
      customerComplaintLevel: 5,
      changeImpact: 5,
      monthsSinceLastAudit: 5,
      evidenceReference: '',
      updatedAt: 'x',
      assessmentYear: state.settings.auditYear,
      status: 'draft',
    }]
    expect(buildRegeneratedPlanRows(state).find((row) => row.id === target.id)!.riskLevel).toBe(baseline.riskLevel)

    state.workspace.procedureRisks[0].status = 'confirmed'
    expect(buildRegeneratedPlanRows(state).find((row) => row.id === target.id)!.riskLevel).toBe('高')
  })
})

describe('openCarryForwardByKey', () => {
  it('counts open observations and NCRs per QP|department only', () => {
    const state = freshState()
    const ws = state.workspace
    ws.observations = [{ ...ws.observations[0], id: 'o', qpCode: 'QP-01', departmentId: 'dept-qa', status: 'open' as const }]
    ws.ncrs = [
      { ...ws.ncrs[0], id: 'n1', qpCode: 'QP-01', departmentId: 'dept-qa', status: '開立' },
      { ...ws.ncrs[0], id: 'n2', qpCode: 'QP-02', departmentId: 'dept-qa', status: '結案' },
    ]
    expect(openCarryForwardByKey(ws)).toEqual({ 'QP-01|dept-qa': 2 })
  })
})

describe('describePlanChanges', () => {
  it('lists only rows whose level or months change', () => {
    const before = [
      { id: 'a', qpCode: 'QP-01', department: '品保部', riskLevel: '中', months: [null, '擬定', ...Array(10).fill(null)] },
      { id: 'b', qpCode: 'QP-02', department: '品保部', riskLevel: '低', months: Array(12).fill(null) },
    ] as unknown as PlanRow[]
    const after = [
      { ...before[0], riskLevel: '低', months: ['擬定', ...Array(11).fill(null)] },
      before[1],
    ] as unknown as PlanRow[]
    expect(describePlanChanges(before, after)).toEqual([
      { id: 'a', label: 'QP-01 品保部', schedule: '風險 中→低；2月→1月' },
    ])
  })

  it('also lists pure reordering and removed rows', () => {
    const before = [
      { id: 'a', qpCode: 'QP-01', department: '品保部', sequence: 1, riskLevel: '中', months: Array(12).fill(null) },
      { id: 'b', qpCode: 'QP-02', department: '品保部', sequence: 2, riskLevel: '中', months: Array(12).fill(null) },
      { id: 'c', qpCode: 'QP-03', department: '品保部', sequence: 3, riskLevel: '低', months: Array(12).fill(null) },
    ] as unknown as PlanRow[]
    const after = [{ ...before[1], sequence: 1 }, { ...before[0], sequence: 2 }] as unknown as PlanRow[]
    expect(describePlanChanges(before, after)).toEqual([
      { id: 'b', label: 'QP-02 品保部', schedule: '順序 2→1' },
      { id: 'a', label: 'QP-01 品保部', schedule: '順序 1→2' },
      { id: 'c', label: 'QP-03 品保部', schedule: '移除列' },
    ])
  })
})

describe('plan approval signature', () => {
  it('stays approved until any plan content or window date changes', () => {
    const state = freshState()
    state.settings.planApprovedAt = '2026-02-01T00:00:00.000Z'
    expect(isPlanApprovalCurrent(state)).toBe(false)
    state.settings.planApprovedSignature = planApprovalSignature(state)
    expect(isPlanApprovalCurrent(state)).toBe(true)

    const withAuditor = { ...state, workspace: { ...state.workspace, planRows: state.workspace.planRows.map((row, index) => (index === 0 ? { ...row, auditors: `${row.auditors}・新增` } : row)) } }
    expect(isPlanApprovalCurrent(withAuditor)).toBe(false)
    const withMonth = { ...state, workspace: { ...state.workspace, planRows: state.workspace.planRows.map((row, index) => (index === 0 ? { ...row, months: row.months.map((m, i) => (i === 0 ? (m ? null : '擬定') : m)) } : row)) } }
    expect(isPlanApprovalCurrent(withMonth)).toBe(false)
    expect(isPlanApprovalCurrent({ ...state, settings: { ...state.settings, planWindowEnd: '2099-01-01' } })).toBe(false)
  })
})
