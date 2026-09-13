import { describe, expect, it, beforeEach, vi } from 'vitest'
import { loadStateFromStorage } from '../storage'
import { createDemoState, STORAGE_KEY } from '../../data/demoData'
import { companiesAreDifferentiated } from '../demoRefresh'

function createOldClonedDemoState() {
  const state = createDemoState()
  state.version = 6
  delete state.dataSource
  const clone = JSON.parse(JSON.stringify(state.companies.jiurun)) as typeof state.companies.jiurun
  clone.ncrs = clone.ncrs.map((n) => ({
    ...n,
    id: 'ncr-demo-zlx',
    ncrNumber: 'NCR-2026-001-zhenglongxing',
  }))
  state.companies.zhenglongxing = clone
  return state
}

describe('storage migration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('migrates v5 NCR records missing close-out fields to v9', () => {
    const legacy = createDemoState()
    legacy.version = 5
    legacy.dataSource = 'user'
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
    legacy.companies.zhenglongxing.ncrs = []
    legacy.companies.zhenglongxing.audits = legacy.companies.zhenglongxing.audits.filter(
      (a) => a.qpCode !== 'QP-16',
    )

    localStorage.setItem('qms-annual-internal-audit-v5', JSON.stringify(legacy))

    const { state } = loadStateFromStorage()
    expect(state.version).toBe(10)
    expect(state.dataSource).toBe('user')
    expect(state.companies.jiurun.ncrs[0].rootCause).toBe('')
    expect(state.companies.jiurun.audits[0].notifySent).toBe(false)
    expect(state.companies.jiurun.ncrs[0].correctiveAction).toBe('')
    expect(state.companies.jiurun.ncrs[0].verificationEvidence).toBe('')
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy()
  })

  it('preserves user dataSource=user without refreshing differentiated companies', () => {
    const userState = createDemoState()
    userState.version = 6
    userState.dataSource = 'user'
    userState.settings.leadAuditor = '正式主導稽核員'
    userState.companies.jiurun.ncrs[0].description = '使用者自訂 NCR 描述'

    localStorage.setItem('qms-annual-internal-audit-v6', JSON.stringify(userState))

    const { state } = loadStateFromStorage()
    expect(state.version).toBe(10)
    expect(state.dataSource).toBe('user')
    expect(state.settings.leadAuditor).toBe('正式主導稽核員')
    expect(state.companies.jiurun.ncrs[0].description).toBe('使用者自訂 NCR 描述')
    expect(companiesAreDifferentiated(state)).toBe(true)
  })

  it('refreshes old cloned demo (missing dataSource) to differentiated companies', () => {
    const cloned = createOldClonedDemoState()
    localStorage.setItem('qms-annual-internal-audit-v6', JSON.stringify(cloned))

    const { state } = loadStateFromStorage()
    expect(state.version).toBe(10)
    expect(state.dataSource).toBe('demo')
    expect(companiesAreDifferentiated(state)).toBe(true)
    expect(state.companies.jiurun.ncrs.length).toBe(1)
    expect(state.companies.zhenglongxing.ncrs.length).toBe(0)
    expect(state.companies.jiurun.audits.map((a) => a.qpCode).sort()).not.toEqual(
      state.companies.zhenglongxing.audits.map((a) => a.qpCode).sort(),
    )
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy()
  })

  it('refreshes misclassified dataSource=user old clone once', () => {
    const cloned = createOldClonedDemoState()
    cloned.dataSource = 'user'
    localStorage.setItem('qms-annual-internal-audit-v6', JSON.stringify(cloned))

    const { state } = loadStateFromStorage()
    expect(state.version).toBe(10)
    expect(state.dataSource).toBe('demo')
    expect(companiesAreDifferentiated(state)).toBe(true)
    expect(state.companies.zhenglongxing.ncrs.length).toBe(0)
  })

  it('refreshes explicit demo dataSource to current demo on v6 load', () => {
    const demo = createOldClonedDemoState()
    demo.dataSource = 'demo'
    localStorage.setItem('qms-annual-internal-audit-v6', JSON.stringify(demo))

    const { state } = loadStateFromStorage()
    expect(state.dataSource).toBe('demo')
    expect(companiesAreDifferentiated(state)).toBe(true)
  })

  it('does not re-refresh already migrated v9 demo on subsequent loads', () => {
    const demo = createDemoState()
    demo.settings.leadAuditor = '已落地 v9 示範'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))

    const { state } = loadStateFromStorage()
    expect(state.settings.leadAuditor).toBe('已落地 v9 示範')
    expect(state.dataSource).toBe('demo')
  })

  it('refreshes v8 demo companies once on v9 migration while preserving settings', () => {
    const demo = createDemoState()
    demo.version = 8
    demo.settings.leadAuditor = '自訂主任稽核員'
    demo.companies.jiurun.audits = demo.companies.jiurun.audits.map((audit) =>
      audit.qpCode === 'QP-28'
        ? {
            ...audit,
            items: audit.items.map((item) => ({ ...item, judgment: null as typeof item.judgment })),
          }
        : audit,
    )
    localStorage.setItem('qms-annual-internal-audit-v8', JSON.stringify(demo))

    const { state } = loadStateFromStorage()
    expect(state.version).toBe(10)
    expect(state.settings.leadAuditor).toBe('自訂主任稽核員')
    expect(state.dataSource).toBe('demo')
    expect(state.companies.jiurun.audits.some((a) => a.qpCode === 'QP-28' && a.items.every((i) => i.judgment))).toBe(
      true,
    )
  })
})
