import type {
  AuditTeamAssignment,
  CompanyId,
  Person,
  PersonnelRole,
  QualificationRecord,
  QualificationState,
  RoleAppointment,
} from '../types'

export const PERSONNEL_ROLE_LABELS: Record<PersonnelRole, string> = {
  internal_auditor: '合格內部稽核員',
  internal_lead_auditor: '主任稽核員（內部）',
  management_representative: '管理代表',
  annual_escort: '本年度陪稽核員',
  third_party_lead_auditor: '第三方主任稽核員',
  third_party_auditor: '第三方稽核員',
}

export const QUALIFICATION_STATE_LABELS: Record<QualificationState, string> = {
  pending: '待確認',
  effective: '有效',
  not_effective: '未生效',
  expired: '已逾期',
  suspended: '已暫停',
  ended: '已終止',
}

/** Sentinel: scope array contains only this value when user selects「全部」. */
export const QUALIFICATION_SCOPE_ALL = '*'

export function scopeIncludes(scopes: string[], value: string): boolean {
  if (scopes.includes(QUALIFICATION_SCOPE_ALL)) return true
  return scopes.includes(value)
}

export function formatScopeList(scopes: string[], allLabel: string): string {
  if (scopes.length === 0) return '範圍待確認'
  if (scopes.includes(QUALIFICATION_SCOPE_ALL)) return allLabel
  return scopes.join('、')
}

export function formatQualificationScopeSummary(qualification: QualificationRecord): string {
  const parts = [
    formatScopeList(qualification.standardVersions, '全部標準'),
    formatScopeList(qualification.procedureScopes, '全部程序'),
    formatScopeList(qualification.departmentScopes, '全部責任單位'),
  ].filter((part) => part !== '範圍待確認')
  return parts.length > 0 ? parts.join('／') : '範圍待確認'
}

export function qualificationState(
  qualification: QualificationRecord,
  onDate: string,
): QualificationState {
  if (qualification.supersededAt && qualification.supersededAt <= onDate) return 'ended'
  if (qualification.endedAt && qualification.endedAt <= onDate) return 'ended'
  if (qualification.suspendedAt && qualification.suspendedAt <= onDate) return 'suspended'
  if (
    !qualification.documentTitle ||
    !qualification.documentNumber ||
    !qualification.assessedBy ||
    !qualification.effectiveFrom ||
    qualification.validityMode === 'pending'
  ) {
    return 'pending'
  }
  if (qualification.effectiveFrom > onDate) return 'not_effective'
  if (
    qualification.validityMode === 'fixed' &&
    (!qualification.effectiveTo || qualification.effectiveTo < onDate)
  ) {
    return qualification.effectiveTo ? 'expired' : 'pending'
  }
  return 'effective'
}

function qualificationMatchesScope(
  q: QualificationRecord,
  companyId: CompanyId,
  qpCode: string,
  departmentId: string,
  onDate: string,
  requiredStandards: string[],
) {
  const roleMatch = q.role === 'internal_auditor' || q.role === 'internal_lead_auditor'
  const companyMatch = q.companyIds.includes(companyId)
  const procedureMatch = scopeIncludes(q.procedureScopes, qpCode)
  const departmentMatch = scopeIncludes(q.departmentScopes, departmentId)
  const normalized = q.standardVersions.map((value) => value.toLowerCase().replace(/\s+/g, ''))
  const standardMatch = requiredStandards.length === 0
    || scopeIncludes(q.standardVersions, QUALIFICATION_SCOPE_ALL)
    || requiredStandards.every((required) => {
      const name = required.split(':')[0].toLowerCase().replace(/\s+/g, '')
      return normalized.some((value) => value.includes(name))
    })
  return roleMatch && companyMatch && procedureMatch && departmentMatch && standardMatch && qualificationState(q, onDate) === 'effective'
}

export function matchingAuditQualifications(
  person: Person,
  companyId: CompanyId,
  qpCode: string,
  departmentId: string,
  onDate: string,
  requiredStandards: string[] = [],
): QualificationRecord[] {
  return person.qualifications.filter((qualification) => qualificationMatchesScope(
    qualification,
    companyId,
    qpCode,
    departmentId,
    onDate,
    requiredStandards,
  ))
}

