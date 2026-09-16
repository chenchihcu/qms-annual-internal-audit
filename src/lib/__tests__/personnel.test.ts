import { describe, expect, it } from 'vitest'
import type { Person, QualificationRecord } from '../../types'
import { qualificationState, validateAuditTeam } from '../personnel'

const qualification = (patch: Partial<QualificationRecord> = {}): QualificationRecord => ({
  id: 'q1', role: 'internal_lead_auditor', companyIds: ['jiurun'], standardVersions: ['ISO 9001:2015'],
  procedureScopes: ['QP-28'], departmentScopes: ['dept-qa'], documentTitle: '資格核准單', documentNumber: 'Q-001',
  documentLocation: 'DMS', assessedBy: '管理代表', assessmentDate: '2026-01-01', effectiveFrom: '2026-01-01',
  validityMode: 'fixed', effectiveTo: '2026-12-31', ...patch,
})

const person: Person = {
  id: 'p1', name: '稽核員甲', employeeNumber: 'A001', type: 'internal', active: true, notes: '',
  affiliations: [{ id: 'a1', companyId: 'jiurun', departmentId: 'dept-admin' }],
  qualifications: [qualification()], appointments: [],
}

describe('personnel qualification validation', () => {
  it('distinguishes fixed expiry from pending and no-expiry records', () => {
    expect(qualificationState(qualification(), '2026-06-01')).toBe('effective')
    expect(qualificationState(qualification(), '2027-01-01')).toBe('expired')
    expect(qualificationState(qualification({ validityMode: 'pending', effectiveTo: undefined }), '2026-06-01')).toBe('pending')
    expect(qualificationState(qualification({ validityMode: 'no_expiry', effectiveTo: undefined }), '2030-01-01')).toBe('effective')
  })

  it('allows a qualified in-scope lead and blocks an expired one', () => {
    const team = { leadAuditorPersonId: 'p1', auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: false, impartialityNote: '' }
    expect(validateAuditTeam([person], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01').canStart).toBe(true)
    expect(validateAuditTeam([person], team, 'jiurun', 'QP-28', 'dept-qa', '2027-01-01').canStart).toBe(false)
  })

  it('keeps same-department impartiality separate from qualification', () => {
    const sameDepartment = { ...person, affiliations: [{ id: 'a1', companyId: 'jiurun' as const, departmentId: 'dept-qa' }] }
    const team = { leadAuditorPersonId: 'p1', auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: false, impartialityNote: '' }
    const result = validateAuditTeam([sameDepartment], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01')
    expect(result.warnings).toHaveLength(1)
    expect(result.errors).toContain('客觀性風險尚未確認')
  })

  it('keeps an incomplete scope in draft rather than treating it as all procedures', () => {
    const incomplete = { ...person, qualifications: [qualification({ procedureScopes: [] })] }
    const team = { leadAuditorPersonId: 'p1', auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: false, impartialityNote: '' }
    const result = validateAuditTeam([incomplete], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01')
    expect(result.canStart).toBe(false)
    expect(result.errors.some((error) => error.includes('缺少符合此次範圍'))).toBe(true)
  })

  it('requires lead qualification or an active lead appointment in addition to audit qualification', () => {
    const internalAuditor = {
      ...person,
      qualifications: [qualification({ role: 'internal_auditor' })],
      appointments: [],
    }
    const team = { leadAuditorPersonId: 'p1', auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: false, impartialityNote: '' }
    const blocked = validateAuditTeam([internalAuditor], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01')
    expect(blocked.errors).toContain('稽核員甲 在 2026-06-01 缺少主任稽核員資格或有效任命')

    const appointed = {
      ...internalAuditor,
      appointments: [{
        id: 'appointment-1',
        role: 'internal_lead_auditor' as const,
        companyId: 'jiurun' as const,
        documentReference: '任命書 LA-001',
        scope: '年度內部稽核',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-12-31',
      }],
    }
    expect(validateAuditTeam([appointed], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01').canStart).toBe(true)
  })
})
