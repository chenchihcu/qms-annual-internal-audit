export type StakeholderTag = '客戶' | '法規/認證' | '員工' | '供應商' | '經營層'

export type RiskLevel = '高' | '中' | '低'

export type Judgment = '符合' | '不符' | '觀察' | '不適用'

export type CertificateScope = 'shared' | 'dual' | 'jiurun' | 'zhenglongxing'

export type NcrCompanyScope = 'jiurun' | 'zhenglongxing' | 'both'

export const NCR_COMPANY_SCOPE_LABELS: Record<NcrCompanyScope, string> = {
  jiurun: '九潤',
  zhenglongxing: '正隆興',
  both: '兩證',
}

export type NCRStatus = '開立' | '矯正中' | '結案'

export type NCRClassification = '重大' | '輕微'

/** 年度計畫月格狀態（對應紙本圖例） */
export type MonthStatus = '擬定' | '滿意' | '不滿意' | '矯正中' | '矯正圓滿' | null

/** 三類年度稽核 */
export type InternalAuditCategory = '系統稽核' | '製程稽核' | '型態稽核'

export type ObservationStatus = 'open' | 'closed' | 'became_ncr'

export interface ObservationRevisionFields {
  content: string
  description: string
  owner: string
  dueDate: string
  closedAt: string
  closeEvidence: string
  status: ObservationStatus
}

export type SuggestionStatus = 'open' | 'closed'

export type CompanyId = 'jiurun' | 'zhenglongxing'

/** 多角色視圖：主任稽核員 / 受稽部門 / 警示只讀 */
export type ViewRole = 'lead_auditor' | 'auditee' | 'alert_readonly'

export interface EvidenceAttachment {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  /** base64 data URL（本機儲存，無伺服器） */
  dataUrl: string
  addedAt: string
}

export type AuditEventStatus = '規劃中' | '執行中' | '已回報'

export type PersonType = 'internal' | 'external'

export type PersonnelRole =
  | 'internal_auditor'
  | 'internal_lead_auditor'
  | 'management_representative'
  | 'annual_escort'
  | 'third_party_lead_auditor'
  | 'third_party_auditor'

export type ValidityMode = 'fixed' | 'no_expiry' | 'pending'

export type QualificationState = 'pending' | 'effective' | 'not_effective' | 'expired' | 'suspended' | 'ended'

export interface PersonAffiliation {
  id: string
  companyId?: CompanyId
  departmentId?: string
  externalOrganization?: string
  effectiveFrom?: string
  effectiveTo?: string
}

export interface QualificationRecord {
  id: string
  role: Exclude<PersonnelRole, 'annual_escort'>
  companyIds: CompanyId[]
  standardVersions: string[]
  procedureScopes: string[]
  departmentScopes: string[]
  documentTitle: string
  documentNumber: string
  documentLocation: string
  assessedBy: string
  assessmentDate: string
  effectiveFrom: string
  validityMode: ValidityMode
  effectiveTo?: string
  suspendedAt?: string
  endedAt?: string
  supersededAt?: string
  revisionOfId?: string
  revisedAt?: string
  statusReason?: string
}

export interface RoleAppointment {
  id: string
  role: 'internal_lead_auditor' | 'management_representative'
  companyId: CompanyId
  documentReference: string
  scope: string
  effectiveFrom: string
  effectiveTo?: string
  supersededAt?: string
  revisionOfId?: string
  revisedAt?: string
}

export interface Person {
  id: string
  name: string
  employeeNumber: string
  type: PersonType
  affiliations: PersonAffiliation[]
  qualifications: QualificationRecord[]
  appointments: RoleAppointment[]
  active: boolean
  notes: string
}

export interface AnnualPersonnelAssignment {
  id: string
  year: number
  companyId: CompanyId
  personId: string
  role: 'internal_lead_auditor' | 'management_representative' | 'annual_escort'
  departmentId?: string
  scope?: string
}

export interface AuditTeamAssignment {
  leadAuditorPersonId?: string
  auditorPersonIds: string[]
  escortPersonIds: string[]
  impartialityConfirmed: boolean
  impartialityNote: string
}

export interface AuditTeamSnapshotMember {
  personId: string
  name: string
  role: 'lead' | 'auditor' | 'escort'
  affiliation: string
  qualificationReference: string
  qualificationScope?: string
  appointmentReference?: string
}

export interface AuditTeamSnapshot {
  capturedAt: string
  members: AuditTeamSnapshotMember[]
}

export interface CompanyAuditProfile {
  companyId: CompanyId
  applicableStandards: Array<{
    name: 'ISO 9001' | 'AS9100'
    version: string
    confirmationStatus: 'pending' | 'confirmed'
    /** @deprecated Legacy field retained when reading older local data; use the shared certificateReference on CompanyAuditProfile. */
    evidenceReference?: string
  }>
  certificateScope: string
  certificateReference: string
  auditProcedureCode: string
  auditProcedureVersion: string
  formalRecordLocation: string
}

