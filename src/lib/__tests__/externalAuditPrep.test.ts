import { describe, it, expect } from 'vitest'
import {
  createDefaultPrepState,
  countPrepProgress,
  evaluatePrepSequence,
  getPrepTemplate,
  isItemDone,
  migratePrepState,
  workspacePrepNotes,
  EXTERNAL_AUDIT_PREP_SEED,
  getManagementReviewCompletionBlockers,
} from '../externalAuditPrep'
import type { CompanyData } from '../../types'

const emptyWorkspace = (): CompanyData => ({
  name: '內部稽核工作區',
  departments: [],
  planRows: [],
  audits: [],
  ncrs: [],
  observations: [],
  suggestions: [],
})

const settings = {
  auditYear: 2026,
  leadAuditor: '王大明',
  yearStart: '2026-01-01',
  planWindowStart: '2026-02-01',
  planWindowEnd: '2026-11-30',
  scoringRules: { conform: 1, nonConform: 0, observation: 0.5 },
}

describe('EXTERNAL_AUDIT_PREP_SEED', () => {
  it('preserves the source checklist while using one completion state at runtime', () => {
    expect(EXTERNAL_AUDIT_PREP_SEED.items).toHaveLength(23)
    expect(EXTERNAL_AUDIT_PREP_SEED.items.some((item) => item.no === 13)).toBe(false)
    expect(EXTERNAL_AUDIT_PREP_SEED.items.find((item) => item.no === 15)?.notes).toContain('九潤精密科技')
  })
})

describe('external preparation completion', () => {
  it('uses only one completion flag for every checklist item', () => {
    const template = getPrepTemplate(1)!
    const prep = createDefaultPrepState(2026)
    const item = prep.items[0]
    expect(isItemDone(template, item)).toBe(false)
    expect(isItemDone(template, { ...item, completed: true })).toBe(true)
  })

  it('counts completed items without company or relationship gates', () => {
    const prep = createDefaultPrepState(2026)
    prep.items[0].completed = true
    prep.items[1].completed = true
    expect(countPrepProgress(prep)).toEqual({ done: 2, total: 23 })
  })
})

describe('evaluatePrepSequence', () => {
  it('shows one workspace-wide open NCR count with generic wording', () => {
    const prep = createDefaultPrepState(2026)
    const workspace = emptyWorkspace()
    workspace.ncrs = [{
      id: 'n1', ncrNumber: 'NCR-1', qpCode: 'QP-01', departmentId: 'd1',
      department: '品保', process: 'p', description: 'd', date: '2026-01-01',
      status: '矯正中', rootCause: '', correctiveAction: '', verificationEvidence: '',
    }]
    const result = evaluatePrepSequence({ prep, workspace, settings, yearArchives: {} })
    expect(result).toMatchObject({ ncrWarning: true, openNcrCount: 1 })
    expect(result.messages[0]).toContain('仍有 1 筆未結 NCR')
    expect(result.messages.join(' ')).not.toMatch(/九潤|正隆興|另一家公司/)
  })

  it('warns when management review is marked complete before the internal audit', () => {
    const prep = createDefaultPrepState(2026)
    prep.managementReviewComplete = true
    const result = evaluatePrepSequence({ prep, workspace: emptyWorkspace(), settings, yearArchives: {} })
    expect(result.sequenceWarning).toBe(true)
    expect(result.messages.some((message) => message.includes('管理審查'))).toBe(true)
  })

  it('does not warn about sequence when management review is not marked complete', () => {
    const prep = createDefaultPrepState(2026)
    const result = evaluatePrepSequence({ prep, workspace: emptyWorkspace(), settings, yearArchives: {} })
    expect(result.sequenceWarning).toBe(false)
  })

  it('warns when the preparation date conflicts with the planned management review and audit window', () => {
    const prep = createDefaultPrepState(2026)
    prep.externalAuditDate = '2026-09-15'
    const result = evaluatePrepSequence({
      prep,
      workspace: emptyWorkspace(),
      settings: { ...settings, managementReviewDate: '2026-12-10', externalAuditDate: undefined },
      yearArchives: {},
    })

    expect(result.sequenceWarning).toBe(true)
    expect(result.sequenceMessages).toContain('管理審查日期應早於外部稽核日期（內稽 → 管審 → 外稽）。')
    expect(result.sequenceMessages).toContain('年度計畫窗口結束月（11 月）晚於外部稽核月（9 月），請調整計畫或外稽日期。')
  })
})

