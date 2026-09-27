import type {
  AppState,
  AuditSettings,
  CompanyData,
  CompanyId,
  CompanyRelationship,
  DepartmentProfile,
  ExternalAuditPrepItemState,
  ExternalAuditPrepState,
  Person,
  PlanRow,
  ProcedureAudit,
  WorkspaceMigrationCandidate,
  WorkspaceMigrationConflict,
  WorkspaceMigrationTarget,
  YearArchiveEntry,
} from '../types'
import { relationshipCheckKey } from '../types'
import { DEFAULT_COMPANY_RELATIONSHIPS, getPrepTemplateForState } from './externalAuditPrep'

/** Kept only as a stable storage key for code that still indexes the v8 maps. */
export const WORKSPACE_COMPANY_ID: CompanyId = 'jiurun'
export const SINGLE_WORKSPACE_STORAGE_VERSION = 14

const OTHER_LEGACY_ID: CompanyId = 'zhenglongxing'

function emptyCompanyData(name: string): CompanyData {
  return {
    name,
    keyCustomerName: '',
    departments: [],
    planRows: [],
    audits: [],
    ncrs: [],
    observations: [],
    suggestions: [],
    procedureRisks: [],
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function nextConflictId(conflicts: WorkspaceMigrationConflict[], prefix: string): string {
  return `${prefix}-${conflicts.length + 1}`
}

function addChoiceConflict(
  conflicts: WorkspaceMigrationConflict[],
  category: WorkspaceMigrationConflict['category'],
  title: string,
  summary: string,
  target: WorkspaceMigrationTarget,
  left: { source: string; value: unknown },
  right: { source: string; value: unknown },
): void {
  conflicts.push({
    id: nextConflictId(conflicts, 'review'),
    category,
    title,
    summary,
    target,
    candidates: [left, right].map(({ source, value }): WorkspaceMigrationCandidate => ({
      source,
      label: `${source}：${displayValue(value)}`,
      value,
    })),
  })
}

function addManualConflict(
  conflicts: WorkspaceMigrationConflict[],
  category: WorkspaceMigrationConflict['category'],
  title: string,
  summary: string,
  target: WorkspaceMigrationTarget = { kind: 'manual' },
): void {
  conflicts.push({
    id: nextConflictId(conflicts, 'review'),
    category,
    title,
    summary,
    target,
  })
}

function displayValue(value: unknown): string {
  if (value == null || value === '') return '空白'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return '內容無法顯示'
  }
}

function mergeField<T extends Record<string, unknown>>(
  left: T,
  right: T,
  field: keyof T & string,
  target: WorkspaceMigrationTarget,
  conflicts: WorkspaceMigrationConflict[],
  category: WorkspaceMigrationConflict['category'],
  title: string,
  sourceLabels: [string, string],
): T[keyof T] {
  const a = left[field]
  const b = right[field]
  if (!hasValue(a)) return b as T[keyof T]
  if (!hasValue(b) || sameValue(a, b)) return a as T[keyof T]
  addChoiceConflict(
    conflicts,
    category,
    title,
    `合併欄位「${field}」時發現不同內容。選定一個值後，系統會套用到合併後資料。`,
    target,
    { source: sourceLabels[0], value: a },
    { source: sourceLabels[1], value: b },
  )
  return a as T[keyof T]
}

const PLAN_CONFLICT_FIELDS: Array<keyof PlanRow & string> = [
  'riskLevel', 'department', 'process', 'documents', 'auditUnit', 'owner', 'auditors', 'auditCategory',
]

function planKey(row: Pick<PlanRow, 'qpCode' | 'departmentId'>): string {
  return `${row.qpCode}|${row.departmentId}`
}

function mergePlanRows(
  left: PlanRow[],
  right: PlanRow[],
  conflicts: WorkspaceMigrationConflict[],
): PlanRow[] {
  const merged = new Map<string, PlanRow>()
  for (const row of left) merged.set(planKey(row), { ...row, months: [...row.months] })
  for (const incoming of right) {
    const key = planKey(incoming)
    const current = merged.get(key)
    if (!current) {
      merged.set(key, { ...incoming, months: [...incoming.months] })
      continue
    }
    const next = { ...current } as PlanRow
    for (const field of PLAN_CONFLICT_FIELDS) {
      ;(next as unknown as Record<string, unknown>)[field] = mergeField(
        current as unknown as Record<string, unknown>,
        incoming as unknown as Record<string, unknown>,
        field,
        { kind: 'plan', rowId: current.id, field },
        conflicts,
        'plan',
        `${current.qpCode} · ${current.department}：${field}`,
        ['來源資料一', '來源資料二'],
      )
    }
    next.months = Array.from({ length: 12 }, (_, index) => current.months[index] ?? incoming.months[index] ?? null)
    const currentOverrides = current.manualMonthOverrides ?? Array<PlanRow['months'][number]>(12).fill(null)
    const incomingOverrides = incoming.manualMonthOverrides ?? Array<PlanRow['months'][number]>(12).fill(null)
    next.manualMonthOverrides = Array.from({ length: 12 }, (_, index) => {
      const a = currentOverrides[index]
      const b = incomingOverrides[index]
      if (!a) return b ?? null
      if (!b || a === b) return a
      addChoiceConflict(
        conflicts,
        'plan',
        `${current.qpCode} · ${current.department}：第 ${index + 1} 月結果`,
        '兩份舊計畫的月格結果不同；請核對稽核紀錄後選擇。',
        { kind: 'plan', rowId: current.id, field: 'manualMonthOverrides', monthIndex: index },
        { source: '來源資料一', value: a },
        { source: '來源資料二', value: b },
      )
      return a
    })
    next.manualOverride = current.manualOverride || incoming.manualOverride
    merged.set(key, next)
  }
  return [...merged.values()].sort((a, b) => a.sequence - b.sequence || a.qpCode.localeCompare(b.qpCode, 'zh-Hant'))
    .map((row, index) => ({ ...row, sequence: index + 1 }))
}

function mergeDepartments(
  left: DepartmentProfile[],
  right: DepartmentProfile[],
  conflicts: WorkspaceMigrationConflict[],
): DepartmentProfile[] {
  const result = new Map<string, DepartmentProfile>()
  for (const department of left) result.set(department.id || department.name, { ...department })
  for (const incoming of right) {
    const key = incoming.id || incoming.name
    const current = result.get(key) ?? result.get(`name:${incoming.name}`)
    if (!current) {
      result.set(key, { ...incoming })
      continue
    }
    const owner = current.owner && incoming.owner && current.owner !== incoming.owner
      ? mergeField(
          current as unknown as Record<string, unknown>,
          incoming as unknown as Record<string, unknown>,
          'owner',
          { kind: 'department', departmentId: current.id, field: 'owner' },
          conflicts,
          'plan',
          `${current.name}：部門負責人`,
          ['來源資料一', '來源資料二'],
        ) as string
      : current.owner || incoming.owner
    result.set(current.id, {
      ...current,
      owner,
      stakeholders: [...new Set([...current.stakeholders, ...incoming.stakeholders])],
      riskOccurrence: current.riskOccurrence || incoming.riskOccurrence,
      riskSeverity: current.riskSeverity || incoming.riskSeverity,
      auditUnit: current.auditUnit || incoming.auditUnit,
      defaultAuditors: current.defaultAuditors || incoming.defaultAuditors,
    })
  }
  return [...result.values()]
}

function cleanChecklistItem(
  item: ProcedureAudit['items'][number],
  auditId: string,
  conflicts: WorkspaceMigrationConflict[],
): ProcedureAudit['items'][number] {
  const { judgmentByCompany: _judgments, certificateScope: _scope, ...rest } = item
  const judgments = item.judgmentByCompany
    ? [...new Set([item.judgmentByCompany.jiurun, item.judgmentByCompany.zhenglongxing].filter(Boolean))]
    : []
  if (judgments.length > 1) {
    addChoiceConflict(
      conflicts,
      'judgment',
      `${item.category} 第 ${item.no} 題的判定不同`,
      '同一舊查檢紀錄含有不同判定。此題已暫停計分；請依原始稽核證據重新確認。',
      { kind: 'checklist', auditId, itemId: item.id, field: 'judgment' },
      { source: '舊判定一', value: item.judgmentByCompany?.jiurun ?? null },
      { source: '舊判定二', value: item.judgmentByCompany?.zhenglongxing ?? null },
    )
  }
  return {
    ...rest,
    judgment: judgments.length > 1 ? null : judgments[0] ?? item.judgment,
    certificateScope: 'shared',
  }
}

function mergeChecklistItem(
  left: ProcedureAudit['items'][number],
  right: ProcedureAudit['items'][number],
  auditId: string,
  conflicts: WorkspaceMigrationConflict[],
): ProcedureAudit['items'][number] {
  const aByCompany = left.judgmentByCompany
  const bByCompany = right.judgmentByCompany
  const leftJudgment = aByCompany
    ? aByCompany.jiurun ?? aByCompany.zhenglongxing ?? left.judgment
    : left.judgment
  const rightJudgment = bByCompany
    ? bByCompany.jiurun ?? bByCompany.zhenglongxing ?? right.judgment
    : right.judgment
  const aSides = aByCompany ? [aByCompany.jiurun, aByCompany.zhenglongxing].filter(Boolean) : []
  const bSides = bByCompany ? [bByCompany.jiurun, bByCompany.zhenglongxing].filter(Boolean) : []
  const distinctLegacySides = new Set([...aSides, ...bSides])
  const conflictingSides = distinctLegacySides.size > 1
  const judgmentConflict = conflictingSides || Boolean(leftJudgment && rightJudgment && leftJudgment !== rightJudgment)
  const judgment = judgmentConflict ? null : leftJudgment ?? rightJudgment ?? null
  const result = {
    ...cleanChecklistItem(left, auditId, conflicts),
    attachments: [...(left.attachments ?? [])],
    judgment,
  }
  for (const attachment of right.attachments ?? []) {
    if (!result.attachments?.some((current) => current.id === attachment.id)) result.attachments?.push(attachment)
  }
  if (judgmentConflict) {
    addChoiceConflict(
      conflicts,
      'judgment',
      `${left.category} 第 ${left.no} 題的判定不同`,
      `兩份舊紀錄的判定不一致。此題已暫停計分；請依原始稽核證據重新確認。`,
      { kind: 'checklist', auditId, itemId: left.id, field: 'judgment' },
      { source: '來源資料一', value: leftJudgment ?? null },
      { source: '來源資料二', value: rightJudgment ?? null },
    )
  }
  const mergeableFields = [
    'description', 'evidenceReference', 'notApplicableReason', 'objectiveEvidence', 'sampleSize',
  ] as const
  for (const field of mergeableFields) {
    const a = left[field]
    const b = right[field]
    if (!hasValue(a)) (result as unknown as Record<string, unknown>)[field] = b
    else if (hasValue(b) && !sameValue(a, b)) {
      addChoiceConflict(
        conflicts,
        'judgment',
        `${left.category} 第 ${left.no} 題：${field}`,
        '兩份查檢紀錄的補充內容不同；請比對稽核證據後選擇保留內容。',
        { kind: 'checklist', auditId, itemId: left.id, field },
        { source: '來源資料一', value: a },
        { source: '來源資料二', value: b },
      )
    }
  }
  return result
}

const AUDIT_FIELDS: Array<keyof ProcedureAudit & string> = [
  'notifyDate', 'auditDate', 'plannedDate', 'departmentManager', 'auditors', 'status', 'scope', 'criteria',
  'procedureVersion', 'reportReference',
]

function mergeAudits(
  left: ProcedureAudit[],
  right: ProcedureAudit[],
  conflicts: WorkspaceMigrationConflict[],
): ProcedureAudit[] {
  const audits = new Map<string, ProcedureAudit>()
  for (const audit of left) audits.set(audit.id, {
    ...audit,
    items: audit.items.map((item) => cleanChecklistItem(item, audit.id, conflicts)),
  })
  for (const incoming of right) {
    const current = audits.get(incoming.id)
    if (!current) {
      audits.set(incoming.id, {
        ...incoming,
        items: incoming.items.map((item) => cleanChecklistItem(item, incoming.id, conflicts)),
      })
      continue
    }
    const merged = { ...current } as ProcedureAudit
    for (const field of AUDIT_FIELDS) {
      ;(merged as unknown as Record<string, unknown>)[field] = mergeField(
        current as unknown as Record<string, unknown>,
        incoming as unknown as Record<string, unknown>,
        field,
        { kind: 'audit', auditId: current.id, field },
        conflicts,
        'record',
        `${current.qpCode} · ${current.department}：${field}`,
        ['來源資料一', '來源資料二'],
      )
    }
    const items = new Map(current.items.map((item) => [item.id, { ...item }]))
    for (const item of incoming.items) {
      const prior = items.get(item.id)
      items.set(item.id, prior
        ? mergeChecklistItem(prior, item, current.id, conflicts)
        : cleanChecklistItem(item, current.id, conflicts))
    }
    merged.items = [...items.values()].sort((a, b) => a.no - b.no)
    audits.set(current.id, merged)
  }
  return [...audits.values()]
}

function stripRecordScope(record: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...record }
  delete copy.id
  delete copy.companyScope
  delete copy.companySide
  return copy
}