export interface ScoringRules {
  conform: number
  nonConform: number
  observation: number
}

export interface AuditSettings {
  auditYear: number
  leadAuditor: string
  yearStart: string
  planWindowStart: string
  planWindowEnd: string
  managementReviewDate?: string
  externalAuditDate?: string
  viewRole?: ViewRole
  scoringRules: ScoringRules
}

export type CompanyRelationshipKind = 'primary_customer'

export interface CompanyRelationship {
  id: string
  from: CompanyId
  to: CompanyId
  relation: CompanyRelationshipKind
  prepItemNo: number
  label: string
}

export interface YearArchiveEntry {
  workspace: CompanyData
  settings: AuditSettings
}

/** Pre-v15 single-workspace storage (dual companySettings / companies map). */
export interface AppStateV14Legacy {
  activeCompanyId: CompanyId
  companySettings: Record<CompanyId, AuditSettings>
  companies: Record<CompanyId, CompanyData>
  companyAuditProfiles: Record<CompanyId, CompanyAuditProfile>
  externalAuditPrep: ExternalAuditPrepState
  externalAuditSchedule?: ExternalAuditDaySchedule
  dataSource?: DataSource
  companyRelationships: CompanyRelationship[]
  people: Person[]
  annualPersonnelAssignments: AnnualPersonnelAssignment[]
  yearArchives: Record<string, YearArchiveEntryV14>
  prepArchives?: Record<string, ExternalAuditPrepState>
  sharedPlanRows?: SharedPlanRow[]
  legacyCompanyPlanBackup?: Record<CompanyId, PlanRow[]>
  sharedChecklistTemplates?: Record<string, SharedChecklistQuestion[]>
  trash?: TrashEntry[]
  permanentlyDeletedGeneratedRecords?: PermanentlyDeletedGeneratedRecord[]
  workspaceMigrationConflicts?: WorkspaceMigrationConflict[]
  version: number
  settings?: AuditSettings
}

export interface YearArchiveEntryV14 {
  companies: Partial<Record<CompanyId, CompanyData>>
  companySettings: Partial<Record<CompanyId, AuditSettings>>
}

export interface DepartmentProfile {
  id: string
  name: string
  owner: string
  auditUnit: string
  defaultAuditors: string
  stakeholders: StakeholderTag[]
  riskOccurrence: number
  riskSeverity: number
}

/** 計畫列：以 QP 程序為主，同一 QP 可對應不同部門 */
export interface PlanRow {
  id: string
  qpCode: string
  departmentId: string
  sequence: number
  riskLevel: RiskLevel
  department: string
  process: string
  documents: string
  auditUnit: string
  owner: string
  auditors: string
  auditCategory: InternalAuditCategory
  months: MonthStatus[]
  manualMonthOverrides?: (MonthStatus | null)[]
  manualOverride: boolean
}

export interface ChecklistItem {
  id: string
  category: string
  no: number
  content: string
  judgment: Judgment | null
  description: string
  procedureRef?: string
  sourceYear?: number
  carriedFromId?: string
  sourceNcrId?: string
  origin?: 'seed' | 'custom' | 'carryforward'
  evidenceReference?: string
  notApplicableReason?: string
  as9100Clause?: string
  sampleSize?: string
  objectiveEvidence?: string
  attachments?: EvidenceAttachment[]
  certificateScope?: CertificateScope
  judgmentByCompany?: { jiurun: Judgment | null; zhenglongxing: Judgment | null }
}

/** QR-28-02 程序導向查檢表 */
export interface ProcedureAudit {
  id: string
  qpCode: string
  departmentId: string
  department: string
  process: string
  documents: string
  notifyDate: string
  notifySent?: boolean
  auditDate: string
  /** 對應年度計畫排定月份（1–12） */
  plannedMonth?: number
  departmentManager: string
  auditors: string
  auditCategory: InternalAuditCategory
  items: ChecklistItem[]
  year?: number
  plannedDate?: string
  status?: AuditEventStatus
  scope?: string
  criteria?: string
  procedureVersion?: string
  /** Frozen at audit start so later procedure-master edits cannot rewrite history. */
  procedureCodeSnapshot?: string
  formalRecordLocationSnapshot?: string
  standardSnapshot?: string[]
  team?: AuditTeamAssignment
  teamSnapshot?: AuditTeamSnapshot
  reportReference?: string
}

