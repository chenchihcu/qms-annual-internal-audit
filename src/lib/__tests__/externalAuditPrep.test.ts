import { describe, it, expect } from 'vitest'

import {

  createDefaultPrepState,

  countPrepProgress,

  ensurePrepItems,

  evaluatePrepSequence,

  getPrepTemplateById,

  headerRuleMatchesScope,

  isItemDone,

  itemHasCallout,

  listPrepGaps,

  summarizePrepGaps,

  EXTERNAL_AUDIT_PREP_SEED,

} from '../externalAuditPrep'

import type { CompanyData } from '../../types'

import { createDemoState } from '../../data/demoData'

import { PROCEDURE_PLAN_TEMPLATE } from '../../data/procedurePlan'

import { createChecklistForProcedure } from '../../data/checklistLoader'



const emptyCompany = (): CompanyData => ({

  name: '測試',

  departments: [],

  planRows: [],

  audits: [],

  ncrs: [],

  observations: [],

  suggestions: [],

})



function completeAllAudits(company: CompanyData): CompanyData {

  const audits = PROCEDURE_PLAN_TEMPLATE.map((entry) => {

    const items = createChecklistForProcedure(entry.qpCode, entry.departmentName).map((item) => ({

      ...item,

      judgment: '符合' as const,

      description: '',

    }))

    return {

      id: `audit-${entry.qpCode}-${entry.departmentId}`,

      qpCode: entry.qpCode,

      departmentId: entry.departmentId,

      department: entry.departmentName,

      process: entry.process,

      documents: entry.documents,

      notifyDate: '2026-01-01',

      auditDate: '2026-01-15',

      departmentManager: '主管',

      auditors: '稽核員',

      auditCategory: entry.auditCategory,

      items,

    }

  })

  return {

    ...company,

    planRows: PROCEDURE_PLAN_TEMPLATE.map((entry, idx) => ({

      id: `plan-${entry.qpCode}-${entry.departmentId}`,

      qpCode: entry.qpCode,

      departmentId: entry.departmentId,

      sequence: idx + 1,

      riskLevel: entry.riskLevel ?? '低',

      department: entry.departmentName,

      process: entry.process,

      documents: entry.documents,

      auditUnit: '品保部',

      owner: entry.owner,

      auditors: '稽核員',

      auditCategory: entry.auditCategory,

      months: ['滿意', null, null, null, null, null, null, null, null, null, null, null],

      manualOverride: false,

    })),

    audits,

  }

}



describe('EXTERNAL_AUDIT_PREP_SEED', () => {

  it('has 23 flat prep rows including item 2/18 sub-rows', () => {

    expect(EXTERNAL_AUDIT_PREP_SEED.items).toHaveLength(23)

    expect(EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.id === 'prep-2-a')).toBeTruthy()

    expect(EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.id === 'prep-2-b')?.ncrGate).toBe('open_any')

    expect(EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.id === 'prep-18-b')?.scope.mode).toBe('merged')

    expect(EXTERNAL_AUDIT_PREP_SEED.certificateModel).toBe('two_certificates_combined_audit')

  })



  it('uses verbatim auditor titles without rewriting', () => {

    const item15 = EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.id === 'prep-15')

    expect(item15?.title).toContain('客戶滿意度調查統計及分析')

    expect(item15?.notes).toContain('九潤精密科技')

  })



  it('every item has headerRule matching scope mode and doneWhen', () => {

    for (const item of EXTERNAL_AUDIT_PREP_SEED.items) {

      expect(item.headerRule).toBeTruthy()

      expect(item.doneWhen).toBeTruthy()

      expect(headerRuleMatchesScope(item)).toBe(true)

    }

  })

})



describe('ensurePrepItems', () => {

  it('migrates legacy prep-2 to prep-2-a and adds new sub-rows', () => {

    const state = createDefaultPrepState(2026)

    const legacy = {

      ...state,

      items: state.items

        .filter((i) => i.id !== 'prep-2-a' && i.id !== 'prep-2-b' && i.id !== 'prep-2-c')

        .map((item) =>

          item.id === 'prep-2-a'

            ? { ...item, id: 'prep-2', mergedDone: true, remark: 'legacy' }

            : item,

        ),

    }

    const hydrated = ensurePrepItems({

      ...legacy,

      items: [

        ...legacy.items.filter((i) => i.id !== 'prep-2-a'),

        {

          id: 'prep-2',

          no: 2,

          jiurunDone: false,

          zhenglongxingDone: false,

          mergedDone: true,

          completed: false,

          remark: 'legacy',

        },

      ],

    })

    const item2a = hydrated.items.find((i) => i.id === 'prep-2-a')

    expect(item2a?.mergedDone).toBe(true)

    expect(item2a?.remark).toBe('legacy')

    expect(hydrated.items.some((i) => i.id === 'prep-2-b')).toBe(true)

    expect(hydrated.items.length).toBe(23)

  })



  it('adds missing prep rows without dropping existing', () => {

    const state = createDefaultPrepState(2026)

    const trimmed = { ...state, items: state.items.filter((i) => i.id !== 'prep-21') }

    const hydrated = ensurePrepItems(trimmed)

    expect(hydrated.items.some((i) => i.id === 'prep-21')).toBe(true)

    expect(hydrated.items.length).toBe(23)

  })

})