function uniqueMergedId(originalId: string, usedIds: Set<string>): string {
  let suffix = 2
  let nextId = `${originalId}-merged-${suffix}`
  while (usedIds.has(nextId)) {
    suffix += 1
    nextId = `${originalId}-merged-${suffix}`
  }
  return nextId
}

function planRecordMerge<T extends { id: string }>(
  left: T[],
  right: T[],
  label: string,
  conflicts: WorkspaceMigrationConflict[],
): { rightRecords: T[]; rightIdMap: Map<string, string> } {
  const usedIds = new Set(left.map((record) => record.id))
  const fingerprintToId = new Map(
    left.map((record) => [JSON.stringify(stripRecordScope(record as Record<string, unknown>)), record.id]),
  )
  const sourceIds = new Set<string>()
  const rightIdMap = new Map<string, string>()
  const rightRecords: T[] = []

  for (const record of right) {
    const duplicateSourceId = sourceIds.has(record.id)
    sourceIds.add(record.id)
    const fingerprint = JSON.stringify(stripRecordScope(record as Record<string, unknown>))
    const identicalId = fingerprintToId.get(fingerprint)
    if (identicalId) {
      rightRecords.push({ ...record, id: identicalId })
      if (!rightIdMap.has(record.id)) rightIdMap.set(record.id, identicalId)
      if (duplicateSourceId) {
        addManualConflict(
          conflicts,
          'record',
          `${label}有重複識別碼`,
          '來源資料有不同紀錄使用相同識別碼。資料已保留並重新編號；請核對該識別碼原先指向的關聯。',
        )
      }
      continue
    }

    const nextId = usedIds.has(record.id) ? uniqueMergedId(record.id, usedIds) : record.id
    usedIds.add(nextId)
    rightRecords.push({ ...record, id: nextId })
    fingerprintToId.set(fingerprint, nextId)
    if (!rightIdMap.has(record.id)) rightIdMap.set(record.id, nextId)
    if (duplicateSourceId) {
      addManualConflict(
        conflicts,
        'record',
        `${label}有重複識別碼`,
        '來源資料有不同紀錄使用相同識別碼。資料已保留並重新編號；請核對該識別碼原先指向的關聯。',
      )
    }
  }

  return { rightRecords, rightIdMap }
}

