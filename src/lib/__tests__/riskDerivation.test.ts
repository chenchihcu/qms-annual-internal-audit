import { describe, expect, it } from 'vitest'
import type { AuditSettings, ChecklistItem, CompanyData, NCR, Observation, ProcedureAudit, RiskSourceEvent } from '../../types'
import { buildRiskDerivationPool, deriveRiskFactors } from '../riskDerivation'

const QP = 'QP-01'
const DEPT = 'dept-qa'

function item(id: string, extra: Partial<ChecklistItem> = {}): ChecklistItem {
  return { id, category: '測試', no: 1, content: id, judgment: null, description: '', ...extra }
}

function audit(id: string, auditDate: string, items: ChecklistItem[], extra: Partial<ProcedureAudit> = {}): ProcedureAudit {
  return {
    id,
    qpCode: QP,
    departmentId: DEPT,
    department: '品保部',
    process: '',
    documents: '',
    notifyDate: '',
    auditDate,
    departmentManager: '',
    auditors: '',
    auditCategory: '系統稽核',
    items,
    status: '已回報',
    ...extra,
  }
}

function ncr(id: string, extra: Partial<NCR> = {}): NCR {
  return {
    id,
    ncrNumber: id.toUpperCase(),
    qpCode: QP,
    departmentId: DEPT,
    department: '品保部',
    process: '',
    description: '',
    date: '2025-05-10',
    status: '結案',
    rootCause: '',
    correctiveAction: '',
    verificationEvidence: '',
    ...extra,
  }
}

function workspace(parts: Partial<CompanyData>): CompanyData {
  return { name: 'ws', departments: [], planRows: [], audits: [], ncrs: [], observations: [], suggestions: [], ...parts }
}

const settings = { auditYear: 2026, planWindowStart: '2026-02-01' } as AuditSettings

function scenario() {
  const thirdPartyObs: Observation = {
    id: 'o-tp',
    year: 2025,
    qpCode: QP,
    departmentId: DEPT,
    department: '品保部',
    process: '',
    content: '外稽缺失',
    description: '',
    status: 'became_ncr',
    sourceType: 'third_party_audit',
  }
  const previous = workspace({
    audits: [audit('a-2025', '2025-05-10', [item('i-1', { judgment: '不符' })])],
    ncrs: [
      ncr('n-1', { checklistItemId: 'i-1', sourceAuditId: 'a-2025', sourceYear: 2025, status: '開立', dueDate: '2025-08-01' }),
      ncr('n-tp', { observationId: 'o-tp', sourceYear: 2025 }),
    ],
    observations: [thirdPartyObs],
  })
  const current = workspace({
    audits: [
      audit('a-2026', '', [
        item('i-cf', { sourceNcrId: 'n-1', judgment: '不符', origin: 'carryforward' }),
        item('i-3', { judgment: '不符' }),
      ], { status: '執行中' }),
    ],
    ncrs: [
      ncr('n-2', { checklistItemId: 'i-cf', sourceYear: 2026, date: '2026-03-01' }),
      ncr('ncr-obs-chk-i-3', { checklistItemId: 'i-3', date: '2026-03-02' }),
      ncr('ncr-i-3', { checklistItemId: 'i-3', date: '2026-03-02' }),
    ],
  })
  const staleCurrentYearCopy = workspace({ ncrs: [ncr('n-ghost', { sourceYear: 2026, status: '開立' })] })
  return { workspace: current, settings, yearArchives: { 2025: { workspace: previous, settings }, 2026: { workspace: staleCurrentYearCopy, settings } } }
}

