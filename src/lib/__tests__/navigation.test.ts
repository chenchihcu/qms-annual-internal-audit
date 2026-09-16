import { describe, expect, it } from 'vitest'
import { ALL_TABS, TAB_GROUPS, buildAppHash, getTabWorkflow, parseAppHash, TAB_WORKFLOW } from '../navigation'

describe('workflow navigation/form mapping', () => {
  it('keeps one sidebar entry and one semantic form for each workflow page', () => {
    const entries = ALL_TABS.filter((entry) => entry.id !== 'dashboard')
    const formIds = entries.map((entry) => entry.formId)

    expect(entries).toHaveLength(11)
    expect(formIds.every((id): id is string => Boolean(id))).toBe(true)
    expect(new Set(formIds).size).toBe(entries.length)
    expect(TAB_GROUPS.flatMap((group) => group.tabs)).toHaveLength(12)
  })

  it('keeps the dashboard as the overview entry without a workflow form', () => {
    expect(ALL_TABS.find((entry) => entry.id === 'dashboard')?.formId).toBeUndefined()
  })

  it('orders menu stages as PDCA audit workflow', () => {
    expect(TAB_GROUPS.map((group) => group.label)).toEqual([
      '總覽',
      'P · 方案規劃',
      'D · 稽核執行',
      'C · 結果與改善',
      'A · 結案與改進',
      '系統管理',
    ])
    expect(ALL_TABS.map((entry) => entry.label)).toEqual([
      '稽核總覽',
      '標準',
      '程序',
      '方案風險與優先順序',
      '年度稽核計畫',
      '稽核員能力與任命',
      '稽核執行與證據',
      '不符合與矯正措施',
      '觀察事項與追蹤',
      '改善機會與建議',
      '外部稽核前準備與序位',
      '系統設定',
    ])
  })

  it('maps the former settings hash to the system settings form', () => {
    expect(parseAppHash('#tab=settings').tab).toBe('system-settings')
  })

  it('parses and builds audit deep-link hash', () => {
    expect(parseAppHash('#tab=audit&audit=audit-2026-QP-28-dept-qa')).toEqual({
      tab: 'audit',
      auditKey: 'audit-2026-QP-28-dept-qa',
    })
    expect(buildAppHash('audit', 'event-1')).toBe('#tab=audit&audit=event-1')
  })

  it('defines workflow metadata for every tab in PDCA order', () => {
    expect(TAB_WORKFLOW).toHaveLength(12)
    expect(getTabWorkflow('procedure')?.nextTab).toBe('risk')
    expect(getTabWorkflow('risk')?.nextTab).toBe('plan')
    expect(getTabWorkflow('plan')?.prevTab).toBe('risk')
    expect(getTabWorkflow('personnel')?.nextTab).toBe('audit')
    expect(getTabWorkflow('suggestions')?.nextTab).toBe('prep')
    expect(getTabWorkflow('system-settings')?.nextTab).toBe('dashboard')
  })
})
