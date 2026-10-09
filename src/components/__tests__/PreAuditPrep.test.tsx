import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PreAuditPrep } from '../PreAuditPrep'
import { createDemoState } from '../../data/demoData'
import type { AuditStore } from '../../hooks/useAuditStore'
import { companySettingsFor } from '../../types'

function makeStore(
  prepPatch?: (state: ReturnType<typeof createDemoState>) => void,
): AuditStore {
  const base = createDemoState()
  if (prepPatch) prepPatch(base)
  const state = {
    ...base,
    settings: companySettingsFor(base),
  }
  return {
    state,
    updateExternalPrepItem: vi.fn(),
    updateExternalPrepSequence: vi.fn(),
    setManagementReviewComplete: vi.fn(),
    lastSavedAt: null,
    loadWarning: null,
    saveError: null,
    actionError: null,
    updateSettings: vi.fn(),
    updatePlanRow: vi.fn(),
    addPlanRow: vi.fn(),
    removePlanRow: vi.fn(),
    updateAudit: vi.fn(),
    addNcr: vi.fn(),
    updateNcr: vi.fn(),
    removeNcr: vi.fn(),
    addObservation: vi.fn(),
    updateObservation: vi.fn(),
    removeObservation: vi.fn(),
    addSuggestion: vi.fn(),
    updateSuggestion: vi.fn(),
    removeSuggestion: vi.fn(),
    resetYear: vi.fn(),
    importChecklists: vi.fn(),
  } as unknown as AuditStore
}