describe('deriveRiskFactors', () => {
  it('counts one event per root across carry-forward and duplicate checklist NCRs', () => {
    const pool = buildRiskDerivationPool(scenario())
    const result = deriveRiskFactors(pool, QP, DEPT, { today: '2026-03-10' })
    expect(result.previousInternalNcrCount.count).toBe(2)
    expect(result.previousInternalNcrCount.suggested).toBe(3)
    expect(result.previousInternalNcrCount.sources).toHaveLength(2)
    expect(result.previousInternalNcrCount.sources.some((s) => s.id === 'n-1' && s.year === 2025)).toBe(true)
  })

  it('classifies NCRs raised from third-party observations separately', () => {
    const pool = buildRiskDerivationPool(scenario())
    const result = deriveRiskFactors(pool, QP, DEPT, { today: '2026-03-10' })
    expect(result.previousThirdPartyNcrCount.count).toBe(1)
    expect(result.previousThirdPartyNcrCount.sources[0].id).toBe('n-tp')
  })

  it('ignores the stale current-year copy kept in yearArchives', () => {
    const pool = buildRiskDerivationPool(scenario())
    expect(pool.ncrs.some((located) => located.record.id === 'n-ghost')).toBe(false)
  })

  it('counts open events once and reports overdue', () => {
    const pool = buildRiskDerivationPool(scenario())
    const result = deriveRiskFactors(pool, QP, DEPT, { today: '2026-03-10' })
    // n-1 (open, overdue) and its carry-forward n-2 share a root; i-3 pair is closed.
    expect(result.overdueOpenNcrCount.count).toBe(1)
    expect(result.overdueOpenNcrCount.note).toContain('逾期 1')
  })

  it('uses only executed audits for months since last audit', () => {
    const pool = buildRiskDerivationPool(scenario())
    const result = deriveRiskFactors(pool, QP, DEPT, { today: '2026-03-10' })
    expect(result.monthsSinceLastAudit.count).toBe(9)
    expect(result.monthsSinceLastAudit.suggested).toBe(2)
    expect(result.monthsSinceLastAudit.sources[0].id).toBe('a-2025')
  })

  it('distinguishes no events (audited) from no data (never audited in period)', () => {
    const audited = buildRiskDerivationPool({
      workspace: workspace({ audits: [audit('a', '2026-01-15', [])] }),
      settings,
      yearArchives: {},
    })
    const clean = deriveRiskFactors(audited, QP, DEPT)
    expect(clean.previousInternalNcrCount.status).toBe('no_events')
    expect(clean.previousInternalNcrCount.suggested).toBe(1)
    expect(clean.previousThirdPartyNcrCount.status).toBe('no_data')
    expect(clean.previousThirdPartyNcrCount.suggested).toBeUndefined()

    const empty = buildRiskDerivationPool({ workspace: workspace({}), settings, yearArchives: {} })
    const unknown = deriveRiskFactors(empty, QP, DEPT)
    expect(unknown.previousInternalNcrCount.status).toBe('no_data')
    expect(unknown.overdueOpenNcrCount.status).toBe('no_data')
    expect(unknown.monthsSinceLastAudit.status).toBe('no_data')
    expect(unknown.customerComplaintLevel.status).toBe('no_data')
    expect(unknown.changeImpact.suggested).toBeUndefined()
  })

  it('suggests inherent risk from the procedure seed', () => {
    const pool = buildRiskDerivationPool({ workspace: workspace({}), settings, yearArchives: {} })
    expect(deriveRiskFactors(pool, 'QP-03', 'dept-qa').inherentRisk.suggested).toBe(3)
    expect(deriveRiskFactors(pool, 'QP-99', 'dept-x', { seedFallback: '高' }).inherentRisk.suggested).toBe(5)
  })
})