describe('isItemDone', () => {

  const context = () => {

    const demo = createDemoState()

    return {

      company: completeAllAudits(demo.company),

      rules: demo.settings.scoringRules,

    }

  }



  it('both_separate requires both companies', () => {

    const template = getPrepTemplateById('prep-1')!

    const state = createDefaultPrepState(2026).items.find((i) => i.id === 'prep-1')!

    expect(isItemDone(template, state)).toBe(false)

    expect(isItemDone(template, { ...state, jiurunDone: true })).toBe(false)

    expect(

      isItemDone(template, { ...state, jiurunDone: true, zhenglongxingDone: true }, context()),

    ).toBe(true)

  })



  it('merged uses mergedDone only', () => {

    const template = getPrepTemplateById('prep-2-a')!

    const state = createDefaultPrepState(2026).items.find((i) => i.id === 'prep-2-a')!

    expect(isItemDone(template, state, context())).toBe(false)

    expect(isItemDone(template, { ...state, mergedDone: true }, context())).toBe(true)

  })



  it('hard gate blocks when linked QP audits incomplete', () => {

    const template = getPrepTemplateById('prep-1')!

    const state = createDefaultPrepState(2026).items.find((i) => i.id === 'prep-1')!

    const checked = { ...state, jiurunDone: true, zhenglongxingDone: true }

    expect(isItemDone(template, checked, { company: emptyCompany() })).toBe(false)

  })



  it('prep-2-b not done when any open NCR exists even if checked', () => {

    const template = getPrepTemplateById('prep-2-b')!

    const state = createDefaultPrepState(2026).items.find((i) => i.id === 'prep-2-b')!

    const checked = { ...state, jiurunDone: true, zhenglongxingDone: true }

    const ctx = context()

    expect(isItemDone(template, checked, ctx)).toBe(false)

    expect(

      isItemDone(template, checked, {

        ...ctx,

        company: { ...ctx.company, ncrs: [] },

      }),

    ).toBe(true)

  })



  it('site_scope uses completed flag', () => {

    const template = getPrepTemplateById('prep-17')!

    const state = createDefaultPrepState(2026).items.find((i) => i.id === 'prep-17')!

    expect(isItemDone(template, state, context())).toBe(false)

    expect(isItemDone(template, { ...state, completed: true }, context())).toBe(true)

  })

})



describe('countPrepProgress', () => {

  it('counts completed items across scope modes with hard gate', () => {

    const prep = createDefaultPrepState(2026)

    const demo = createDemoState()

    const company = completeAllAudits(demo.company)

    company.ncrs = []

    prep.items.find((i) => i.id === 'prep-1')!.jiurunDone = true

    prep.items.find((i) => i.id === 'prep-1')!.zhenglongxingDone = true

    const { done, total } = countPrepProgress(

      prep,

      company,

      demo.settings.auditYear,

      demo.settings.scoringRules,

    )

    expect(total).toBe(23)

    expect(done).toBeGreaterThanOrEqual(1)

  })

})



describe('evaluatePrepSequence', () => {

  const settings = createDemoState().settings



  it('warns when open NCRs exist', () => {

    const prep = createDefaultPrepState(2026)

    const company = {
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
    }

    const result = evaluatePrepSequence(prep, company, settings)

    expect(result.ncrWarning).toBe(true)

    expect(result.openNcrCount).toBe(1)

    expect(result.messages.some((m) => m.includes('NCR'))).toBe(true)

  })



  it('warns when audited products missing with external date set', () => {

    const prep = createDefaultPrepState(2026)

    const result = evaluatePrepSequence(

      prep,

      emptyCompany(),

      settings,

    )

    expect(result.auditedProductsWarning).toBe(true)

    expect(result.messages.some((m) => m.includes('受稽產品'))).toBe(true)

  })



  it('warns when management review done before internal audit', () => {

    const prep = createDefaultPrepState(2026)

    prep.managementReviewComplete = true

    const result = evaluatePrepSequence(prep, emptyCompany(), settings)

    expect(result.sequenceWarning).toBe(true)

    expect(result.internalAuditComplete).toBe(false)

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



describe('listPrepGaps', () => {

  it('detects half-done separate items when only jiurun checked', () => {

    const prep = createDefaultPrepState(2026)

    const item7 = prep.items.find((i) => i.id === 'prep-7')!

    item7.jiurunDone = true

    const gaps = listPrepGaps(prep)

    expect(gaps.separateHalfDone).toHaveLength(1)

    expect(gaps.separateHalfDone[0].missing).toBe('zhenglongxing')

    expect(isItemDone(getPrepTemplateById('prep-7')!, item7)).toBe(false)

  })



  it('tracks qpBlocked when scope checked but QP incomplete', () => {

    const prep = createDefaultPrepState(2026)

    const item1 = prep.items.find((i) => i.id === 'prep-1')!

    item1.jiurunDone = true

    item1.zhenglongxingDone = true

    const gaps = listPrepGaps(prep, {

      company: emptyCompany(),

    })

    expect(gaps.qpBlocked.some((g) => g.id === 'prep-1')).toBe(true)

  })



  it('summarizePrepGaps produces dashboard lines', () => {

    const prep = createDefaultPrepState(2026)

    const item7 = prep.items.find((i) => i.id === 'prep-7')!

    item7.jiurunDone = true

    const lines = summarizePrepGaps(prep, undefined, 5)

    expect(lines.some((l) => l.text.includes('缺正隆興'))).toBe(true)

  })

})