export interface NCR {
  id: string
  ncrNumber: string
  qpCode: string
  departmentId: string
  department: string
  process: string
  description: string
  date: string
  status: NCRStatus
  rootCause: string
  correctiveAction: string
  checklistItemId?: string
  sourceYear?: number
  sourceAuditId?: string
  requirementSnapshot?: string
  evidenceSnapshot?: string
  findingSnapshot?: string
  correctionReference?: string
  correctiveActionReference?: string
  effectivenessReference?: string
  effectivenessVerifiedBy?: string
  effectivenessVerifiedAt?: string
  verificationEvidence: string
  responsiblePerson?: string
  dueDate?: string
  containment?: string
  classification?: NCRClassification
  attachments?: EvidenceAttachment[]
  observationId?: string
  carriedToYear?: number
  companyScope?: NcrCompanyScope
}

export interface Observation {
  id: string
  year: number
  qpCode: string
  departmentId: string
  department: string
  process: string
  content: string
  description: string
  status: ObservationStatus
  carriedToYear?: number
  carriedToChecklistId?: string
  carryForwards?: Array<{ year: number; auditId: string; checklistItemId: string }>
  convertedNcrId?: string
  ncrId?: string
  companySide?: CompanyId
  sourceType?: 'internal_audit' | 'third_party_audit'
  sourceAuditId?: string
  sourceChecklistItemId?: string
  sourceReference?: string
  occurrenceDate?: string
  owner?: string
  dueDate?: string
  closedAt?: string
  closeEvidence?: string
  followUps?: Array<{ id: string; date: string; note: string }>
  revisions?: Array<{ id: string; changedAt: string; before: ObservationRevisionFields; after: ObservationRevisionFields }>
}

/** 第三方稽核建議事項一覽表 */
export interface ThirdPartySuggestion {
  id: string
  year: number
  procedure: string
  departmentId?: string
  issue: string
  progress: string
  responsibleUnit: string
  status: SuggestionStatus
  carriedToYear?: number
}

/** 雙公司合併取證 — 外部稽核前準備狀態（依年度共用） */
export interface ExternalAuditPrepItemState {
  id: string
  no: number
  /** Legacy source flags exist only in pre-v14 backups. */
  jiurunDone?: boolean
  zhenglongxingDone?: boolean
  mergedDone?: boolean
  completed: boolean
  remark: string
}

/** 外稽當日行程時段（與準備表同年、雙公司共用） */
export type OnsiteSite = CompanyId | 'both'

export interface OnsiteAuditSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  site: OnsiteSite
  departmentId?: string
  qpCodes: string[]
  productModels: string[]
  escortPersonIds: string[]
  note: string
}

export type TrashCompanyRecordKind = 'ncr' | 'observation' | 'suggestion'

export interface PermanentlyDeletedGeneratedRecord {
  kind: 'ncr' | 'observation'
  recordId: string
  companyId: CompanyId
  year: number
}

interface TrashEntryBase {
  id: string
  recordId: string
  deletedAt: string
  originalIndex: number
}

export type TrashEntry =
  | (TrashEntryBase & {
      kind: 'ncr'
      record: NCR
      location: { companyId: CompanyId; year: number; archiveYear?: string }
    })
  | (TrashEntryBase & {
      kind: 'observation'
      record: Observation
      location: { companyId: CompanyId; year: number; archiveYear?: string }
    })
  | (TrashEntryBase & {
      kind: 'suggestion'
      record: ThirdPartySuggestion
      location: { companyId: CompanyId; year: number; archiveYear?: string }
    })
  | (TrashEntryBase & {
      kind: 'person'
      record: Person
      location: { scope: 'people' }
    })
  | (TrashEntryBase & {
      kind: 'onsite_slot'
      record: OnsiteAuditSlot
      location: { prepYear: number }
    })
  | (TrashEntryBase & {
      kind: 'checklist_item'
      record: ChecklistItem
      location: { companyId: CompanyId; auditId: string; year: number; archiveYear?: string }
    })

export interface ExternalAuditScheduleEntry {
  id: string
  timeStart: string
  timeEnd: string
  activity: string
  location: string
  productModels: string
  companyFocus: CompanyId | 'both'
  remark: string
}

export interface ExternalAuditDaySchedule {
  year: number
  auditDate: string
  companyProductHighlights: Record<CompanyId, string>
  entries: ExternalAuditScheduleEntry[]
}

export interface ExternalAuditPrepState {
  year: number
  externalAuditDate?: string
  internalAuditComplete: boolean
  managementReviewComplete: boolean
  relationshipChecks: Record<string, boolean>
  items: ExternalAuditPrepItemState[]
  onsiteSlots: OnsiteAuditSlot[]
}

export interface SharedPlanRow extends PlanRow {
  applicableCompanies: CompanyId[]
}

/** 兩家公司共用、供未來表單建立時複製的題目文字。 */
export interface SharedChecklistQuestion {
  category: string
  no: number
  content: string
}

