import { describe, expect, it } from 'vitest'
import type { Person, QualificationRecord } from '../../types'
import {
  auditorCandidates,
  departmentMemberCandidates,
  formatScopeList,
  QUALIFICATION_SCOPE_ALL,
  qualificationState,
  scopeIncludes,
  validateAuditTeam,
  verifierCandidates,
} from '../personnel'

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

  it('blocks audit start when no qualified person IDs are assigned', () => {
    const team = {
      leadAuditorPersonId: undefined,
      auditorPersonIds: [],
      escortPersonIds: [],
      impartialityConfirmed: false,
      impartialityNote: '',
    }
    const result = validateAuditTeam([person], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01')

    expect(result.canStart).toBe(false)
    expect(result.errors).toContain('尚未指派主任稽核員')
    expect(result.errors).toContain('尚未指派合格內部稽核員')
  })

  it('keeps same-department impartiality separate from qualification', () => {
    const sameDepartment = { ...person, affiliations: [{ id: 'a1', companyId: 'jiurun' as const, departmentId: 'dept-qa' }] }
    const team = { leadAuditorPersonId: 'p1', auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: false, impartialityNote: '' }
    const result = validateAuditTeam([sameDepartment], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01')
    expect(result.sameDepartmentConflict).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.errors).toContain('客觀性風險尚未確認')
  })

  it('does not flag same-department conflict when lead and auditors are from other departments', () => {
    const team = { leadAuditorPersonId: 'p1', auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: false, impartialityNote: '' }
    const result = validateAuditTeam([person], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01')
    expect(result.sameDepartmentConflict).toBe(false)
    expect(result.errors).not.toContain('客觀性風險尚未確認')
  })

  it('allows start when impartiality is confirmed and the stored note is empty', () => {
    const sameDepartment = { ...person, affiliations: [{ id: 'a1', companyId: 'jiurun' as const, departmentId: 'dept-qa' }] }
    const team = { leadAuditorPersonId: 'p1', auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: true, impartialityNote: '' }
    const result = validateAuditTeam([sameDepartment], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01')
    expect(result.canStart).toBe(true)
    expect(result.sameDepartmentConflict).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.errors).not.toContain('已確認客觀性時須填寫控制措施或判斷依據')
    expect(team.impartialityNote).toBe('')
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

  it('treats scope sentinel as matching any procedure, department, and confirmed standard', () => {
    const team = {
      leadAuditorPersonId: 'p1',
      auditorPersonIds: [],
      escortPersonIds: [],
      impartialityConfirmed: true,
      impartialityNote: '職責分離已確認',
    }
    const allScopes = {
      ...person,
      qualifications: [qualification({
        procedureScopes: [QUALIFICATION_SCOPE_ALL],
        departmentScopes: [QUALIFICATION_SCOPE_ALL],
        standardVersions: [QUALIFICATION_SCOPE_ALL],
      })],
    }
    expect(validateAuditTeam([allScopes], team, 'jiurun', 'QP-01', 'dept-admin', '2026-06-01', ['ISO 9001:2015']).canStart).toBe(true)
  })

  it('still blocks when explicit procedure list excludes the audit event', () => {
    const team = { leadAuditorPersonId: 'p1', auditorPersonIds: [], escortPersonIds: [], impartialityConfirmed: false, impartialityNote: '' }
    const narrow = { ...person, qualifications: [qualification({ procedureScopes: ['QP-01'] })] }
    const result = validateAuditTeam([narrow], team, 'jiurun', 'QP-28', 'dept-qa', '2026-06-01')
    expect(result.canStart).toBe(false)
    expect(result.errors.some((error) => error.includes('缺少符合此次範圍'))).toBe(true)
  })

  it('formats scope lists without printing the sentinel', () => {
    expect(scopeIncludes([QUALIFICATION_SCOPE_ALL], 'QP-99')).toBe(true)
    expect(scopeIncludes(['QP-28'], 'QP-01')).toBe(false)
    expect(formatScopeList([], '全部程序')).toBe('範圍待確認')
    expect(formatScopeList([QUALIFICATION_SCOPE_ALL], '全部程序')).toBe('全部程序')
    expect(formatScopeList(['QP-28', 'QP-01'], '全部程序')).toBe('QP-28、QP-01')
  })

  it('lists auditor candidates by effective qualification scope', () => {
    expect(auditorCandidates([person], 'jiurun', 'QP-28', 'dept-qa', '2026-06-01').map((p) => p.id)).toEqual(['p1'])
    expect(auditorCandidates([person], 'jiurun', 'QP-01', 'dept-qa', '2026-06-01')).toHaveLength(0)
  })

  it('lists department members by affiliation', () => {
    const deptMember = {
      ...person,
      id: 'p2',
      name: '部門員工',
      affiliations: [{ id: 'a2', companyId: 'jiurun' as const, departmentId: 'dept-qa' }],
    }
    const members = departmentMemberCandidates([person, deptMember], 'jiurun', 'dept-qa', '2026-06-01')
    expect(members.map((p) => p.id)).toEqual(['p2'])
  })

  it('lists verifier candidates from lead auditor and management representative', () => {
    const lead = {
      ...person,
      appointments: [{
        id: 'lead-app',
        role: 'internal_lead_auditor' as const,
        companyId: 'jiurun' as const,
        documentReference: 'LA-001',
        scope: '年度內部稽核',
        effectiveFrom: '2026-01-01',
      }],
    }
    const mgr = {
      ...person,
      id: 'p2',
      name: '管理代表甲',
      appointments: [],
      qualifications: [qualification({ role: 'management_representative' })],
    }
    const verifiers = verifierCandidates([lead, mgr], 'jiurun', 2026, [], '2026-06-01')
    expect(verifiers.map((p) => p.name)).toEqual(['管理代表甲', '稽核員甲'])
  })
})