describe('management review completion guard', () => {
  it('reports incomplete internal audit and missing or invalid management review dates', () => {
    expect(getManagementReviewCompletionBlockers({
      internalAuditComplete: false,
      managementReviewDate: '2026-08-10',
    })).toEqual(['完成當年度內部稽核'])
    expect(getManagementReviewCompletionBlockers({
      internalAuditComplete: true,
      managementReviewDate: '',
    })).toEqual(['填寫有效的管審日期'])
    expect(getManagementReviewCompletionBlockers({
      internalAuditComplete: true,
      managementReviewDate: 'not-a-date',
    })).toEqual(['填寫有效的管審日期'])
  })

  it('allows completion before the external audit date is known', () => {
    expect(getManagementReviewCompletionBlockers({
      internalAuditComplete: true,
      managementReviewDate: '2026-08-10',
    })).toEqual([])
  })

  it('requires the management review date to precede a known external audit date', () => {
    expect(getManagementReviewCompletionBlockers({
      internalAuditComplete: true,
      managementReviewDate: '2026-08-10',
      externalAuditDate: '2026-09-15',
    })).toEqual([])
    expect(getManagementReviewCompletionBlockers({
      internalAuditComplete: true,
      managementReviewDate: '2026-09-15',
      externalAuditDate: '2026-09-15',
    })).toEqual(['將管審日期調整至外稽日期前'])
    expect(getManagementReviewCompletionBlockers({
      internalAuditComplete: true,
      managementReviewDate: '2026-12-10',
      externalAuditDate: '2026-09-15',
    })).toEqual(['將管審日期調整至外稽日期前'])
    expect(getManagementReviewCompletionBlockers({
      internalAuditComplete: true,
      managementReviewDate: '2026-08-10',
      externalAuditDate: 'not-a-date',
    })).toEqual(['填寫有效的外稽日期'])
  })
})

describe('migratePrepState', () => {
  it('preserves boolean sequence flags and defaults removed schedule data to empty', () => {
    const migrated = migratePrepState({
      year: 2026,
      internalAuditComplete: true,
      managementReviewComplete: false,
    })
    expect(migrated.internalAuditComplete).toBe(true)
    expect(migrated.managementReviewComplete).toBe(false)
    expect(migrated.onsiteSlots).toEqual([])
  })

  it('keeps old split flags complete only when both sources were checked', () => {
    const complete = migratePrepState({
      internalAuditComplete: { jiurun: true, zhenglongxing: true },
      managementReviewComplete: { jiurun: true, zhenglongxing: false },
    } as Parameters<typeof migratePrepState>[0])
    expect(complete.internalAuditComplete).toBe(true)
    expect(complete.managementReviewComplete).toBe(false)
  })
})

describe('workspacePrepNotes', () => {
  it('removes only legacy sentences and keeps neighboring shared guidance', () => {
    expect(workspacePrepNotes(
      '年度校正項目別勿漏校；校驗帳可合併；進料／出貨檢驗放行見項 21 分開備查。',
    )).toBe('年度校正項目別勿漏校；進料／出貨檢驗放行見項 21 分開備查。')
    expect(workspacePrepNotes('部門紀錄含法人與共用兩類，合併勾選前須確認抬頭規則。')).toBe('')
    expect(workspacePrepNotes(
      '氣候變遷要加入風險評估。廠區／氣候風險可合併；產品／客戶相關風險須標適用公司。',
    )).toBe('氣候變遷要加入風險評估。')
  })
})
