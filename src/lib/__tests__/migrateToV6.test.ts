import { describe, it, expect } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { migrateV5ToV6 } from '../migrateToV6'
import type { AppState, ChecklistItem, LegacyV5AppState } from '../../types'

function cloneCompany(company: AppState['company']): AppState['company'] {
  return JSON.parse(JSON.stringify(company)) as AppState['company']
}

function toLegacyV5(state: AppState): LegacyV5AppState {
  return {
    activeCompanyId: 'jiurun',
    settings: state.settings,
    companies: {
      jiurun: { ...cloneCompany(state.company), name: '九潤精密' },
      zhenglongxing: { ...cloneCompany(state.company), name: '正隆興精密' },
    },
    externalAuditPrep: state.externalAuditPrep,
    version: 5,
  }
}

describe('migrateV5ToV6', () => {
  it('merges identical demo companies into one', () => {
    const legacy = toLegacyV5(createDemoState())
    const migrated = migrateV5ToV6(legacy)
    expect(migrated.version).toBe(6)
    expect(migrated.company.name).toContain('九潤')
    expect(migrated.company.ncrs.length).toBeGreaterThan(0)
    expect(migrated.company.audits.length).toBeGreaterThan(0)
  })

  it('promotes conflicting judgments to dual scope', () => {
    const legacy = toLegacyV5(createDemoState())
    const audit = legacy.companies.jiurun.audits.find(
      (a) => a.qpCode === 'QP-16' && a.departmentId === 'dept-qa',
    )!
    const item = audit.items.find((i) => i.no === 1)!
    item.judgment = '符合'
    const zxAudit = legacy.companies.zhenglongxing.audits.find((a) => a.id === audit.id)!
    const zxItem = zxAudit.items.find((i) => i.no === 1)!
    zxItem.judgment = '不符'

    const migrated = migrateV5ToV6(legacy)
    const mergedAudit = migrated.company.audits.find((a) => a.id === audit.id)!
    const mergedItem = mergedAudit.items.find((i) => i.no === item.no)!
    expect(mergedItem.certificateScope).toBe('dual')
    expect(mergedItem.judgmentByCompany?.jiurun).toBe('符合')
    expect(mergedItem.judgmentByCompany?.zhenglongxing).toBe('不符')
  })

  it('unions NCRs from both companies with companyScope', () => {
    const legacy = toLegacyV5(createDemoState())
    legacy.companies.zhenglongxing.ncrs.push({
      id: 'ncr-zx-only',
      ncrNumber: 'NCR-ZX-1',
      qpCode: 'QP-01',
      departmentId: 'dept-qa',
      department: '品保部',
      process: 'p',
      description: '正隆興專用',
      date: '2026-01-01',
      status: '開立',
    })
    const migrated = migrateV5ToV6(legacy)
    expect(migrated.company.ncrs.some((n) => n.id === 'ncr-zx-only')).toBe(true)
    expect(migrated.company.ncrs.some((n) => n.companyScope === 'zhenglongxing')).toBe(true)
  })
})

describe('dual scoring and NCR', () => {
  it('dual item pending until both sides judged', async () => {
    const { isChecklistItemPending } = await import('../scoring')
    const item: ChecklistItem = {
      id: 'x',
      category: '雙證',
      no: 4,
      content: 'test',
      judgment: null,
      description: '',
      certificateScope: 'dual',
      judgmentByCompany: { jiurun: '符合', zhenglongxing: null },
    }
    expect(isChecklistItemPending(item)).toBe(true)
    item.judgmentByCompany!.zhenglongxing = '符合'
    expect(isChecklistItemPending(item)).toBe(false)
  })
})
