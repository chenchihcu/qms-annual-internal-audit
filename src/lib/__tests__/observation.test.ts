import { describe, it, expect } from 'vitest'
import { collectObservationsFromAudits } from '../observation'
import type { ChecklistItem, ProcedureAudit } from '../../types'

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