function mergeRecords<T extends { id: string }>(left: T[], right: T[]): T[] {
  const result = [...left]
  const fingerprints = new Set(left.map((record) => JSON.stringify(stripRecordScope(record as Record<string, unknown>))))
  const usedIds = new Set(left.map((record) => record.id))
  for (const record of right) {
    const fingerprint = JSON.stringify(stripRecordScope(record as Record<string, unknown>))
    if (!fingerprints.has(fingerprint)) {
      const id = usedIds.has(record.id) ? uniqueMergedId(record.id, usedIds) : record.id
      result.push({ ...record, id })
      usedIds.add(id)
      fingerprints.add(fingerprint)
    }
  }
  return result
}

function mergeCompanyData(
  left: CompanyData,
  right: CompanyData,
  conflicts: WorkspaceMigrationConflict[],
): CompanyData {
  const planRows = mergePlanRows(left.planRows, right.planRows, conflicts)
  const ncrPlan = planRecordMerge(left.ncrs, right.ncrs, '不符合事項', conflicts)
  const observationPlan = planRecordMerge(left.observations, right.observations, '觀察事項', conflicts)
  const suggestionPlan = planRecordMerge(left.suggestions, right.suggestions, '第三方建議', conflicts)
  const rightNcrs = ncrPlan.rightRecords.map((record) => ({
    ...record,
    observationId: record.observationId
      ? observationPlan.rightIdMap.get(record.observationId) ?? record.observationId
      : undefined,
  }))
  const rightObservations = observationPlan.rightRecords.map((record) => ({
    ...record,
    convertedNcrId: record.convertedNcrId
      ? ncrPlan.rightIdMap.get(record.convertedNcrId) ?? record.convertedNcrId
      : undefined,
    ncrId: record.ncrId ? ncrPlan.rightIdMap.get(record.ncrId) ?? record.ncrId : undefined,
  }))
  const rightAudits = right.audits.map((audit) => ({
    ...audit,
    items: audit.items.map((item) => ({
      ...item,
      sourceNcrId: item.sourceNcrId ? ncrPlan.rightIdMap.get(item.sourceNcrId) ?? item.sourceNcrId : undefined,
    })),
  }))
  return {
    name: '內部稽核工作區',
    departments: mergeDepartments(left.departments, right.departments, conflicts),
    planRows,
    audits: mergeAudits(left.audits, rightAudits, conflicts),
    ncrs: mergeRecords(left.ncrs, rightNcrs).map(({ companyScope: _scope, ...record }) => record),
    observations: mergeRecords(left.observations, rightObservations).map(({ companySide: _side, ...record }) => record),
    suggestions: mergeRecords(left.suggestions, suggestionPlan.rightRecords),
    procedureRisks: mergeRecords(left.procedureRisks ?? [], right.procedureRisks ?? []),
  }
}