export function findMatchingAuditQualification(
  person: Person,
  role: 'internal_auditor' | 'internal_lead_auditor',
  companyId: CompanyId,
  qpCode: string,
  departmentId: string,
  onDate: string,
  requiredStandards: string[] = [],
): QualificationRecord | undefined {
  const matches = matchingAuditQualifications(person, companyId, qpCode, departmentId, onDate, requiredStandards)
  if (role === 'internal_lead_auditor') {
    return matches.find((qualification) => qualification.role === 'internal_lead_auditor') ?? matches[0]
  }
  return matches[0]
}

export function findActiveLeadAppointment(
  person: Person,
  companyId: CompanyId,
  onDate: string,
): RoleAppointment | undefined {
  return person.appointments.find((appointment) => (
    appointment.role === 'internal_lead_auditor'
    && appointment.companyId === companyId
    && Boolean(appointment.documentReference.trim())
    && Boolean(appointment.effectiveFrom)
    && appointment.effectiveFrom <= onDate
    && (!appointment.effectiveTo || appointment.effectiveTo >= onDate)
    && (!appointment.supersededAt || appointment.supersededAt > onDate)
  ))
}

export interface AuditTeamValidation {
  canStart: boolean
  errors: string[]
  warnings: string[]
}

export function validateAuditTeam(
  people: Person[],
  team: AuditTeamAssignment | undefined,
  companyId: CompanyId,
  qpCode: string,
  departmentId: string,
  auditDate: string,
  requiredStandards: string[] = [],
): AuditTeamValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const onDate = auditDate || new Date().toISOString().slice(0, 10)
  const byId = new Map(people.map((person) => [person.id, person]))

  if (!auditDate) errors.push('稽核日期尚未確認')

  if (!team?.leadAuditorPersonId) errors.push('尚未指派主任稽核員')
  const auditorIds = [team?.leadAuditorPersonId, ...(team?.auditorPersonIds ?? [])].filter(Boolean) as string[]
  if (auditorIds.length === 0) errors.push('尚未指派合格內部稽核員')

  auditorIds.forEach((id, index) => {
    const person = byId.get(id)
    if (!person || !person.active) {
      errors.push(`稽核人員 ${id} 不存在或已停用`)
      return
    }
    const affiliated = person.affiliations.some((affiliation) => (
      affiliation.companyId === companyId
      && (!affiliation.effectiveFrom || affiliation.effectiveFrom <= onDate)
      && (!affiliation.effectiveTo || affiliation.effectiveTo >= onDate)
    ))
    if (!affiliated) errors.push(`${person.name} 在 ${onDate} 沒有符合此次公司的有效所屬關係`)
    const role = index === 0 ? 'internal_lead_auditor' : 'internal_auditor'
    const matchingQualifications = matchingAuditQualifications(
      person,
      companyId,
      qpCode,
      departmentId,
      onDate,
      requiredStandards,
    )
    if (matchingQualifications.length === 0) {
      errors.push(`${person.name} 在 ${onDate} 缺少符合此次範圍的有效資格`)
    }
    if (
      role === 'internal_lead_auditor'
      && !matchingQualifications.some((qualification) => qualification.role === 'internal_lead_auditor')
      && !findActiveLeadAppointment(person, companyId, onDate)
    ) {
      errors.push(`${person.name} 在 ${onDate} 缺少主任稽核員資格或有效任命`)
    }
    const sameDepartment = person.affiliations.some(
      (a) => a.companyId === companyId && a.departmentId === departmentId && (!a.effectiveTo || a.effectiveTo >= onDate),
    )
    if (sameDepartment) warnings.push(`${person.name} 所屬單位與受稽單位相同，請確認客觀性控制`)
  })

  if (warnings.length > 0 && !team?.impartialityConfirmed) {
    errors.push('客觀性風險尚未確認')
  }
  if (team?.impartialityConfirmed && !team.impartialityNote.trim()) {
    errors.push('已確認客觀性時須填寫控制措施或判斷依據')
  }
  return { canStart: errors.length === 0, errors, warnings }
}

