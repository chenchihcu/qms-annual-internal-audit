import { fireEvent, render, screen } from '@testing-library/react'
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
    settings: companySettingsFor(base, base.activeCompanyId),
  }
  return {
    state,
    updateExternalPrepItem: vi.fn(),
    updateExternalPrepSequence: vi.fn(),
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

  it('shows visible prep checklist progress without toolbar year meta', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getByText(/準備清單 \d+\/\d+/)).toBeTruthy()
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

    fireEvent.click(screen.getByRole('button', { name: '外稽準備第 2 頁' }))
    expect(screen.getByText(/年度校正項目別勿漏校/)).toBeTruthy()
    expect(screen.getByText(/進料／出貨檢驗放行見項 21 分開備查/)).toBeTruthy()
    expect(screen.queryByText(/校驗帳可合併/)).toBeNull()
  })

  it('uses one continuous display sequence across pages and accessible controls', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)

    const visibleNumbers = () => screen.getAllByRole('row')
      .filter((row) => !row.classList.contains('pagination-hidden-row'))
      .slice(1)
      .map((row) => row.querySelector('td')?.textContent?.trim())

    expect(visibleNumbers()).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
    expect(screen.getByRole('checkbox', { name: '第 3 項 QR-28-03 稽核矯正報告 已完成' })).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: '第 4 項 QR-28-07 內外部稽核報告書 已完成' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '外稽準備第 2 頁' }))
    expect(visibleNumbers()).toEqual(['11', '12', '13', '14', '15', '16', '17', '18', '19', '20'])
  })

  it('shows external audit team reminder when assignments are missing', () => {
    const store = makeStore((state) => {
      state.people = []
      state.annualPersonnelAssignments = []
    })
    render(<PreAuditPrep store={store} />)
    expect(screen.getByText(/尚未確認第三方團隊/)).toBeTruthy()
    expect(screen.getByText(/尚未安排本年度陪稽人員/)).toBeTruthy()
  })

  it('shows date-order warnings from the preparation page without changing saved dates', () => {
    const store = makeStore((state) => {
      state.externalAuditPrep.externalAuditDate = '2026-09-15'
      state.companySettings[state.activeCompanyId].managementReviewDate = '2026-12-10'
      state.companySettings[state.activeCompanyId].externalAuditDate = undefined
    })
    render(<PreAuditPrep store={store} />)

    expect(screen.getByRole('alert').textContent).toContain('管理審查日期應早於外部稽核日期')
    expect(screen.getByRole('alert').textContent).toContain('年度計畫窗口結束月（11 月）')
    expect(screen.getByRole('checkbox', { name: /2\. 管理審查完成/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('尚缺：完成當年度內部稽核；將管審日期調整至外稽日期前。')).toBeTruthy()
    expect(store.state.externalAuditPrep.externalAuditDate).toBe('2026-09-15')
    expect(store.state.settings.managementReviewDate).toBe('2026-12-10')
  })

  it('keeps a previously completed management review reversible when the sequence is invalid', () => {
    const store = makeStore((state) => {
      state.externalAuditPrep.externalAuditDate = '2026-09-15'
      state.externalAuditPrep.managementReviewComplete = true
      state.companySettings[state.activeCompanyId].managementReviewDate = '2026-12-10'
      state.companySettings[state.activeCompanyId].externalAuditDate = undefined
    })
    render(<PreAuditPrep store={store} />)

    const checkbox = screen.getByRole('checkbox', { name: /2\. 管理審查完成/ })
    expect(checkbox.hasAttribute('disabled')).toBe(false)
    fireEvent.click(checkbox)
    expect(store.updateExternalPrepSequence).toHaveBeenCalledWith({ managementReviewComplete: false })
  })
})
