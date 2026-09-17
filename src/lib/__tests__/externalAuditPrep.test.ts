import { describe, it, expect } from 'vitest'
import {
  createDefaultPrepState,
  countPrepProgress,
  evaluatePrepSequence,
  getPrepTemplate,
  isItemDone,
  itemHasCallout,
  EXTERNAL_AUDIT_PREP_SEED,
  DEFAULT_COMPANY_RELATIONSHIPS,
} from '../externalAuditPrep'
import { relationshipCheckKey } from '../../types'
import type { CompanyData } from '../../types'

const emptyCompany = (): CompanyData => ({
  name: '測試',
  departments: [],
  planRows: [],
  audits: [],
  ncrs: [],
  observations: [],
  suggestions: [],
})

const baseSettings = {
  auditYear: 2026,
  leadAuditor: '王大明',
  yearStart: '2026-01-01',
  planWindowStart: '2026-02-01',
  planWindowEnd: '2026-11-30',
  scoringRules: { conform: 1, nonConform: 0, observation: 0.5 },
}

describe('EXTERNAL_AUDIT_PREP_SEED', () => {
  it('has 19 prep items (no item 13) with expected scope modes', () => {
    expect(EXTERNAL_AUDIT_PREP_SEED.items).toHaveLength(19)
    const modes = EXTERNAL_AUDIT_PREP_SEED.items.map((i) => i.scope.mode)
    expect(modes.filter((m) => m === 'both_separate').length).toBeGreaterThan(0)
    expect(modes.filter((m) => m === 'merged').length).toBeGreaterThan(0)
    expect(modes.filter((m) => m === 'site_scope').length).toBe(2)
  })

  it('uses verbatim auditor titles without rewriting', () => {
    const item15 = EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.no === 15)
    expect(item15?.title).toContain('客戶滿意度調查統計及分析')
    expect(item15?.notes).toContain('九潤精密科技')
  })
})

describe('isItemDone', () => {
  it('both_separate requires both companies', () => {
    const template = getPrepTemplate(1)!
    const prep = createDefaultPrepState(2026)
    const state = prep.items[0]
    expect(isItemDone(template, state, prep)).toBe(false)
    expect(isItemDone(template, { ...state, jiurunDone: true }, prep)).toBe(false)
    expect(
      isItemDone(template, { ...state, jiurunDone: true, zhenglongxingDone: true }, prep),
    ).toBe(true)
  })

  it('item 15 requires relationship check even when both company columns are checked', () => {
    const template = getPrepTemplate(15)!
    const prep = createDefaultPrepState(2026)
    const state = prep.items.find((item) => item.no === 15)!
    state.jiurunDone = true
    state.zhenglongxingDone = true
    expect(isItemDone(template, state, prep)).toBe(false)
    const gate = DEFAULT_COMPANY_RELATIONSHIPS[0]
    prep.relationshipChecks[relationshipCheckKey(gate.from, gate.to, gate.relation)] = true
    expect(isItemDone(template, state, prep)).toBe(true)
  })

  it('merged uses mergedDone only', () => {
    const template = getPrepTemplate(2)!
    const prep = createDefaultPrepState(2026)
    const state = prep.items.find((i) => i.no === 2)!
    expect(isItemDone(template, state, prep)).toBe(false)
    expect(isItemDone(template, { ...state, mergedDone: true }, prep)).toBe(true)
  })

  it('site_scope uses completed flag', () => {
    const template = getPrepTemplate(17)!
    const prep = createDefaultPrepState(2026)
    const state = prep.items.find((i) => i.no === 17)!
    expect(isItemDone(template, state, prep)).toBe(false)
    expect(isItemDone(template, { ...state, completed: true }, prep)).toBe(true)
  })
})

describe('countPrepProgress', () => {
  it('counts completed items across scope modes', () => {
    const prep = createDefaultPrepState(2026)
    prep.items[0].jiurunDone = true
    prep.items[0].zhenglongxingDone = true
    prep.items[1].mergedDone = true
    const { done, total } = countPrepProgress(prep)
    expect(total).toBe(19)
    expect(done).toBe(2)
  })
})

describe('evaluatePrepSequence', () => {
  it('warns when open NCRs exist with per-company counts', () => {
    const prep = createDefaultPrepState(2026)
    const companies = {
      jiurun: {
        ...emptyCompany(),
        ncrs: [
          {
            id: 'n1',
            ncrNumber: 'NCR-1',
            qpCode: 'QP-01',
            departmentId: 'd1',
            department: '品保',
            process: 'p',
            description: 'd',
            date: '2026-01-01',
            status: '矯正中' as const,
          },
        ],
      },
      zhenglongxing: emptyCompany(),
    }
    const result = evaluatePrepSequence({
      prep,
      companies,
      companySettings: {
        jiurun: baseSettings,
        zhenglongxing: baseSettings,
      },
      yearArchives: {},
    })
    expect(result.ncrWarning).toBe(true)
    expect(result.openNcrCount).toBe(1)
    expect(result.openNcrByCompany.jiurun).toBe(1)
    expect(result.messages.some((m) => m.includes('九潤 1'))).toBe(true)
  })

  it('warns when management review done before internal audit for a company', () => {
    const prep = createDefaultPrepState(2026)
    prep.managementReviewComplete.jiurun = true
    prep.internalAuditComplete.jiurun = false
    const result = evaluatePrepSequence({
      prep,
      companies: { jiurun: emptyCompany(), zhenglongxing: emptyCompany() },
      companySettings: { jiurun: baseSettings, zhenglongxing: baseSettings },
      yearArchives: {},
    })
    expect(result.sequenceWarning).toBe(true)
    expect(result.messages.some((m) => m.includes('管理審查'))).toBe(true)
  })

  it('no sequence warning when order is correct', () => {
    const prep = createDefaultPrepState(2026)
    prep.internalAuditComplete = { jiurun: true, zhenglongxing: true }
    prep.managementReviewComplete = { jiurun: true, zhenglongxing: true }
    const result = evaluatePrepSequence({
      prep,
      companies: { jiurun: emptyCompany(), zhenglongxing: emptyCompany() },
      companySettings: { jiurun: baseSettings, zhenglongxing: baseSettings },
      yearArchives: {},
    })
    expect(result.sequenceWarning).toBe(false)
  })
})

describe('itemHasCallout', () => {
  it('returns callout types for items 3, 5, 15', () => {
    expect(itemHasCallout(3)).toBe('quality-objectives')
    expect(itemHasCallout(5)).toBe('risk-climate')
    expect(itemHasCallout(15)).toBe('satisfaction')
    expect(itemHasCallout(1)).toBeNull()
  })
})
