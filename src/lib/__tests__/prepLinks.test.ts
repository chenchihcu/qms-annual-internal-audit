import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY, createDemoState } from '../../data/demoData'
import { useAuditStore } from '../../hooks/useAuditStore'
import {
  EXTERNAL_AUDIT_PREP_SEED,
  countPrepProgress,
  effectiveExternalAuditDate,
  hasManagementReviewMismatch,
  prepItemCompleted,
} from '../externalAuditPrep'
import { prepLinkedAudits, prepSystemHints, prepTemplatesForAudit } from '../prepLinks'
import { scoreProcedureAudit } from '../scoring'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

/** 23 項準備事項 → 年度計畫查檢表的核准對照（計畫書 1.4 節）。 */
const EXPECTED_LINKS: Record<string, string[]> = {
  'prep-1': ['QP-08 品保部'],
  'prep-2-a': ['QP-28 品保部'],
  'prep-2-b': ['QP-28 品保部'],
  'prep-2-c': ['QP-28 品保部'],
  'prep-3': ['QP-03 品保部'],
  'prep-4': ['QP-03 品保部'],
  'prep-5': ['QP-02 品保部'],
  'prep-6': ['QP-03 品保部'],
  'prep-7': ['QP-01 品保部'],
  'prep-8': ['QP-08 品保部'],
  'prep-9': ['QP-09 品保部'],
  'prep-10': ['QP-04 生產製造部'],
  'prep-11': ['QP-26 生產製造部'],
  'prep-12': ['QP-06 管理部'],
  'prep-14': ['QP-11 開發工程部', 'QP-14 開發工程部'],
  'prep-15': ['QP-16 業務部', 'QP-16 品保部'],
  'prep-16': ['QP-17 管理部', 'QP-18 管理部'],
  'prep-17': ['QP-24 管理部'],
  'prep-18-a': ['QR-28-04 生產製造部'],
  'prep-18-b': ['QP-04 生產製造部'],
  'prep-19': ['QP-05 品保部'],
  'prep-20': ['QP-10 開發工程部'],
  'prep-21': ['QP-19 品保部', 'QP-25 品保部'],
}

describe('prepLinkedAudits', () => {
  it('maps all 23 preparation items to existing annual-plan checklists', () => {
    const state = createDemoState()
    expect(EXTERNAL_AUDIT_PREP_SEED.items).toHaveLength(23)
    for (const template of EXTERNAL_AUDIT_PREP_SEED.items) {
      const links = prepLinkedAudits(template, state.workspace.planRows)
      expect(links.every((link) => Boolean(link.auditKey)), template.id).toBe(true)
      expect(links.map((link) => `${link.qpCode} ${link.department}`), template.id)
        .toEqual(EXPECTED_LINKS[template.id!])
    }
  })

  it('keeps a missing plan row visible instead of dropping the link', () => {
    const state = createDemoState()
    const template = EXTERNAL_AUDIT_PREP_SEED.items.find((item) => item.id === 'prep-1')!
    const links = prepLinkedAudits(template, state.workspace.planRows.filter((row) => row.qpCode !== 'QP-08'))
    expect(links).toEqual([{ qpCode: 'QP-08', department: '' }])
  })

  it('lists preparation items for one checklist in seed order', () => {
    const state = createDemoState()
    const qp03 = state.workspace.planRows.find((row) => row.qpCode === 'QP-03')!
    expect(prepTemplatesForAudit('QP-03', qp03.departmentId, state.workspace.planRows).map((item) => item.id))
      .toEqual(['prep-3', 'prep-4', 'prep-6'])
  })
})

describe('prepSystemHints', () => {
  it('derives NCR, coverage and appointment hints without changing completion', () => {
    const state = createDemoState()
    const before = JSON.stringify(state.externalAuditPrep)
    const hints = prepSystemHints(state)
    expect(hints['prep-2-b'].target).toBe('ncr')
    expect(hints['prep-2-c'].text).toMatch(/NCR/)
    expect(hints['prep-2-a'].text).toMatch(/已回報 \d+\/\d+/)
    expect(hints['prep-4'].text).toMatch(/管審前置/)
    expect(hints['prep-7'].target).toBe('personnel')
    expect(JSON.stringify(state.externalAuditPrep)).toBe(before)
  })
})

describe('shared read rules', () => {
  it('reads the external audit date with one rule', () => {
    expect(effectiveExternalAuditDate({ externalAuditDate: ' ' }, { externalAuditDate: '2026-09-15' })).toBe('2026-09-15')
    expect(effectiveExternalAuditDate({ externalAuditDate: '2026-10-01' }, { externalAuditDate: '2026-09-15' })).toBe('2026-10-01')
    expect(effectiveExternalAuditDate({}, {})).toBe('')
  })

  it('reads item 4 from the sequence flag and flags disagreement', () => {
    const state = createDemoState()
    const prep = state.externalAuditPrep
    const item4 = prep.items.find((item) => item.id === 'prep-4')!
    prep.managementReviewComplete = false
    item4.completed = true
    expect(hasManagementReviewMismatch(prep)).toBe(true)
    expect(prepItemCompleted(prep, item4)).toBe(false)
    const doneBefore = countPrepProgress(prep).done
    prep.managementReviewComplete = true
    expect(countPrepProgress(prep).done).toBe(doneBefore + 1)
    expect(hasManagementReviewMismatch(prep)).toBe(false)
  })
})

describe('store single control for item 4', () => {
  it('writes both stored fields together and leaves checklist scores untouched', () => {
    const demo = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    const scoresBefore = result.current.state.company.audits.map((audit) => (
      scoreProcedureAudit(audit, result.current.state.settings.scoringRules)
    ))

    act(() => result.current.setManagementReviewComplete(true))
    const prep = result.current.state.externalAuditPrep
    expect(prep.managementReviewComplete).toBe(true)
    expect(prep.items.find((item) => item.id === 'prep-4')?.completed).toBe(true)

    act(() => result.current.updateExternalPrepItem('prep-1', { completed: true, remark: '已發行' }))
    expect(result.current.state.externalAuditPrep.items.find((item) => item.id === 'prep-1'))
      .toMatchObject({ completed: true, remark: '已發行' })
    expect(result.current.state.company.audits.map((audit) => (
      scoreProcedureAudit(audit, result.current.state.settings.scoringRules)
    ))).toEqual(scoresBefore)

    act(() => result.current.setManagementReviewComplete(false))
    expect(result.current.state.externalAuditPrep.managementReviewComplete).toBe(false)
    expect(result.current.state.externalAuditPrep.items.find((item) => item.id === 'prep-4')?.completed).toBe(false)
  })
})