function canonicalPerson(person: Person): Person {
  return {
    ...person,
    affiliations: person.affiliations.map((affiliation) => ({ ...affiliation, companyId: WORKSPACE_COMPANY_ID })),
    qualifications: person.qualifications.map((qualification) => ({
      ...qualification,
      companyIds: [WORKSPACE_COMPANY_ID],
    })),
    appointments: person.appointments.map((appointment) => ({ ...appointment, companyId: WORKSPACE_COMPANY_ID })),
  }
}

type PersonIdMaps = Record<CompanyId, Map<string, string>>

function personSourceCompanies(person: Person): CompanyId[] {
  const companies = new Set<CompanyId>()
  person.affiliations.forEach((affiliation) => {
    if (affiliation.companyId) companies.add(affiliation.companyId)
  })
  person.qualifications.forEach((qualification) => qualification.companyIds.forEach((companyId) => companies.add(companyId)))
  person.appointments.forEach((appointment) => companies.add(appointment.companyId))
  return companies.size ? [...companies] : [WORKSPACE_COMPANY_ID, OTHER_LEGACY_ID]
}

function mergePeople(
  people: Person[],
  conflicts: WorkspaceMigrationConflict[],
): { people: Person[]; idMaps: PersonIdMaps } {
  const result: Person[] = []
  const indexByEmployee = new Map<string, number>()
  const indexById = new Map<string, number>()
  const usedIds = new Set<string>()
  const conflictedAliases = new Set<string>()
  const idMaps: PersonIdMaps = { jiurun: new Map(), zhenglongxing: new Map() }

  const registerAliases = (source: Person, targetId: string) => {
    for (const companyId of personSourceCompanies(source)) {
      const map = idMaps[companyId]
      const mappedId = map.get(source.id)
      if (mappedId && mappedId !== targetId) {
        const key = `${companyId}:${source.id}`
        if (!conflictedAliases.has(key)) {
          conflictedAliases.add(key)
          addManualConflict(
            conflicts,
            'person',
            `人員識別碼 ${source.id} 待覆核`,
            '同一舊識別碼對應到不同人員；相關任命與稽核團隊保留原指向，請核對後整理。',
            { kind: 'person', personIds: [mappedId, targetId] },
          )
        }
      } else {
        map.set(source.id, targetId)
      }
    }
  }

  for (const source of people) {
    const person = canonicalPerson(source)
    const key = person.employeeNumber.trim()
    const existingIndex = (key ? indexByEmployee.get(key) : undefined)
      ?? (!key ? indexById.get(person.id) : undefined)
    if (existingIndex == null) {
      const nextId = usedIds.has(person.id) ? uniqueMergedId(person.id, usedIds) : person.id
      const nextPerson = nextId === person.id ? person : { ...person, id: nextId }
      usedIds.add(nextId)
      if (key) indexByEmployee.set(key, result.length)
      if (!indexById.has(source.id)) indexById.set(source.id, result.length)
      indexById.set(nextId, result.length)
      result.push(nextPerson)
      registerAliases(source, nextId)
      continue
    }
    const current = result[existingIndex]
    if (current.name !== person.name) {
      const nextId = uniqueMergedId(person.id, usedIds)
      usedIds.add(nextId)
      result.push({ ...person, id: nextId })
      registerAliases(source, nextId)
      addManualConflict(
        conflicts,
        'person',
        `員工編號 ${key || person.id} 的人員資料有差異`,
        `名冊中有相同員工編號但不同姓名或人員內容。兩筆資料都已保留；請核對後整理名冊，再標記完成。`,
        { kind: 'person', personIds: [current.id, nextId] },
      )
      continue
    }
    result[existingIndex] = {
      ...current,
      affiliations: mergeRecords(current.affiliations, person.affiliations),
      qualifications: mergeRecords(current.qualifications, person.qualifications),
      appointments: mergeRecords(current.appointments, person.appointments),
      notes: current.notes || person.notes,
      active: current.active || person.active,
    }
    registerAliases(source, current.id)
  }
  return { people: result, idMaps }
}

