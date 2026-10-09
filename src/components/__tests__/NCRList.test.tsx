import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NCRList } from '../NCRList'
import { createDemoState } from '../../data/demoData'
import type { AuditStore } from '../../hooks/useAuditStore'
import { companySettingsFor } from '../../types'
import { normalizeNCR } from '../../lib/ncr'
import { NcrUnsavedGuardProvider } from '../../context/NcrUnsavedGuardProvider'

function makeStore(ncrs: ReturnType<typeof normalizeNCR>[]): AuditStore {
  const base = createDemoState()
  const state = {
    ...base,
    settings: companySettingsFor(base),
    company: {
      ...base.workspace,
      ncrs,
    },
    workspace: {
      ...base.workspace,
      ncrs,
    },
  }
  const updateNCR = vi.fn((_id: string, patch: Record<string, unknown>) => {
    const current = state.workspace.ncrs[0]
    if (patch.status === '結案') {
      const missing = ['correctiveActionReference', 'effectivenessReference', 'effectivenessVerifiedBy', 'effectivenessVerifiedAt'].filter(
        (key) => !String(patch[key] ?? current[key as keyof typeof current] ?? '').trim(),
      )
      if (missing.length) {
        return { ok: false, missing: ['矯正措施引用', '效果確認引用', '效果確認人', '效果確認日'].slice(0, missing.length) }
      }
    }
    state.workspace.ncrs = state.workspace.ncrs.map((n) => (n.id === _id ? { ...n, ...patch } : n))
    return { ok: true }
  })
  return {
    state,
    updateNCR,
    addManualNCR: vi.fn(),
    moveNCRToTrash: vi.fn(),
  } as unknown as AuditStore
}

function renderList(store: AuditStore) {
  return render(
    <NcrUnsavedGuardProvider>
      <NCRList store={store} />
    </NcrUnsavedGuardProvider>,
  )
}

describe('NCRList QR-28-03 report', () => {
  const sample = normalizeNCR({
    id: 'ncr-test-1',
    ncrNumber: 'NCR-2026-001',
    qpCode: 'QP-01',
    departmentId: 'dept-1',
    department: '管理部',
    process: '內部稽核',
    description: '初始不符合',
    date: '2026-03-01',
    status: '開立',
  })

  it('does not persist edits until 存檔', () => {
    const store = makeStore([sample])
    renderList(store)
    fireEvent.click(screen.getByRole('button', { name: /NCR-2026-001 QR-28-03 報告/ }))
    const root = screen.getByLabelText('NCR-2026-001 原因分析')
    fireEvent.change(root, { target: { value: '新原因' } })
    expect(store.updateNCR).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '存檔' }))
    expect(store.updateNCR).toHaveBeenCalledWith(
      'ncr-test-1',
      expect.objectContaining({ rootCause: '新原因' }),
    )
  })

  it('blocks 存檔 when 結案 missing close fields', () => {
    const store = makeStore([sample])
    renderList(store)
    fireEvent.click(screen.getByRole('button', { name: /NCR-2026-001 QR-28-03 報告/ }))
    fireEvent.change(screen.getByLabelText('狀態'), { target: { value: '結案' } })
    fireEvent.click(screen.getByRole('button', { name: '存檔' }))
    expect(screen.getByRole('alert').textContent).toContain('結案須填')
    expect(store.updateNCR).not.toHaveBeenCalled()
  })

  it('opens 作廢 confirm that moves to trash', () => {
    const store = makeStore([sample])
    renderList(store)
    fireEvent.click(screen.getByRole('button', { name: /NCR-2026-001 QR-28-03 報告/ }))
    fireEvent.click(screen.getByRole('button', { name: '作廢' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('作廢此 NCR？')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: '作廢' }))
    expect(store.moveNCRToTrash).toHaveBeenCalledWith('ncr-test-1')
  })
})

describe('NCRList 一覽版面（試點）', () => {
  const longDescription = '不合格品隔離區標示不完整，現場未依 QP-26 區分待判、報廢與重工品，且隔離紀錄缺少責任人簽核。'
  const ncr = normalizeNCR({
    id: 'ncr-layout-1',
    ncrNumber: 'NCR-2026-001',
    qpCode: 'QP-26',
    departmentId: 'dept-1',
    department: '生產製造部',
    process: '內部稽核',
    description: longDescription,
    date: '2026-03-15',
    dueDate: '2000-01-01',
    status: '矯正中',
  })

  it('摘要完整顯示、不截斷，且只渲染一次', () => {
    renderList(makeStore([ncr]))
    const cells = screen.getAllByText(longDescription)
    expect(cells).toHaveLength(1)
    expect(cells[0].className).not.toContain('line-clamp')
  })

  it('公司欄無值時只在列印顯示', () => {
    renderList(makeStore([ncr]))
    const header = screen.getByRole('columnheader', { name: '公司' })
    expect(header.className).toContain('print-table-cell')
  })

  it('逾期以文字標示，不只靠列底色', () => {
    renderList(makeStore([ncr]))
    expect(screen.getByText('逾期')).toBeTruthy()
  })

  it('精簡進度以文字摘要呈現各階段狀態', () => {
    renderList(makeStore([ncr]))
    const group = screen.getByRole('group', { name: /QR-28-03 填寫進度：NCR立案已填/ })
    expect(group.textContent).toMatch(/^\d\/4 · 待/)
  })
})
