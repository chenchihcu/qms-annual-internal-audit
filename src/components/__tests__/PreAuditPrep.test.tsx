import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PreAuditPrep } from '../PreAuditPrep'
import { createDemoState } from '../../data/demoData'
import type { AuditStore } from '../../hooks/useAuditStore'

function makeStore(
  prepPatch?: (state: ReturnType<typeof createDemoState>) => void,
): AuditStore {
  const state = createDemoState()
  if (prepPatch) prepPatch(state)
  return {
    state,
    updateExternalPrepItem: vi.fn(),
    updateExternalPrepSequence: vi.fn(),
    lastSavedAt: null,
    loadWarning: null,
    saveError: null,
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
  it('shows half-done warning when only one company checked', () => {
    const store = makeStore((state) => {
      const item7 = state.externalAuditPrep.items.find((i) => i.id === 'prep-7')
      if (item7) item7.jiurunDone = true
    })
    render(<PreAuditPrep store={store} />)
    expect(screen.getAllByText(/只完成其中一家/).length).toBeGreaterThan(0)
    expect(screen.getByText(/缺\s*正隆興\s*抬頭/)).toBeTruthy()
  })

  it('shows header rule legend', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getByText('◎◎ 法人證據')).toBeTruthy()
    expect(screen.getByText(/表頭九潤＋正隆興/)).toBeTruthy()
  })

  it('merged checkbox label mentions dual header', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getAllByText('合併（表頭兩家）').length).toBeGreaterThan(0)
  })

  it('renders item 2 sub-rows and audited products section', () => {
    const store = makeStore()
    render(<PreAuditPrep store={store} />)
    expect(screen.getByText('2a')).toBeTruthy()
    expect(screen.getByText('2b')).toBeTruthy()
    expect(screen.getAllByText(/當日受稽產品／機種/).length).toBeGreaterThan(0)
    expect(screen.getByText(/新增產品/)).toBeTruthy()
  })

  it('shows QP hard-gate message when checked but audits incomplete', () => {
    const store = makeStore((state) => {
      const item1 = state.externalAuditPrep.items.find((i) => i.id === 'prep-1')
      if (item1) {
        item1.jiurunDone = true
        item1.zhenglongxingDone = true
      }
    })
    render(<PreAuditPrep store={store} />)
    expect(screen.getAllByText(/查檢未完成/).length).toBeGreaterThan(0)
  })
})