export function resolveLeadAuditorPersonId(
  people: Person[],
  companyId: CompanyId,
  year: number,
  annualRoles: Array<{ personId: string; year: number; companyId?: CompanyId; role: PersonnelRole }>,
  onDate?: string,
): string | undefined {
  const date = onDate ?? `${year}-12-31`
  const annualLead = annualRoles.find(
    (item) => item.year === year && item.companyId === companyId && item.role === 'internal_lead_auditor',
  )
  if (annualLead) return annualLead.personId
  for (const person of people) {
    if (!person.active) continue
    if (findActiveLeadAppointment(person, companyId, date)) return person.id
  }
  return undefined
}

export function leadAuditorCandidates(
  people: Person[],
  year: number,
  annualRoles: Array<{ personId: string; year: number; role: PersonnelRole }>,
): Person[] {
  return people.filter(
    (person) => person.active && personRoles(person, year, annualRoles).includes('internal_lead_auditor'),
  )
}

export function personRoles(person: Person, year: number, annualRoles: Array<{ personId: string; year: number; role: PersonnelRole }>): PersonnelRole[] {
  const roles = new Set<PersonnelRole>()
  person.qualifications.forEach((q) => roles.add(q.role))
  person.appointments.forEach((a) => roles.add(a.role))
  annualRoles.filter((a) => a.personId === person.id && a.year === year).forEach((a) => roles.add(a.role))
  return [...roles]
}

function affiliationActiveOnDate(
  affiliation: Person['affiliations'][number],
  companyId: CompanyId,
  departmentId: string,
  onDate: string,
): boolean {
  return (
    affiliation.companyId === companyId
    && affiliation.departmentId === departmentId
    && (!affiliation.effectiveFrom || affiliation.effectiveFrom <= onDate)
    && (!affiliation.effectiveTo || affiliation.effectiveTo >= onDate)
  )
}

function sortPeopleByName(people: Person[]): Person[] {
  return [...people].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
}

/** 符合此次 QP／部門／日期的有效內部稽核員（含主任稽核員資格） */
export function auditorCandidates(
  people: Person[],
  companyId: CompanyId,
  qpCode: string,
  departmentId: string,
  onDate: string,
  requiredStandards: string[] = [],
): Person[] {
  const date = onDate || new Date().toISOString().slice(0, 10)
  return sortPeopleByName(
    people.filter(
      (person) => person.active
        && matchingAuditQualifications(person, companyId, qpCode, departmentId, date, requiredStandards).length > 0,
    ),
  )
}

/** 指定公司與責任單位的在職所屬人員 */
export function departmentMemberCandidates(
  people: Person[],
  companyId: CompanyId,
  departmentId: string,
  onDate: string,
): Person[] {
  const date = onDate || new Date().toISOString().slice(0, 10)
  return sortPeopleByName(
    people.filter(
      (person) => person.active
        && person.affiliations.some((affiliation) => affiliationActiveOnDate(affiliation, companyId, departmentId, date)),
    ),
  )
}

/** 效果確認人、評定／確認人：本年度主任稽核員與管理代表 */
export function verifierCandidates(
  people: Person[],
  companyId: CompanyId,
  year: number,
  annualRoles: Array<{ personId: string; year: number; companyId?: CompanyId; role: PersonnelRole }>,
  onDate?: string,
): Person[] {
  const date = onDate ?? `${year}-12-31`
  const result: Person[] = []
  const seen = new Set<string>()

  const leadId = resolveLeadAuditorPersonId(people, companyId, year, annualRoles, date)
  if (leadId) {
    const lead = people.find((person) => person.id === leadId)
    if (lead?.active) {
      result.push(lead)
      seen.add(lead.id)
    }
  }

  people.forEach((person) => {
    if (!person.active || seen.has(person.id)) return
    const roles = personRoles(person, year, annualRoles)
    const hasMgrRole = roles.includes('management_representative')
    const hasAppointment = person.appointments.some(
      (appointment) => (
        appointment.role === 'management_representative'
        && appointment.companyId === companyId
        && Boolean(appointment.documentReference.trim())
        && Boolean(appointment.effectiveFrom)
        && appointment.effectiveFrom <= date
        && (!appointment.effectiveTo || appointment.effectiveTo >= date)
        && (!appointment.supersededAt || appointment.supersededAt > date)
      ),
    )
    if (hasMgrRole || hasAppointment) {
      result.push(person)
      seen.add(person.id)
    }
  })

  return sortPeopleByName(result)
}
