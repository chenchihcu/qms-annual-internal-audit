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
  trainee_auditor: '實習稽核員',
  management_representative: '管理代表',
  annual_escort: '本年度陪稽核員',
  third_party_lead_auditor: '第三方主任稽核員',
  third_party_auditor: '第三方稽核員',
}

/** 內部稽核人員資格表單用標籤 */
export const AUDITOR_QUALIFICATION_FORM_LABELS: Record<
  'internal_auditor' | 'internal_lead_auditor' | 'trainee_auditor',
  string
> = {
  internal_auditor: '內部稽核員',
  internal_lead_auditor: '主導稽核員',
  trainee_auditor: '實習稽核員',
}

export const AUDITOR_QUALIFICATION_ROLES = [
  'internal_auditor',
  'internal_lead_auditor',
  'trainee_auditor',
] as const

export type AuditorQualificationRole = (typeof AUDITOR_QUALIFICATION_ROLES)[number]

export function isAuditorQualificationRole(
  role: PersonnelRole,
): role is AuditorQualificationRole {
  return role === 'internal_auditor' || role === 'internal_lead_auditor' || role === 'trainee_auditor'
}

export function isAssignableAuditorQualificationRole(role: PersonnelRole): boolean {
  return role === 'internal_auditor' || role === 'internal_lead_auditor'
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
  if (qualification.qualificationStatus === 'invalid') return 'ended'
  if (qualification.qualificationStatus === 'suspended') return 'suspended'
  if (qualification.qualificationStatus === 'effective') return 'effective'
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

export function managedQualificationStatusLabel(
  qualification: QualificationRecord,
  onDate: string,
): string {
  if (qualification.qualificationStatus === 'effective') return '有效'
  if (qualification.qualificationStatus === 'suspended') return '暫停'
  if (qualification.qualificationStatus === 'invalid') return '失效'
  const state = qualificationState(qualification, onDate)
  if (state === 'effective') return '有效'
  if (state === 'suspended') return '暫停'
  if (state === 'ended' || state === 'expired') return '失效'
  return QUALIFICATION_STATE_LABELS[state]
}

export function currentAuditorQualification(
  person: Person,
  onDate?: string,
): QualificationRecord | undefined {
  const date = onDate ?? new Date().toISOString().slice(0, 10)
  return person.qualifications.toReversed().find((item) => (
    isAuditorQualificationRole(item.role)
    && (!item.supersededAt || item.supersededAt > date)
  ))
}

function qualificationMatchesScope(
  q: QualificationRecord,
  companyId: CompanyId,
  _qpCode: string,
  _departmentId: string,
  onDate: string,
  _requiredStandards: string[],
) {
  if (!isAssignableAuditorQualificationRole(q.role)) return false
  const companyMatch = q.companyIds.length === 0 || q.companyIds.includes(companyId)
  return companyMatch && qualificationState(q, onDate) === 'effective'
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

function qualificationMatchScore(
  q: QualificationRecord,
  qpCode: string,
  departmentId: string,
): number {
  let score = 0
  if (q.procedureScopes.length === 0 || scopeIncludes(q.procedureScopes, qpCode)) score += 4
  else score -= 8
  if (q.departmentScopes.length === 0 || scopeIncludes(q.departmentScopes, departmentId)) score += 2
  else score -= 4
  return score
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
  if (matches.length === 0) return undefined
  const rolePool = role === 'internal_lead_auditor'
    ? matches.filter((qualification) => qualification.role === 'internal_lead_auditor')
    : matches.filter((qualification) => qualification.role === 'internal_auditor')
  const pool = rolePool.length > 0 ? rolePool : matches
  return [...pool].sort((left, right) => (
    qualificationMatchScore(right, qpCode, departmentId) - qualificationMatchScore(left, qpCode, departmentId)
  ))[0]
}

export function findActiveLeadAppointment(
  person: Person,
  companyId: CompanyId,
  onDate: string,
): RoleAppointment | undefined {
  return person.appointments.find((appointment) => (
    appointment.role === 'internal_lead_auditor'
    && appointment.companyId === companyId
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
  /** 主任稽核員或稽核員（不含陪同）所屬單位與受稽單位相同 */
  sameDepartmentConflict: boolean
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
  let sameDepartmentConflict = false
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
    if (sameDepartment) {
      sameDepartmentConflict = true
      warnings.push(`${person.name} 所屬單位與受稽單位相同，請確認客觀性控制`)
    }
  })

  if (sameDepartmentConflict && !team?.impartialityConfirmed) {
    errors.push('客觀性風險尚未確認')
  }
  return { canStart: errors.length === 0, errors, warnings, sameDepartmentConflict }
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

/** 符合此次日期的可指派內部稽核員（不含實習；不再以 QP／部門／人員標準版本限縮） */
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