describe('PreAuditPrep', () => {
  it('uses a single completion status and hides legacy company split wording', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getByRole('columnheader', { name: '完成' })).toBeTruthy()
    expect(screen.queryByText(/九潤|正隆興|法人與共用兩類|兩家公司|兩家各自|兩張證書|兩證|合併抬頭|適用公司/)).toBeNull()
  })

  it('leaves prep progress to the view switch and keeps toolbar year meta off', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.queryByText(/準備清單 \d+\/\d+/)).toBeNull()
    expect(screen.queryByText(/\d{4} 年 · 外稽/)).toBeNull()
  })

  it('renders the preparation sub-rows without legacy split instructions', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getByText('年度內部稽核計畫／查檢表紀錄／稽核缺失彙整')).toBeTruthy()
    expect(screen.getAllByText('QR-28-03 稽核矯正報告')).toHaveLength(1)
    expect(screen.getAllByText('QR-28-07 內外部稽核報告書')).toHaveLength(1)
  })

  it('keeps supplier checks while removing legacy two-header instructions', () => {
    render(<PreAuditPrep store={makeStore()} />)

    expect(screen.queryByText(/兩份抬頭/)).toBeNull()
    expect(screen.getByText(/材質證明與採購文件核對/)).toBeTruthy()
    expect(screen.getByText(/年度校正項目別勿漏校/)).toBeTruthy()
    expect(screen.getByText(/進料／出貨檢驗放行見項 21 分開備查/)).toBeTruthy()
    expect(screen.queryByText(/校驗帳可合併/)).toBeNull()
    expect(screen.queryByText('其他注意事項')).toBeNull()
    expect(screen.queryByRole('table', { name: '稽核要點' })).toBeNull()
    const notes = screen.getByRole('list', { name: '外稽通則' })
    expect(notes.textContent).toContain('忌諱塗改任何紀錄或文件')
    expect(notes.textContent).toContain('內部稽核完成 → 再召開管理審查（有時間順序要求）。')
    expect(within(notes).getAllByRole('listitem')).toHaveLength(8)
  })

  it('uses one continuous display sequence and accessible controls', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)

    const checklist = screen.getByRole('region', { name: '外部稽核前準備清單' })
    const itemNumbers = within(checklist).getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('td')?.textContent?.trim())
      .filter(Boolean)

    expect(itemNumbers.length).toBe(store.state.externalAuditPrep.items.length)
    expect(itemNumbers[0]).toBe('1')
    expect(itemNumbers.at(-1)).toBe(String(itemNumbers.length))
    expect(screen.getByRole('checkbox', { name: '第 3 項 QR-28-03 稽核矯正報告 已完成' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: '第 4 項 QR-28-07 內外部稽核報告書 已完成' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /外稽準備第 \d+ 頁/ })).toBeNull()
  })

  it('does not show the external team arrangement panel', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.queryByText('外部稽核團隊與陪稽安排')).toBeNull()
    expect(screen.queryByText(/尚未確認第三方團隊/)).toBeNull()
    expect(screen.queryByText(/尚未安排本年度陪稽人員/)).toBeNull()
  })

  it('shows date-order warnings from the preparation page without changing saved dates', () => {
    const store = makeStore((state) => {
      state.externalAuditPrep.externalAuditDate = '2026-09-15'
      state.settings.managementReviewDate = '2026-12-10'
      state.settings.externalAuditDate = undefined
    })
    render(<PreAuditPrep store={store} />)

    const sequence = screen.getAllByRole('status').map((node) => node.textContent).join('\n')
    expect(sequence).toContain('管理審查日期應早於外部稽核日期')
    expect(sequence).toContain('年度計畫窗口結束月（11 月）')
    expect(screen.queryByRole('link', { name: '至稽核總覽' })).toBeNull()
    expect(screen.queryByRole('link', { name: '至年度稽核計畫' })).toBeNull()
    expect(screen.queryByText(/內部稽核進度（唯讀）/)).toBeNull()
    expect(screen.queryByText(/^管審日期：/)).toBeNull()
    expect(screen.queryByText(/^尚缺：/)).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /2 管審/ })).toBeNull()
    const managementReview = screen.getByRole('checkbox', { name: /管理審查會議召開、會議記錄完成 已完成/ })
    expect(managementReview.hasAttribute('disabled')).toBe(true)
    expect(managementReview.getAttribute('aria-label')).toContain('將管審日期調整至外稽日期前')
    expect(store.state.externalAuditPrep.externalAuditDate).toBe('2026-09-15')
    expect(store.state.settings.managementReviewDate).toBe('2026-12-10')
  })

  it('keeps a previously completed management review reversible when the sequence is invalid', () => {
    const store = makeStore((state) => {
      state.externalAuditPrep.externalAuditDate = '2026-09-15'
      state.externalAuditPrep.managementReviewComplete = true
      state.settings.managementReviewDate = '2026-12-10'
      state.settings.externalAuditDate = undefined
    })
    render(<PreAuditPrep store={store} />)

    const checkbox = screen.getByRole('checkbox', { name: /管理審查會議召開、會議記錄完成 已完成/ })
    expect(checkbox.hasAttribute('disabled')).toBe(false)
    expect((checkbox as HTMLInputElement).checked).toBe(true)
    fireEvent.click(checkbox)
    expect(store.setManagementReviewComplete).toHaveBeenCalledWith(false)
    expect(store.updateExternalPrepItem).not.toHaveBeenCalled()
  })

  it('flags legacy data where item 4 and the sequence flag disagree instead of guessing', () => {
    const store = makeStore((state) => {
      state.externalAuditPrep.managementReviewComplete = false
      state.externalAuditPrep.items.find((item) => item.id === 'prep-4')!.completed = true
    })
    render(<PreAuditPrep store={store} />)
    expect(screen.getByText(/2 管審 待覆核/)).toBeTruthy()
    expect(screen.getByText(/待覆核：舊資料第 4 項為「已完成」、序位管審為「未完成」/)).toBeTruthy()
  })

  it('shows linked checklist rows and live NCR checks without writing completion', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    const checklist = screen.getByRole('region', { name: '外部稽核前準備清單' })
    expect(within(checklist).getByRole('columnheader', { name: '關聯查檢／系統檢核' })).toBeTruthy()
    expect(within(checklist).getAllByText(/未結 NCR/)).toHaveLength(2)
    expect(store.updateExternalPrepItem).not.toHaveBeenCalled()
  })

  it('filters open items on screen but keeps every row for print', () => {
    const store = makeStore((state) => {
      state.externalAuditPrep.items[0].completed = true
    })
    render(<PreAuditPrep store={store} />)
    fireEvent.click(screen.getByRole('button', { name: '未完成' }))
    const checklist = screen.getByRole('region', { name: '外部稽核前準備清單' })
    const rows = within(checklist).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(store.state.externalAuditPrep.items.length)
    expect(rows[0].className).toContain('pagination-hidden-row')
    expect(rows[1].className).not.toContain('pagination-hidden-row')
  })
})
