import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PreAuditPrep } from '../PreAuditPrep'
import { createDemoState } from '../../data/demoData'
import type { AuditStore } from '../../hooks/useAuditStore'
import { listPrepGaps } from '../../lib/externalAuditPrep'
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
  it('tracks half-done separate items in gap summary', () => {
    const store = makeStore((state) => {
      const item7 = state.externalAuditPrep.items.find((i) => i.id === 'prep-7')
      if (item7) item7.jiurunDone = true
    })
    const gaps = listPrepGaps(store.state.externalAuditPrep)
    expect(gaps.separateHalfDone.length).toBeGreaterThan(0)
    expect(gaps.separateHalfDone[0].missing).toBe('zhenglongxing')
  })

  it('shows scope legend for dual-company prep', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getByText(/◎◎ 兩公司各自準備 · 合併 共用證據 · 稽核廠區範圍 依現場/)).toBeTruthy()
  })

  it('merged checkbox label uses compact copy', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getAllByText('合併').length).toBeGreaterThan(0)
  })

  it('renders item 2 sub-rows from the integrated seed', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getByText('年度內部稽核計畫／查檢表紀錄／稽核缺失彙整')).toBeTruthy()
    expect(screen.getByText('QR-28-03 稽核矯正報告（兩家各自備查）')).toBeTruthy()
    expect(screen.getByText('QR-28-07 內外部稽核報告書（兩家各自備查）')).toBeTruthy()
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
})
