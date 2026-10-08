import { describe, it, expect } from 'vitest'
import {
  collectNCRsFromAudits,
  canTransitionNcrStatus,
  ensureNcrFromChecklistObservation,
  ensureNcrFromObservation,
  findNcrForChecklistItem,
  findNcrForObservation,
  isNcrStale,
  findChecklistItem,
  normalizeNCR,
  ncrNumberLabel,
  ncrNumberLabels,
  validateNcrClose,
  ncrReportProgress,
  ncrDraftEquals,
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

describe('ncrNumberLabel', () => {
  it('hides legacy company suffixes without mutating stored values', () => {
    const records = [
      { id: 'one', ncrNumber: 'NCR-2026-001-jiurun' },
      { id: 'two', ncrNumber: 'NCR-2026-001-zlx' },
      { id: 'three', ncrNumber: 'NCR-2026-002' },
    ]

    expect(ncrNumberLabel('NCR-2026-001-zhenglongxing')).toBe('NCR-2026-001')
    expect(ncrNumberLabels(records)).toEqual(new Map([
      ['one', 'NCR-2026-001 (1)'],
      ['two', 'NCR-2026-001 (2)'],
      ['three', 'NCR-2026-002'],
    ]))
    expect(records[0].ncrNumber).toBe('NCR-2026-001-jiurun')
  })
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

describe('ensureNcrFromChecklistObservation', () => {
  it('creates NCR from 觀察 checklist item', () => {
    const itemId = 'chk-obs-1'
    const audit = baseAudit([
      {
        id: itemId,
        category: '測試',
        no: 1,
        content: '文件未更新',
        judgment: '觀察',
        description: '建議補強',
      },
    ])
    const { ncrs, ncrId } = ensureNcrFromChecklistObservation(audit, itemId, [], 2026)
    expect(ncrId).toBe(`ncr-obs-chk-${itemId}`)
    expect(ncrs).toHaveLength(1)
    expect(ncrs[0].status).toBe('開立')
    expect(ncrs[0].checklistItemId).toBe(itemId)
    expect(findNcrForChecklistItem(ncrs, itemId)?.ncrNumber).toMatch(/^NCR-2026-/)
  })

  it('does not duplicate NCR for same checklist item', () => {
    const itemId = 'chk-obs-2'
    const audit = baseAudit([
      {
        id: itemId,
        category: '測試',
        no: 1,
        content: 'c',
        judgment: '觀察',
        description: '',
      },
    ])
    const first = ensureNcrFromChecklistObservation(audit, itemId, [], 2026)
    const second = ensureNcrFromChecklistObservation(audit, itemId, first.ncrs, 2026)
    expect(second.ncrs).toHaveLength(1)
    expect(second.ncrId).toBe(first.ncrId)
  })
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

describe('validateNcrClose', () => {
  it('blocks close when verificationEvidence is empty', () => {
    const ncr: NCR = {
      id: 'n1',
      ncrNumber: 'NCR-2026-001',
      qpCode: 'QP-16',
      departmentId: 'd1',
      department: '品保部',
      process: 'p',
      description: 'desc',
      date: '2026-03-01',
      status: '矯正中',
      rootCause: '原因',
      correctiveAction: '措施',
      verificationEvidence: '',
    }
    expect(validateNcrClose(ncr).ok).toBe(false)
    expect(canTransitionNcrStatus(ncr, '結案').ok).toBe(false)
  })

  it('allows close when required fields are filled', () => {
    const ncr: NCR = {
      id: 'n1',
      ncrNumber: 'NCR-2026-001',
      qpCode: 'QP-16',
      departmentId: 'd1',
      department: '品保部',
      process: 'p',
      description: 'desc',
      date: '2026-03-01',
      status: '矯正中',
      rootCause: '原因',
      correctiveAction: '措施',
      verificationEvidence: '複查合格',
      correctiveActionReference: 'QR-28-03-001',
      effectivenessReference: 'QR-28-03-002',
      effectivenessVerifiedBy: '品保主管',
      effectivenessVerifiedAt: '2026-04-01',
    }
    expect(canTransitionNcrStatus(ncr, '結案').ok).toBe(true)
  })
})

describe('ncrReportProgress', () => {
  const base: NCR = normalizeNCR({
    id: 'n1',
    ncrNumber: 'NCR-2026-001',
    qpCode: 'QP-01',
    departmentId: 'd1',
    department: '管理部',
    process: 'p',
    description: '',
    date: '',
    status: '開立',
  })

  it('marks all stages incomplete for empty draft', () => {
    const stages = ncrReportProgress(base)
    expect(stages.map((s) => s.complete)).toEqual([false, false, false, false])
    expect(stages.map((s) => s.statusLabel)).toEqual(['未填', '未填', '未填', '未結'])
  })

  it('evaluates each stage independently', () => {
    const stages = ncrReportProgress({
      ...base,
      description: '發現',
      rootCause: '原因',
      correctiveAction: '措施',
      status: '矯正中',
    })
    expect(stages.map((s) => s.complete)).toEqual([true, true, true, false])
  })

  it('marks closed only when status is 結案', () => {
    const stages = ncrReportProgress({ ...base, description: 'x', status: '結案' })
    expect(stages.find((s) => s.id === 'closed')).toEqual({
      id: 'closed',
      label: '結案',
      complete: true,
      statusLabel: '已結',
    })
  })
})

describe('ncrDraftEquals', () => {
  it('detects field changes', () => {
    const a = normalizeNCR({
      id: 'n1',
      ncrNumber: 'NCR-2026-001',
      qpCode: 'QP-01',
      departmentId: 'd1',
      department: '管理部',
      process: 'p',
      description: 'a',
      date: '',
      status: '開立',
    })
    const b = { ...a, rootCause: 'new' }
    expect(ncrDraftEquals(a, a)).toBe(true)
    expect(ncrDraftEquals(a, b)).toBe(false)
  })
})
