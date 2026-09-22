import { describe, it, expect } from 'vitest'
import {
  collectNCRsFromAudits,
  isNcrStale,
  findChecklistItem,
} from '../ncr'
import type { ChecklistItem, NCR, ProcedureAudit } from '../../types'

const baseAudit = (items: ChecklistItem[]): ProcedureAudit => ({
  id: 'audit-1',
  qpCode: 'QP-01',
  departmentId: 'd1',
  department: '管理部',
  process: 'p',
  documents: 'd',
  notifyDate: '',
  auditDate: '2026-03-01',
  departmentManager: '主管',
  auditors: '稽核員',
  auditCategory: '系統稽核',
  items,
})

describe('collectNCRsFromAudits', () => {
  it('creates NCR for 不符 items without removing on judgment change', () => {
    const itemId = 'chk-1'
    const items: ChecklistItem[] = [
      {
        id: itemId,
        category: '測試',
        no: 1,
        content: '內容',
        judgment: '不符',
        description: '說明',
      },
    ]
    const audits = [baseAudit(items)]
    const ncrs = collectNCRsFromAudits(audits, 2026, [])
    expect(ncrs).toHaveLength(1)
    expect(ncrs[0].description).toContain('說明')

    const editedNcr: NCR = { ...ncrs[0], description: '手動矯正說明' }
    const updatedItems = [{ ...items[0], judgment: '符合' as const }]
    const merged = collectNCRsFromAudits([baseAudit(updatedItems)], 2026, [editedNcr])
    expect(merged).toHaveLength(1)
    expect(merged[0].description).toBe('手動矯正說明')
    expect(isNcrStale(merged[0], [baseAudit(updatedItems)])).toBe(true)
  })

  it('does not duplicate NCR for same checklist item', () => {
    const items: ChecklistItem[] = [
      {
        id: 'chk-1',
        category: '測試',
        no: 1,
        content: 'c',
        judgment: '不符',
        description: '',
      },
    ]
    const audits = [baseAudit(items)]
    const first = collectNCRsFromAudits(audits, 2026, [])
    const second = collectNCRsFromAudits(audits, 2026, first)
    expect(second).toHaveLength(1)
  })
})

describe('findChecklistItem', () => {
  it('finds item across audits', () => {
    const audits = [baseAudit([{ id: 'x', category: 'a', no: 1, content: '', judgment: null, description: '' }])]
    expect(findChecklistItem(audits, 'x')?.id).toBe('x')
  })
})

describe('dual certificate NCR', () => {
  it('creates separate NCR per non-conforming side', () => {
    const itemId = 'chk-dual-1'
    const items: ChecklistItem[] = [
      {
        id: itemId,
        category: '雙證',
        no: 4,
        content: '雙證項',
        judgment: null,
        description: '',
        certificateScope: 'dual',
        judgmentByCompany: { jiurun: '不符', zhenglongxing: '符合' },
      },
    ]
    const audits = [baseAudit(items)]
    const ncrs = collectNCRsFromAudits(audits, 2026, [])
    expect(ncrs).toHaveLength(1)
    expect(ncrs[0].companyScope).toBe('jiurun')
    expect(ncrs[0].id).toBe(`ncr-${itemId}-jiurun`)
  })
})
