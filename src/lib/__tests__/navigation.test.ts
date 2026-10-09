import { describe, expect, it } from 'vitest'
import { ALL_TABS, SIDEBAR_TABS, TAB_GROUPS, buildAppHash, getTabWorkflow, parseAppHash, sidebarTabFor, TAB_WORKFLOW } from '../navigation'

describe('workflow navigation/form mapping', () => {
  it('keeps one sidebar entry and one semantic form for each workflow page', () => {
    const entries = ALL_TABS.filter((entry) => entry.id !== 'dashboard')
    const formIds = entries.map((entry) => entry.formId)

    expect(entries).toHaveLength(11)
    expect(formIds.every((id): id is string => Boolean(id))).toBe(true)
    expect(new Set(formIds).size).toBe(entries.length)
    expect(TAB_GROUPS.flatMap((group) => group.tabs)).toHaveLength(12)
    expect(ALL_TABS.every((entry) => Boolean(entry.icon))).toBe(true)
    expect(TAB_GROUPS.every((group) => Boolean(group.icon))).toBe(true)
  })

  it('folds the external prep view into the checklist sidebar entry', () => {
    expect(SIDEBAR_TABS).toHaveLength(11)
    expect(SIDEBAR_TABS.some((entry) => entry.id === 'prep')).toBe(false)
    expect(sidebarTabFor('prep')).toBe('audit')
    expect(sidebarTabFor('ncr')).toBe('ncr')
    expect(parseAppHash('#tab=prep').tab).toBe('prep')
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
      '利害關係人',
      '方案風險',
      '人員合格名單',
      '年度稽核計畫',
      '查檢表',
      '觀察事項',
      '不符合',
      '第三方建議',
      '待改善追蹤',
      '外稽準備',
      '系統設定',
    ])
  })

  it('redirects removed page hashes to the remaining workflow entry points', () => {
    expect(parseAppHash('#tab=settings').tab).toBe('system-settings')
    expect(parseAppHash('#tab=standard').tab).toBe('system-settings')
    expect(parseAppHash('#tab=procedure').tab).toBe('system-settings')
    expect(parseAppHash('#tab=schedule&audit=audit-1')).toEqual({
      tab: 'audit',
      auditKey: 'audit-1',
    })
    expect(parseAppHash('#tab=onsite').tab).toBe('prep')
  })

  it('parses and builds audit deep-link hash', () => {
    expect(parseAppHash('#tab=audit&audit=audit-2026-QP-28-dept-qa')).toEqual({
      tab: 'audit',
      auditKey: 'audit-2026-QP-28-dept-qa',
    })
    expect(buildAppHash('audit', 'event-1')).toBe('#tab=audit&audit=event-1')
  })

  it('parses and builds record deep-link hash for follow-up pages', () => {
    expect(parseAppHash('#tab=ncr&record=ncr-1')).toEqual({
      tab: 'ncr',
      recordId: 'ncr-1',
    })
    expect(
      buildAppHash('observations', { section: 'prior', recordId: 'obs-9' }),
    ).toBe('#tab=observations&section=prior&record=obs-9')
    expect(buildAppHash('suggestions', { recordId: 'sug-2' })).toBe(
      '#tab=suggestions&record=sug-2',
    )
  })

  it('defines workflow metadata for every tab in PDCA order', () => {
    expect(TAB_WORKFLOW).toHaveLength(12)
    expect(TAB_WORKFLOW.map((entry) => entry.id)).toEqual(ALL_TABS.map((entry) => entry.id))
    expect(getTabWorkflow('stakeholders')?.nextTab).toBe('risk')
    expect(getTabWorkflow('risk')?.prevTab).toBe('stakeholders')
    expect(getTabWorkflow('risk')?.nextTab).toBe('personnel')
    expect(getTabWorkflow('personnel')?.prevTab).toBe('risk')
    expect(getTabWorkflow('personnel')?.nextTab).toBe('plan')
    expect(getTabWorkflow('plan')?.prevTab).toBe('personnel')
    expect(getTabWorkflow('plan')?.nextTab).toBe('audit')
    expect(getTabWorkflow('audit')?.prevTab).toBe('plan')
    expect(getTabWorkflow('audit')?.nextTab).toBe('observations')
    expect(getTabWorkflow('observations')?.nextTab).toBe('ncr')
    expect(getTabWorkflow('ncr')?.nextTab).toBe('suggestions')
    expect(getTabWorkflow('suggestions')?.nextTab).toBe('followups')
    expect(getTabWorkflow('followups')?.nextTab).toBe('prep')
    expect(getTabWorkflow('prep')?.nextTab).toBe('dashboard')
    expect(getTabWorkflow('system-settings')?.nextTab).toBe('dashboard')
  })
})
