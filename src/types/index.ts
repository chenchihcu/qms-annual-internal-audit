export type StakeholderTag = '客戶' | '法規/認證' | '員工' | '供應商' | '經營層'

export type RiskLevel = '高' | '中' | '低'

export type Judgment = '符合' | '不符' | '觀察' | '不適用'

export type NCRStatus = '開立' | '矯正中' | '結案'

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
    evidenceReference: string
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
  externalAuditDate?: string
  managementReviewDate?: string
  scoringRules: ScoringRules
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
  auditDate: string
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
  jiurunDone: boolean
  zhenglongxingDone: boolean
  mergedDone: boolean
  completed: boolean
  remark: string
}

export interface ExternalAuditPrepState {
  year: number
  internalAuditComplete: boolean
  managementReviewComplete: boolean
  items: ExternalAuditPrepItemState[]
}

export interface CompanyData {
  name: string
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

export interface AppState {
  activeCompanyId: CompanyId
  settings: AuditSettings
  companies: Record<CompanyId, CompanyData>
  externalAuditPrep: ExternalAuditPrepState
  people: Person[]
  annualPersonnelAssignments: AnnualPersonnelAssignment[]
  companyAuditProfiles: Record<CompanyId, CompanyAuditProfile>
  yearArchives: Record<string, {
    settings: AuditSettings
    companies: Record<CompanyId, CompanyData>
    externalAuditPrep: ExternalAuditPrepState
  }>
  version: number
}

export type TabId =
  | 'dashboard'
  | 'plan'
  | 'audit'
  | 'ncr'
  | 'observations'
  | 'suggestions'
  | 'prep'
  | 'risk'
  | 'personnel'
  | 'standard'
  | 'procedure'
  | 'system-settings'

export const COMPANY_LABELS: Record<CompanyId, string> = {
  jiurun: '九潤精密',
  zhenglongxing: '正隆興精密',
}

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
