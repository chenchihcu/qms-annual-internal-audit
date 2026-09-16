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

  it('orders menu stages as an executable ISO-oriented audit workflow', () => {
    expect(TAB_GROUPS.map((group) => group.label)).toEqual([
      '總覽',
      '0 · 受控準則與程序',
      '1 · 稽核方案管理',
      '2 · 稽核資源與準備',
      '3 · 稽核活動執行',
      '4 · 稽核結果與改善',
      '系統管理',
    ])
    expect(ALL_TABS.map((entry) => entry.label)).toEqual([
      '稽核總覽',
      '標準',
      '程序',
      '年度稽核計畫',
      '方案風險與優先順序',
      '稽核員能力與任命',
      '稽核啟動與活動準備',
      '稽核執行與證據',
      '不符合與矯正措施',
      '觀察事項與追蹤',
      '改善機會與建議',
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

  it('defines workflow metadata for every tab', () => {
    expect(TAB_WORKFLOW).toHaveLength(12)
    expect(getTabWorkflow('plan')?.nextTab).toBe('risk')
    expect(getTabWorkflow('risk')?.prevTab).toBe('plan')
  })
})
