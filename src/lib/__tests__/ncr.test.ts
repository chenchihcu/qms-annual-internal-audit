import { describe, it, expect } from 'vitest'
import {
  collectNCRsFromAudits,
  ensureNcrFromObservation,
  findNcrForObservation,
  isNcrStale,
  findChecklistItem,
  normalizeNCR,
} from '../ncr'
import type { ChecklistItem, NCR, Observation, ProcedureAudit } from '../../types'

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

describe('normalizeNCR', () => {
  it('fills missing close-out fields for legacy records', () => {
    const ncr = normalizeNCR({
      id: 'x',
      ncrNumber: 'NCR-2026-001',
      qpCode: 'QP-01',
      departmentId: 'd1',
      department: '管理部',
      process: 'p',
      description: 'desc',
      date: '2026-01-01',
      status: '開立',
    })
    expect(ncr.rootCause).toBe('')
    expect(ncr.correctiveAction).toBe('')
    expect(ncr.verificationEvidence).toBe('')
  })
})

describe('findChecklistItem', () => {
  it('finds item across audits', () => {
    const audits = [baseAudit([{ id: 'x', category: 'a', no: 1, content: '', judgment: null, description: '' }])]
    expect(findChecklistItem(audits, 'x')?.id).toBe('x')
  })
})

const sampleObservation = (): Observation => ({
  id: 'obs-1',
  year: 2025,
  qpCode: 'QP-01',
  departmentId: 'dept-admin',
  department: '管理部',
  process: '文件管制',
  content: '文件回收未簽收',
  description: '建議補強簽收紀錄',
  status: 'became_ncr',
})

describe('ensureNcrFromObservation', () => {
  it('creates NCR with 開立 status and observation link', () => {
    const obs = sampleObservation()
    const { ncrs, ncrId } = ensureNcrFromObservation(obs, [], 2026)
    expect(ncrs).toHaveLength(1)
    expect(ncrId).toBe('ncr-obs-obs-1')
    expect(ncrs[0].status).toBe('開立')
    expect(ncrs[0].observationId).toBe('obs-1')
    expect(ncrs[0].qpCode).toBe('QP-01')
    expect(ncrs[0].description).toContain('簽收')
  })

  it('does not duplicate when called again', () => {
    const obs = sampleObservation()
    const first = ensureNcrFromObservation(obs, [], 2026)
    const linked = { ...obs, ncrId: first.ncrId }
    const second = ensureNcrFromObservation(linked, first.ncrs, 2026)
    expect(second.ncrs).toHaveLength(1)
    expect(second.ncrId).toBe(first.ncrId)
  })

  it('finds NCR by observationId even without ncrId on observation', () => {
    const obs = sampleObservation()
    const { ncrs } = ensureNcrFromObservation(obs, [], 2026)
    expect(findNcrForObservation(ncrs, obs)?.id).toBe('ncr-obs-obs-1')
  })
})