function remapCompanyPersonReferences(company: CompanyData, idMap: Map<string, string>): CompanyData {
  if (idMap.size === 0) return company
  const remap = (personId: string | undefined) => personId ? idMap.get(personId) ?? personId : personId
  const unique = (personIds: string[]) => [...new Set(personIds.map((personId) => remap(personId)!))]
  return {
    ...company,
    audits: company.audits.map((audit) => ({
      ...audit,
      team: audit.team ? {
        ...audit.team,
        leadAuditorPersonId: remap(audit.team.leadAuditorPersonId),
        auditorPersonIds: unique(audit.team.auditorPersonIds),
        escortPersonIds: unique(audit.team.escortPersonIds),
      } : audit.team,
      teamSnapshot: audit.teamSnapshot ? {
        ...audit.teamSnapshot,
        members: audit.teamSnapshot.members.map((member) => ({ ...member, personId: remap(member.personId)! })),
      } : audit.teamSnapshot,
    })),
  }
}

function cleanPrepItem(
  item: ExternalAuditPrepItemState,
  prep: ExternalAuditPrepState,
  relationships: CompanyRelationship[],
  conflicts: WorkspaceMigrationConflict[],
): ExternalAuditPrepItemState {
  const template = getPrepTemplateForState(item)
  const mode = template?.scope.mode
  const hasBothLegacyChecks = Boolean(item.jiurunDone && item.zhenglongxingDone)
  const baseDone = mode === 'both_separate'
    ? hasBothLegacyChecks
    : mode === 'merged'
      ? Boolean(item.mergedDone)
      : item.completed
  const relationshipGates = prep.relationshipChecks ?? {}
  const hasRequiredRelationshipChecks = relationships
    .filter((relationship) => relationship.prepItemNo === item.no)
    .every((relationship) => Boolean(relationshipGates[relationshipCheckKey(relationship.from, relationship.to, relationship.relation)]))
  const completed = baseDone && hasRequiredRelationshipChecks
  const partial = mode === 'both_separate' && Boolean(item.jiurunDone) !== Boolean(item.zhenglongxingDone)
  if (partial || (baseDone && !hasRequiredRelationshipChecks)) {
    addChoiceConflict(
      conflicts,
      'external_prep',
      `外稽準備第 ${item.no} 項待核對`,
      partial
        ? '舊資料只記錄部分完成狀態；此項目前保持未完成，請依實際佐證確認。'
        : '舊完成狀態未符合原本所有確認條件；此項目前保持未完成，請依實際佐證確認。',
      { kind: 'prep', itemId: item.id },
      { source: '保守預設', value: false },
      { source: '人工核對後', value: true },
    )
  }
  return { id: item.id, no: item.no, completed, remark: item.remark ?? '' }
}

function mergePrep(
  prep: ExternalAuditPrepState,
  relationships: CompanyRelationship[],
  conflicts: WorkspaceMigrationConflict[],
): ExternalAuditPrepState {
  return {
    year: prep.year,
    externalAuditDate: prep.externalAuditDate,
    internalAuditComplete: Boolean(prep.internalAuditComplete),
    managementReviewComplete: Boolean(prep.managementReviewComplete),
    relationshipChecks: {},
    items: prep.items.map((item) => cleanPrepItem(item, prep, relationships, conflicts)),
    onsiteSlots: (prep.onsiteSlots ?? []).map((slot) => ({ ...slot, site: 'both' })),
  }
}

function mergeSettings(
  left: AuditSettings,
  right: AuditSettings,
  conflicts: WorkspaceMigrationConflict[],
): AuditSettings {
  const merged = { ...left, scoringRules: { ...left.scoringRules } }
  for (const field of ['auditYear', 'leadAuditor', 'yearStart', 'planWindowStart', 'planWindowEnd', 'managementReviewDate', 'externalAuditDate', 'viewRole'] as const) {
    const a = left[field]
    const b = right[field]
    if (a == null || a === '') (merged as unknown as Record<string, unknown>)[field] = b
    else if (b != null && b !== '' && a !== b) {
      addChoiceConflict(
        conflicts,
        'settings',
        `稽核基本資料：${field}`,
        `兩份舊設定的「${field}」不同；選定後會套用到工作區設定。`,
        { kind: 'settings', field },
        { source: '來源資料一', value: a },
        { source: '來源資料二', value: b },
      )
    }
  }
  for (const field of ['conform', 'nonConform', 'observation'] as const) {
    const a = left.scoringRules[field]
    const b = right.scoringRules[field]
    if (a !== b) {
      addChoiceConflict(
        conflicts,
        'settings',
        `評分規則：${field}`,
        `兩份舊設定的「${field}」不同；選定後會套用到工作區評分規則。`,
        { kind: 'settings', field: `scoringRules.${field}` },
        { source: '來源資料一', value: a },
        { source: '來源資料二', value: b },
      )
    }
  }
  return merged
}

