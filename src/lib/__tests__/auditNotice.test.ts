import { describe, expect, it } from 'vitest'
import { markAuditNotified, normalizeAuditNotice } from '../auditNotice'
import type { ProcedureAudit } from '../../types'

const baseAudit = (overrides: Partial<ProcedureAudit> = {}): ProcedureAudit => ({
  id: 'audit-1',
  qpCode: 'QP-01',
  departmentId: 'dept-qa',
  department: '品保部',
  process: 'p',
  documents: 'd',
  notifyDate: '',
  auditDate: '2026-08-15',
  departmentManager: '品保部經理',
  auditors: '王稽核',
  auditCategory: '型態稽核',
  items: [],
  ...overrides,
})

describe('markAuditNotified', () => {
  it('sets notifySent and fills notifyDate when empty', () => {
    const result = markAuditNotified(baseAudit(), '2026-09-13')
    expect(result.notifySent).toBe(true)
    expect(result.notifyDate).toBe('2026-09-13')
  })

  it('preserves existing notifyDate when marking notified', () => {
    const result = markAuditNotified(baseAudit({ notifyDate: '2026-08-01' }), '2026-09-13')
    expect(result.notifySent).toBe(true)
    expect(result.notifyDate).toBe('2026-08-01')
  })
})

describe('normalizeAuditNotice', () => {
  it('defaults notifySent to false for legacy audits', () => {
    const legacy = baseAudit()
    delete (legacy as Partial<ProcedureAudit>).notifySent
    expect(normalizeAuditNotice(legacy).notifySent).toBe(false)
  })
})
