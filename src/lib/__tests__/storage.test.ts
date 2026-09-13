import { describe, expect, it, beforeEach, vi } from 'vitest'
import { loadStateFromStorage } from '../storage'
import { createDemoState, STORAGE_KEY } from '../../data/demoData'

describe('storage migration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('migrates v5 NCR records missing close-out fields to v6', () => {
    const legacy = createDemoState()
    legacy.version = 5
    delete legacy.dataSource
    legacy.companies.jiurun.ncrs = [
      {
        id: 'legacy-ncr',
        ncrNumber: 'NCR-2026-001',
        qpCode: 'QP-16',
        departmentId: 'dept-qa',
        department: '品保部',
        process: '製程',
        description: '舊版描述',
        date: '2026-01-01',
        status: '開立',
      } as (typeof legacy.companies.jiurun.ncrs)[0],
    ]

    localStorage.setItem('qms-annual-internal-audit-v5', JSON.stringify(legacy))

    const { state } = loadStateFromStorage()
    expect(state.version).toBe(6)
    expect(state.companies.jiurun.ncrs[0].rootCause).toBe('')
    expect(state.companies.jiurun.ncrs[0].correctiveAction).toBe('')
    expect(state.companies.jiurun.ncrs[0].verificationEvidence).toBe('')
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy()
  })
})