function normalizeTrash(
  state: AppState,
  personIdMaps: PersonIdMaps,
  activePeople: Person[],
  conflicts: WorkspaceMigrationConflict[],
): AppState['trash'] {
  const personReviewKeys = new Set<string>()
  return (state.trash ?? []).map((entry) => {
    if (entry.kind === 'person') {
      const sourceCompanies = personSourceCompanies(entry.record)
      const mappedIds = [...new Set(sourceCompanies.map((companyId) => (
        personIdMaps[companyId].get(entry.record.id) ?? entry.record.id
      )))]
      const activeMatch = entry.record.employeeNumber.trim()
        ? activePeople.find((person) => person.employeeNumber.trim() === entry.record.employeeNumber.trim())
        : undefined
      const key = `trash-person:${entry.record.employeeNumber.trim() || entry.record.id}`
      if ((mappedIds.length > 1 || activeMatch) && !personReviewKeys.has(key)) {
        personReviewKeys.add(key)
        addManualConflict(
          conflicts,
          'person',
          `回收區人員 ${entry.record.name} 待覆核`,
          activeMatch
            ? '同一人員同時出現在有效名冊與回收區；請確認應保留的資料，再整理名冊與回收區。'
            : '回收區人員的舊識別碼對應到不同人員；請核對後再還原或清除。',
          { kind: 'person', personIds: [activeMatch?.id, ...mappedIds].filter(Boolean) as string[] },
        )
      }
      const id = mappedIds.length === 1 ? mappedIds[0] : entry.record.id
      return { ...entry, record: canonicalPerson({ ...entry.record, id }) }
    }
    if ('companyId' in entry.location) {
      return {
        ...entry,
        location: { ...entry.location, companyId: WORKSPACE_COMPANY_ID },
        record: entry.kind === 'ncr'
          ? (({ companyScope: _scope, ...record }) => record)(entry.record)
          : entry.kind === 'observation'
            ? (({ companySide: _side, ...record }) => record)(entry.record)
            : entry.record,
      } as typeof entry
    }
    return entry
  })
}

function normalizeProfile(raw: AppState, conflicts: WorkspaceMigrationConflict[]) {
  const left = raw.companyAuditProfiles.jiurun
  const right = raw.companyAuditProfiles.zhenglongxing
  const standards = new Map(left.applicableStandards.map((standard) => [standard.name, { ...standard }]))
  for (const incoming of right.applicableStandards) {
    const current = standards.get(incoming.name)
    if (!current) {
      standards.set(incoming.name, { ...incoming })
      continue
    }
    for (const field of ['version', 'confirmationStatus', 'evidenceReference'] as const) {
      if (current[field] && incoming[field] && current[field] !== incoming[field]) {
        addManualConflict(
          conflicts,
          'settings',
          `${incoming.name} 的${field}待覆核`,
          '兩份舊設定有不同內容。請在「稽核基本資料」檢視證據並修正後，再標記完成。',
        )
      } else if (!current[field]) {
        current[field] = incoming[field] as never
      }
    }
  }
  const profile = { ...left, applicableStandards: [...standards.values()] }
  for (const field of ['certificateScope', 'certificateReference', 'auditProcedureCode', 'auditProcedureVersion', 'formalRecordLocation'] as const) {
    const a = left[field]
    const b = right[field]
    if (!a) (profile as unknown as Record<string, unknown>)[field] = b
    else if (b && a !== b) {
      addManualConflict(
        conflicts,
        'settings',
        `稽核基本資料：${field}待覆核`,
        '兩份舊設定有不同內容。請在「稽核基本資料」檢視依據並修正後，再標記完成。',
      )
    }
  }
  return profile
}

function mergeArchives(
  state: AppState,
  conflicts: WorkspaceMigrationConflict[],
  personIdMaps: PersonIdMaps,
): Record<string, YearArchiveEntry> {
  const years = new Set(Object.keys(state.yearArchives))
  const result: Record<string, YearArchiveEntry> = {}
  for (const year of years) {
    const archive = state.yearArchives[year]
    const rawLeft = archive?.companies?.jiurun
    const rawRight = archive?.companies?.zhenglongxing
    const left = rawLeft ? remapCompanyPersonReferences(rawLeft, personIdMaps.jiurun) : undefined
    const right = rawRight ? remapCompanyPersonReferences(rawRight, personIdMaps.zhenglongxing) : undefined
    const leftSettings = archive?.companySettings?.jiurun
    const rightSettings = archive?.companySettings?.zhenglongxing
    const mergedCompany = left && right
      ? mergeCompanyData(left, right, conflicts)
      : left ?? right
    const mergedSettings = leftSettings && rightSettings
      ? mergeSettings(leftSettings, rightSettings, conflicts)
      : leftSettings ?? rightSettings
    result[year] = {
      companies: mergedCompany ? { [WORKSPACE_COMPANY_ID]: mergedCompany } : {},
      companySettings: mergedSettings ? { [WORKSPACE_COMPANY_ID]: mergedSettings } : {},
    }
  }
  return result
}

