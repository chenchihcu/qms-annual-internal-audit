import { describe, it, expect } from 'vitest'
import {
  collectObservationsFromAudits,
  listAuditObservationEntries,
  promoteObservationToNcr,
} from '../observation'
import type { ChecklistItem, CompanyData, Observation, ProcedureAudit } from '../../types'

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

describe('collectObservationsFromAudits', () => {
  it('creates observation for 觀察 items', () => {
    const items: ChecklistItem[] = [
      {
        id: 'chk-1',
        category: '測試',
        no: 1,
        content: '觀察內容',
        judgment: '觀察',
        description: '說明',
      },
    ]
    const obs = collectObservationsFromAudits([baseAudit(items)], 2026, [])
    expect(obs).toHaveLength(1)
    expect(obs[0].carriedToChecklistId).toBe('chk-1')
    expect(obs[0].status).toBe('open')
  })

  it('does not duplicate observation for same checklist item', () => {
    const items: ChecklistItem[] = [
      {
        id: 'chk-1',
        category: '測試',
        no: 1,
        content: 'c',
        judgment: '觀察',
        description: '',
      },
    ]
    const first = collectObservationsFromAudits([baseAudit(items)], 2026, [])
    const second = collectObservationsFromAudits([baseAudit(items)], 2026, first)
    expect(second).toHaveLength(1)
  })
})

describe('listAuditObservationEntries', () => {
  it('includes dual-certificate observation judgments', () => {
    const items: ChecklistItem[] = [
      {
        id: 'chk-dual',
        category: '測試',
        no: 1,
        content: '雙證觀察',
        judgment: null,
        description: '',
        certificateScope: 'dual',
        judgmentByCompany: { jiurun: '觀察', zhenglongxing: '符合' },
      },
    ]
    const entries = listAuditObservationEntries([baseAudit(items)])
    expect(entries).toHaveLength(1)
    expect(entries[0].sideLabel).toBe('九潤精密')
  })

  it('creates observation records for dual-certificate 觀察 sides', () => {
    const items: ChecklistItem[] = [
      {
        id: 'chk-dual',
        category: '測試',
        no: 1,
        content: '雙證觀察',
        judgment: null,
        description: '說明',
        certificateScope: 'dual',
        judgmentByCompany: { jiurun: '觀察', zhenglongxing: '符合' },
      },
    ]
    const obs = collectObservationsFromAudits([baseAudit(items)], 2026, [])
    expect(obs).toHaveLength(1)
    expect(obs[0].id).toBe('obs-chk-chk-dual-jiurun')
    expect(obs[0].companySide).toBe('jiurun')
  })
})

describe('promoteObservationToNcr', () => {
  const baseCompany = (): CompanyData => ({
    name: '測試公司',
    departments: [],
    planRows: [],
    audits: [],
    ncrs: [],
    observations: [
      {
        id: 'obs-1',
        year: 2025,
        qpCode: 'QP-01',
        departmentId: 'd1',
        department: '管理部',
        process: 'p',
        content: '觀察內容',
        description: '說明',
        status: 'open',
      },
    ],
    suggestions: [],
  })

  it('creates NCR and marks observation became_ncr', () => {
    const result = promoteObservationToNcr(baseCompany(), 'obs-1', 2026)
    expect(result).not.toBeNull()
    expect(result!.ncrs).toHaveLength(1)
    expect(result!.ncrs[0].id).toBe('ncr-from-obs-obs-1')
    expect(result!.observations[0].status).toBe('became_ncr')
  })

  it('is idempotent when called again', () => {
    const first = promoteObservationToNcr(baseCompany(), 'obs-1', 2026)!
    const company: CompanyData = {
      ...baseCompany(),
      ncrs: first.ncrs,
      observations: first.observations,
    }
    const second = promoteObservationToNcr(company, 'obs-1', 2026)!
    expect(second.ncrs).toHaveLength(1)
    expect(second.observations[0].status).toBe('became_ncr')
  })

  it('keeps NCR when observation reverts to open', () => {
    const promoted = promoteObservationToNcr(baseCompany(), 'obs-1', 2026)!
    const reopened: Observation[] = promoted.observations.map((o) =>
      o.id === 'obs-1' ? { ...o, status: 'open' } : o,
    )
    expect(promoted.ncrs).toHaveLength(1)
    expect(reopened[0].status).toBe('open')
    expect(promoted.ncrs[0].description).toContain('觀察內容')
  })
})
