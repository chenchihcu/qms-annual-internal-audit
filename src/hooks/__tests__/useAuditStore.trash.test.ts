import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoState, STORAGE_KEY } from '../../data/demoData'
import { useAuditStore } from '../useAuditStore'

beforeEach(() => {
  localStorage.clear()
  const demo = createDemoState()
  demo.companies.jiurun.audits[0].status = '執行中'
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
})

describe('useAuditStore recycle bin actions', () => {
  it('keeps a checklist generated NCR out of the active list while it is in trash', () => {
    const { result } = renderHook(() => useAuditStore())
    const audit = result.current.state.company.audits[0]
    act(() => result.current.addChecklistItem(audit.id))
    const item = result.current.state.company.audits[0].items.at(-1)!
    const itemId = item.id
    const generatedNcrId = `ncr-${itemId}`

    act(() => result.current.updateChecklistItem(audit.id, itemId, { judgment: '不符', description: '自動建立 NCR' }))
    expect(result.current.state.company.ncrs.some((record) => record.id === generatedNcrId)).toBe(true)

    act(() => result.current.moveNCRToTrash(generatedNcrId))
    expect(result.current.state.company.ncrs.some((record) => record.id === generatedNcrId)).toBe(false)
    const trashId = result.current.state.trash?.find((entry) => entry.recordId === generatedNcrId)?.id
    expect(trashId).toBeTruthy()

    act(() => result.current.updateChecklistItem(audit.id, itemId, { description: '更新來源仍不得重建' }))
    expect(result.current.state.company.ncrs.some((record) => record.id === generatedNcrId)).toBe(false)

    act(() => result.current.permanentlyDeleteFromTrash(trashId!))
    act(() => result.current.updateChecklistItem(audit.id, itemId, { description: '永久清除後仍不得重建' }))
    expect(result.current.state.company.ncrs.some((record) => record.id === generatedNcrId)).toBe(false)
    expect(result.current.state.permanentlyDeletedGeneratedRecords).toContainEqual({
      kind: 'ncr',
      recordId: generatedNcrId,
      companyId: result.current.state.activeCompanyId,
      year: result.current.state.settings.auditYear,
    })
  })

  it('restores trash entries and leaves the item in the bin when the source audit has been reported', () => {
    const { result } = renderHook(() => useAuditStore())
    const audit = result.current.state.company.audits[0]
    act(() => result.current.addChecklistItem(audit.id))
    const customItem = result.current.state.company.audits[0].items.at(-1)!
    act(() => result.current.removeChecklistItem(audit.id, customItem.id))
    const entry = result.current.state.trash?.find((item) => item.recordId === customItem.id)
    expect(entry).toBeTruthy()
    expect(result.current.state.company.audits[0].items.some((item) => item.id === customItem.id)).toBe(false)

    act(() => result.current.updateAudit({
      ...result.current.state.company.audits[0],
      status: '已回報',
      reportReference: 'QR-28-02-TEST',
    }))
    let restoreResult: ReturnType<typeof result.current.restoreFromTrash> | undefined
    act(() => {
      restoreResult = result.current.restoreFromTrash(entry!.id)
    })

    expect(restoreResult?.ok).toBe(false)
    expect(result.current.state.trash?.some((item) => item.id === entry!.id)).toBe(true)
  })
})