export interface CompanyData {
  name: string
  keyCustomerName?: string
  departments: DepartmentProfile[]
  planRows: PlanRow[]
  audits: ProcedureAudit[]
  ncrs: NCR[]
  observations: Observation[]
  suggestions: ThirdPartySuggestion[]
  procedureRisks?: ProcedureRiskRecord[]
}

export interface ProcedureRiskRecord {
  id: string
  qpCode: string
  departmentId: string
  inherentRisk: number
  previousInternalNcrCount?: number
  previousThirdPartyNcrCount?: number
  overdueOpenNcrCount?: number
  customerComplaintLevel?: number
  changeImpact?: number
  monthsSinceLastAudit?: number
  evidenceReference: string
  updatedAt: string
}

export type DataSource = 'demo' | 'user'

export interface WorkspaceMigrationCandidate {
  source: string
  label: string
  value: unknown
}

export type WorkspaceMigrationTarget =
  | { kind: 'plan'; rowId: string; field: string; monthIndex?: number }
  | { kind: 'department'; departmentId: string; field: string }
  | { kind: 'checklist'; auditId: string; itemId: string; field: string }
  | { kind: 'audit'; auditId: string; field: string }
  | { kind: 'person'; personIds: string[] }
  | { kind: 'settings'; field: string }
  | { kind: 'prep'; itemId: string }
  | { kind: 'manual' }

export interface WorkspaceMigrationConflict {
  id: string
  category: 'plan' | 'person' | 'judgment' | 'settings' | 'external_prep' | 'record'
  title: string
  summary: string
  candidates?: WorkspaceMigrationCandidate[]
  target: WorkspaceMigrationTarget
}

export interface AppState {
  workspace: CompanyData
  settings: AuditSettings
  auditProfile: CompanyAuditProfile
  externalAuditPrep: ExternalAuditPrepState
  externalAuditSchedule?: ExternalAuditDaySchedule
  dataSource?: DataSource
  companyRelationships: CompanyRelationship[]
  people: Person[]
  annualPersonnelAssignments: AnnualPersonnelAssignment[]
  yearArchives: Record<string, YearArchiveEntry>
  prepArchives?: Record<string, ExternalAuditPrepState>
  sharedPlanRows?: SharedPlanRow[]
  legacyCompanyPlanBackup?: Record<CompanyId, PlanRow[]>
  sharedChecklistTemplates?: Record<string, SharedChecklistQuestion[]>
  trash?: TrashEntry[]
  permanentlyDeletedGeneratedRecords?: PermanentlyDeletedGeneratedRecord[]
  workspaceMigrationConflicts?: WorkspaceMigrationConflict[]
  version: number
}

export function relationshipCheckKey(
  from: CompanyId,
  to: CompanyId,
  relation: CompanyRelationshipKind,
): string {
  return `${from}:${to}:${relation}`
}

export function companySettingsFor(state: AppState, _companyId?: CompanyId): AuditSettings {
  return state.settings
}

export const COMPANY_IDS: CompanyId[] = ['jiurun', 'zhenglongxing']

export function otherCompanyId(companyId: CompanyId): CompanyId {
  return companyId === 'jiurun' ? 'zhenglongxing' : 'jiurun'
}

export type TabId =
  | 'dashboard'
  | 'plan'
  | 'audit'
  | 'followups'
  | 'ncr'
  | 'observations'
  | 'suggestions'
  | 'prep'
  | 'risk'
  | 'stakeholders'
  | 'personnel'
  | 'system-settings'

export const COMPANY_LABELS: Record<CompanyId, string> = {
  jiurun: '九潤精密',
  zhenglongxing: '正隆興精密',
}

export const VIEW_ROLE_LABELS: Record<ViewRole, string> = {
  lead_auditor: '主任稽核員',
  auditee: '受稽部門',
  alert_readonly: '警示只讀',
}

export const DEFAULT_VIEW_ROLE: ViewRole = 'lead_auditor'

export const MONTH_STATUS_LEGEND: { status: MonthStatus; label: string; color: string }[] = [
  { status: '擬定', label: '擬定', color: 'bg-slate-200 text-slate-700' },
  { status: '滿意', label: '滿意', color: 'bg-green-100 text-green-800' },
  { status: '不滿意', label: '不滿意', color: 'bg-red-100 text-red-800' },
  { status: '矯正中', label: '矯正中', color: 'bg-amber-100 text-amber-800' },
  { status: '矯正圓滿', label: '矯正圓滿', color: 'bg-emerald-100 text-emerald-800' },
]

export const AUDIT_CATEGORIES: InternalAuditCategory[] = [
  '系統稽核',
  '製程稽核',
  '型態稽核',
]

export const STAKEHOLDER_TAGS: StakeholderTag[] = [
  '客戶',
  '法規/認證',
  '員工',
  '供應商',
  '經營層',
]

export const DEFAULT_SCORING_RULES: ScoringRules = {
  conform: 1,
  nonConform: 0,
  observation: 0.5,
}
