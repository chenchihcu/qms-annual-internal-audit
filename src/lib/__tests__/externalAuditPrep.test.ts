import { describe, it, expect } from 'vitest'
import {
  createDefaultPrepState,
  countPrepProgress,
  evaluatePrepSequence,
  getPrepTemplate,
  isItemDone,
  itemHasCallout,
  EXTERNAL_AUDIT_PREP_SEED,
} from '../externalAuditPrep'
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
    const state = createDefaultPrepState(2026).items[0]
    expect(isItemDone(template, state)).toBe(false)
    expect(isItemDone(template, { ...state, jiurunDone: true })).toBe(false)
    expect(
      isItemDone(template, { ...state, jiurunDone: true, zhenglongxingDone: true }),
    ).toBe(true)
  })

  it('merged uses mergedDone only', () => {
    const template = getPrepTemplate(2)!
    const state = createDefaultPrepState(2026).items.find((i) => i.no === 2)!
    expect(isItemDone(template, state)).toBe(false)
    expect(isItemDone(template, { ...state, mergedDone: true })).toBe(true)
  })

  it('site_scope uses completed flag', () => {
    const template = getPrepTemplate(17)!
    const state = createDefaultPrepState(2026).items.find((i) => i.no === 17)!
    expect(isItemDone(template, state)).toBe(false)
    expect(isItemDone(template, { ...state, completed: true })).toBe(true)
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
  it('warns when open NCRs exist', () => {
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
    const result = evaluatePrepSequence(prep, companies)
    expect(result.ncrWarning).toBe(true)
    expect(result.openNcrCount).toBe(1)
    expect(result.messages.some((m) => m.includes('NCR'))).toBe(true)
  })

  it('warns when management review done before internal audit', () => {
    const prep = createDefaultPrepState(2026)
    prep.managementReviewComplete = true
    prep.internalAuditComplete = false
    const result = evaluatePrepSequence(prep, {
      jiurun: emptyCompany(),
      zhenglongxing: emptyCompany(),
    })
    expect(result.sequenceWarning).toBe(true)
    expect(result.messages.some((m) => m.includes('管理審查'))).toBe(true)
  })

  it('no sequence warning when order is correct', () => {
    const prep = createDefaultPrepState(2026)
    prep.internalAuditComplete = true
    prep.managementReviewComplete = true
    const result = evaluatePrepSequence(prep, {
      jiurun: emptyCompany(),
      zhenglongxing: emptyCompany(),
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
