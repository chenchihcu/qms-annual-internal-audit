import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { createDemoState, STORAGE_KEY } from '../../data/demoData'
import { useAuditStore } from '../useAuditStore'

function seedCurrentDemo() {
  const demo = createDemoState()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
}

describe('useAuditStore report and restore gates', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('blocks 已回報 when checklist items are still pending', () => {
    seedCurrentDemo()
    const { result } = renderHook(() => useAuditStore())
    const audit = result.current.state.company.audits.find(
      (item) => item.qpCode === 'QP-16' && item.status === '執行中',
    )
    expect(audit).toBeDefined()
    let reportResult: ReturnType<typeof result.current.updateAudit> | undefined
    act(() => {
      reportResult = result.current.updateAudit({
        ...audit!,
        status: '已回報',
        reportReference: 'RPT-001',
      })
    })
    expect(reportResult).toEqual({ ok: false, gaps: expect.arrayContaining([expect.stringMatching(/待判定/)]) })
    expect(result.current.state.company.audits.find((item) => item.id === audit!.id)?.status).toBe('執行中')
  })

  it('allows 已回報 when report reference and checklist are complete', () => {
    seedCurrentDemo()
    const { result } = renderHook(() => useAuditStore())
    const audit = result.current.state.company.audits.find(
      (item) => item.qpCode === 'QP-28' && item.status === '執行中',
    )
    expect(audit).toBeDefined()
    let reportResult: ReturnType<typeof result.current.updateAudit> | undefined
    act(() => {
      reportResult = result.current.updateAudit({
        ...audit!,
        status: '已回報',
        reportReference: 'RPT-OK',
      })
    })
    expect(reportResult).toEqual({ ok: true })
    expect(result.current.state.company.audits.find((item) => item.id === audit!.id)?.status).toBe('已回報')
  })

  it('blocks NCR 結案 without required fields and leaves state unchanged', () => {
    seedCurrentDemo()
    const { result } = renderHook(() => useAuditStore())
    const ncrId = result.current.state.company.ncrs[0]?.id
    expect(ncrId).toBeTruthy()
    const before = result.current.state.company.ncrs.find((item) => item.id === ncrId)!
    let closeResult: ReturnType<typeof result.current.updateNCR> | undefined
    act(() => {
      closeResult = result.current.updateNCR(ncrId!, { status: '結案' })
    })
    expect(closeResult).toEqual({
      ok: false,
      missing: expect.arrayContaining(['矯正措施引用', '效果確認引用', '效果確認人', '效果確認日']),
    })
    expect(result.current.state.company.ncrs.find((item) => item.id === ncrId)?.status).toBe(before.status)
  })

  it('does not apply importJSON when backup JSON is invalid', () => {
    seedCurrentDemo()
    const { result } = renderHook(() => useAuditStore())
    const baseline = localStorage.getItem(STORAGE_KEY)
    expect(baseline).toBeTruthy()
    expect(() => {
      act(() => result.current.importJSON('{bad json'))
    }).toThrow()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(baseline)
  })
})