/** Merge the former company partitions into one active workspace without choosing conflicting values silently. */
export function migrateToSingleWorkspace(raw: AppState): AppState {
  if (raw.version >= SINGLE_WORKSPACE_STORAGE_VERSION) return raw

  const conflicts: WorkspaceMigrationConflict[] = []
  const activeSource = raw.activeCompanyId === OTHER_LEGACY_ID ? OTHER_LEGACY_ID : WORKSPACE_COMPANY_ID
  const otherSource = activeSource === WORKSPACE_COMPANY_ID ? OTHER_LEGACY_ID : WORKSPACE_COMPANY_ID
  const peopleMerge = mergePeople(raw.people, conflicts)
  const activeSettings = raw.companySettings[activeSource]
  const otherSettings = raw.companySettings[otherSource]
  const currentYear = activeSettings.auditYear
  let workspace = {
    ...remapCompanyPersonReferences(raw.companies[activeSource], peopleMerge.idMaps[activeSource]),
    name: '內部稽核工作區',
  }
  const otherWorkspace = remapCompanyPersonReferences(raw.companies[otherSource], peopleMerge.idMaps[otherSource])
  const archives = mergeArchives(raw, conflicts, peopleMerge.idMaps)

  if (otherSettings.auditYear === currentYear) {
    workspace = mergeCompanyData(workspace, otherWorkspace, conflicts)
  } else {
    const archived = archives[String(otherSettings.auditYear)] ?? { companies: {}, companySettings: {} }
    const archivedCompany = archived.companies[WORKSPACE_COMPANY_ID]
    archives[String(otherSettings.auditYear)] = {
      companies: {
        ...archived.companies,
        [WORKSPACE_COMPANY_ID]: archivedCompany
          ? mergeCompanyData(archivedCompany, otherWorkspace, conflicts)
          : { ...otherWorkspace, name: '內部稽核工作區' },
      },
      companySettings: {
        ...archived.companySettings,
        [WORKSPACE_COMPANY_ID]: otherSettings,
      },
    }
    addChoiceConflict(
      conflicts,
      'settings',
      '目前稽核年度不同',
      '兩份舊台帳的稽核年度不同。資料已分別保留在目前年度與對應年度封存，請確認工作區目前年度。',
      { kind: 'settings', field: 'auditYear' },
      { source: '目前工作區', value: currentYear },
      { source: '另一份舊台帳', value: otherSettings.auditYear },
    )
  }

  // The current-year difference already has its own explicit conflict above.
  // Avoid presenting the same mismatch a second time as an ordinary setting conflict.
  const companySettings = mergeSettings(activeSettings, { ...otherSettings, auditYear: currentYear }, conflicts)
  companySettings.auditYear = currentYear
  const relationships = raw.companyRelationships ?? DEFAULT_COMPANY_RELATIONSHIPS
  const prep = mergePrep(raw.externalAuditPrep, relationships, conflicts)
  if (prep.year !== currentYear) {
    addChoiceConflict(
      conflicts,
      'external_prep',
      '外稽準備年度與目前台帳不同',
      '外稽準備資料已保留原年度；請確認是否要切換準備年度。',
      { kind: 'prep', itemId: '' },
      { source: '目前台帳', value: currentYear },
      { source: '外稽準備', value: prep.year },
    )
  }
  const profile = normalizeProfile(raw, conflicts)
  const assignments = mergeRecords([], raw.annualPersonnelAssignments.map((assignment) => ({
    ...assignment,
    personId: peopleMerge.idMaps[assignment.companyId].get(assignment.personId) ?? assignment.personId,
    companyId: WORKSPACE_COMPANY_ID,
  })))
  const prepArchives = Object.fromEntries(Object.entries(raw.prepArchives ?? {}).map(([year, value]) => [
    year,
    mergePrep(value, relationships, conflicts),
  ]))
  const trash = normalizeTrash(raw, peopleMerge.idMaps, peopleMerge.people, conflicts)
  const permanentlyDeletedGeneratedRecords = (raw.permanentlyDeletedGeneratedRecords ?? []).map((record) => ({
    ...record,
    companyId: WORKSPACE_COMPANY_ID,
  }))

  const workspaceSettings: Record<CompanyId, AuditSettings> = {
    jiurun: companySettings,
    zhenglongxing: companySettings,
  }
  const workspaceProfiles = { jiurun: profile, zhenglongxing: profile }
  const empty = emptyCompanyData('')
  const result: AppState = {
    ...raw,
    version: SINGLE_WORKSPACE_STORAGE_VERSION,
    activeCompanyId: WORKSPACE_COMPANY_ID,
    companySettings: workspaceSettings,
    companies: { jiurun: workspace, zhenglongxing: empty },
    companyAuditProfiles: workspaceProfiles,
    companyRelationships: [],
    sharedPlanRows: undefined,
    legacyCompanyPlanBackup: undefined,
    people: peopleMerge.people,
    annualPersonnelAssignments: assignments,
    externalAuditPrep: prep,
    externalAuditSchedule: raw.externalAuditSchedule
      ? {
          ...raw.externalAuditSchedule,
          companyProductHighlights: { jiurun: '', zhenglongxing: '' },
          entries: raw.externalAuditSchedule.entries.map((entry) => ({ ...entry, companyFocus: 'both' })),
        }
      : undefined,
    yearArchives: archives,
    prepArchives,
    trash,
    permanentlyDeletedGeneratedRecords,
    workspaceMigrationConflicts: [
      ...(raw.workspaceMigrationConflicts ?? []),
      ...conflicts,
    ],
  }
  return result
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.')
  let current = target
  for (const part of parts.slice(0, -1)) {
    const existing = current[part]
    if (!isObject(existing)) current[part] = {}
    current = current[part] as Record<string, unknown>
  }
  current[parts.at(-1)!] = value
}