describe('external source register → complaint／change factors', () => {
  const event = (id: string, extra: Partial<RiskSourceEvent> = {}): RiskSourceEvent => ({
    id,
    kind: 'customer_complaint',
    externalReference: `CC-${id}`,
    date: '2026-02-01',
    summary: '客訴',
    targets: [{ qpCode: QP, departmentId: DEPT }],
    createdAt: 'x',
    ...extra,
  })

  it('counts non-voided events in the period (previous year + this year) as a quantity', () => {
    const pool = buildRiskDerivationPool({
      workspace: workspace({ riskSourceEvents: [event('a'), event('v', { voidedAt: 'x', voidReason: '誤登' })] }),
      settings,
      yearArchives: {
        2025: { workspace: workspace({ riskSourceEvents: [event('p')] }), settings },
        2024: { workspace: workspace({ riskSourceEvents: [event('old')] }), settings },
      },
    })
    const result = deriveRiskFactors(pool, QP, DEPT).customerComplaintLevel
    expect(result.status).toBe('derived')
    expect(result.count).toBe(2)
    expect(result.suggested).toBe(3)
    expect(result.sources.map((s) => s.id).sort()).toEqual(['a', 'p'])
  })

  it('counts the same external reference only once', () => {
    const pool = buildRiskDerivationPool({
      workspace: workspace({ riskSourceEvents: [event('a', { externalReference: 'CC-1' }), event('b', { externalReference: ' cc-1 ' })] }),
      settings,
      yearArchives: {},
    })
    expect(deriveRiskFactors(pool, QP, DEPT).customerComplaintLevel.count).toBe(1)
  })

  it('treats a declared coverage with no events as 無, and no declaration as no data', () => {
    const declared = buildRiskDerivationPool({
      workspace: workspace({ riskSourceCoverage: { major_change: { checkedThrough: '2026-03-31', reference: 'ECN 清冊', recordedAt: 'x' } } }),
      settings,
      yearArchives: {},
    })
    const result = deriveRiskFactors(declared, QP, DEPT)
    expect(result.changeImpact.status).toBe('no_events')
    expect(result.changeImpact.suggested).toBe(1)
    expect(result.customerComplaintLevel.status).toBe('no_data')
  })

  it('counts only confirmed links; pending links block a 無事件 conclusion', () => {
    const coverage = { customer_complaint: { checkedThrough: '2026-03-31', reference: '客訴登錄表', recordedAt: 'x' } }
    const target = (linkStatus: 'pending' | 'confirmed' | 'not_applicable') => [{ qpCode: QP, departmentId: DEPT, linkStatus }]
    const pending = buildRiskDerivationPool({
      workspace: workspace({ riskSourceCoverage: coverage, riskSourceEvents: [event('a', { targets: target('pending') })] }),
      settings,
      yearArchives: {},
    })
    const blocked = deriveRiskFactors(pending, QP, DEPT).customerComplaintLevel
    expect(blocked.status).toBe('no_data')
    expect(blocked.note).toContain('1 件關聯待確認')

    const mixed = buildRiskDerivationPool({
      workspace: workspace({
        riskSourceEvents: [
          event('a', { externalReference: 'CC-1', targets: target('confirmed') }),
          event('b', { externalReference: 'CC-2', targets: target('pending') }),
          event('c', { externalReference: 'CC-3', targets: target('not_applicable') }),
        ],
      }),
      settings,
      yearArchives: {},
    })
    const counted = deriveRiskFactors(mixed, QP, DEPT).customerComplaintLevel
    expect(counted.count).toBe(1)
    expect(counted.note).toContain('另有 1 件關聯待確認')

    const notApplicable = buildRiskDerivationPool({
      workspace: workspace({ riskSourceCoverage: coverage, riskSourceEvents: [event('c', { targets: target('not_applicable') })] }),
      settings,
      yearArchives: {},
    })
    expect(deriveRiskFactors(notApplicable, QP, DEPT).customerComplaintLevel.status).toBe('no_events')
  })

  it('does not attribute an event to unrelated QP rows', () => {
    const pool = buildRiskDerivationPool({ workspace: workspace({ riskSourceEvents: [event('a')] }), settings, yearArchives: {} })
    expect(deriveRiskFactors(pool, 'QP-03', DEPT).customerComplaintLevel.status).toBe('no_data')
  })
})