function switchWorkspaceYear(state: AppState, year: number): AppState {
  const currentSettings = state.companySettings[WORKSPACE_COMPANY_ID]
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || year === currentSettings.auditYear) return state
  const currentYearKey = String(currentSettings.auditYear)
  const existing = state.yearArchives[currentYearKey] ?? { companies: {}, companySettings: {} }
  const yearArchives = {
    ...state.yearArchives,
    [currentYearKey]: {
      companies: { ...existing.companies, [WORKSPACE_COMPANY_ID]: state.companies[WORKSPACE_COMPANY_ID] },
      companySettings: { ...existing.companySettings, [WORKSPACE_COMPANY_ID]: currentSettings },
    },
  }
  const restored = yearArchives[String(year)]
  const restoredCompany = restored?.companies[WORKSPACE_COMPANY_ID]
  const restoredSettings = restored?.companySettings[WORKSPACE_COMPANY_ID]
  if (restoredCompany && restoredSettings) {
    return {
      ...state,
      activeCompanyId: WORKSPACE_COMPANY_ID,
      companies: { ...state.companies, [WORKSPACE_COMPANY_ID]: restoredCompany },
      companySettings: {
        jiurun: { ...restoredSettings, auditYear: year },
        zhenglongxing: { ...restoredSettings, auditYear: year },
      },
      yearArchives,
    }
  }
  const replaceYear = (value?: string) => value ? value.replace(/^\d{4}/, String(year)) : value
  const emptyCompany = {
    ...state.companies[WORKSPACE_COMPANY_ID],
    planRows: state.companies[WORKSPACE_COMPANY_ID].planRows.map((row) => ({
      ...row,
      months: Array.from({ length: 12 }, () => null),
      manualOverride: false,
    })),
    audits: [],
    ncrs: [],
    observations: [],
    suggestions: [],
  }
  const nextSettings = {
    ...currentSettings,
    auditYear: year,
    yearStart: replaceYear(currentSettings.yearStart)!,
    planWindowStart: replaceYear(currentSettings.planWindowStart)!,
    planWindowEnd: replaceYear(currentSettings.planWindowEnd)!,
    managementReviewDate: replaceYear(currentSettings.managementReviewDate),
  }
  return {
    ...state,
    companies: { ...state.companies, [WORKSPACE_COMPANY_ID]: emptyCompany },
    companySettings: { jiurun: nextSettings, zhenglongxing: nextSettings },
    yearArchives,
  }
}

export function applyWorkspaceConflictChoice(
  state: AppState,
  conflict: WorkspaceMigrationConflict,
  choiceIndex?: number,
): AppState {
  const target = conflict.target
  const candidate = choiceIndex == null ? undefined : conflict.candidates?.[choiceIndex]
  if (target.kind !== 'manual' && !candidate) return state
  const value = candidate?.value
  const next = structuredClone(state)
  if (target.kind === 'plan') {
    const row = next.companies[WORKSPACE_COMPANY_ID].planRows.find((item) => item.id === target.rowId)
    if (row && target.field === 'manualMonthOverrides' && target.monthIndex != null) {
      const overrides = [...(row.manualMonthOverrides ?? Array(12).fill(null))]
      overrides[target.monthIndex] = value as PlanRow['months'][number]
      row.manualMonthOverrides = overrides
    } else if (row) {
      setPath(row as unknown as Record<string, unknown>, target.field, value)
    }
  } else if (target.kind === 'department') {
    const department = next.companies[WORKSPACE_COMPANY_ID].departments.find((item) => item.id === target.departmentId)
    if (department) setPath(department as unknown as Record<string, unknown>, target.field, value)
  } else if (target.kind === 'checklist') {
    const audit = next.companies[WORKSPACE_COMPANY_ID].audits.find((item) => item.id === target.auditId)
    const item = audit?.items.find((entry) => entry.id === target.itemId)
    if (item) setPath(item as unknown as Record<string, unknown>, target.field, value)
  } else if (target.kind === 'audit') {
    const audit = next.companies[WORKSPACE_COMPANY_ID].audits.find((item) => item.id === target.auditId)
    if (audit) setPath(audit as unknown as Record<string, unknown>, target.field, value)
  } else if (target.kind === 'settings') {
    if (target.field === 'auditYear') {
      Object.assign(next, switchWorkspaceYear(next, Number(value)))
    } else {
      setPath(next.companySettings[WORKSPACE_COMPANY_ID] as unknown as Record<string, unknown>, target.field, value)
      next.companySettings[OTHER_LEGACY_ID] = next.companySettings[WORKSPACE_COMPANY_ID]
    }
  } else if (target.kind === 'prep') {
    if (!target.itemId) next.externalAuditPrep.year = Number(value)
    else {
      const item = next.externalAuditPrep.items.find((entry) => entry.id === target.itemId)
      if (item) item.completed = Boolean(value)
    }
  }
  next.workspaceMigrationConflicts = (next.workspaceMigrationConflicts ?? []).filter((item) => item.id !== conflict.id)
  return next
}

export function markWorkspaceConflictReviewed(
  state: AppState,
  conflictId: string,
): AppState {
  return {
    ...state,
    workspaceMigrationConflicts: (state.workspaceMigrationConflicts ?? []).filter((item) => item.id !== conflictId),
  }
}

export function validateSingleWorkspaceState(value: unknown): value is AppState {
  if (!isObject(value) || value.version !== SINGLE_WORKSPACE_STORAGE_VERSION) return false
  if (!isObject(value.companies) || !isObject(value.companySettings) || !isObject(value.companyAuditProfiles)) return false
  const workspace = value.companies[WORKSPACE_COMPANY_ID]
  const settings = value.companySettings[WORKSPACE_COMPANY_ID]
  const prep = value.externalAuditPrep
  if (!isObject(workspace) || !Array.isArray(workspace.planRows) || !Array.isArray(workspace.audits)) return false
  if (!isObject(settings) || typeof settings.auditYear !== 'number') return false
  if (!isObject(prep) || !Array.isArray(prep.items) || !Array.isArray(value.people)) return false
  if (!Array.isArray(value.workspaceMigrationConflicts)) return false
  return true
}

export function activeWorkspaceId(): CompanyId {
  return WORKSPACE_COMPANY_ID
}
