export type StakeholderTag = '客戶' | '法規/認證' | '員工' | '供應商' | '經營層'

export type RiskLevel = '高' | '中' | '低'

export type Judgment = '符合' | '不符' | '觀察' | '不適用'

export type NCRStatus = '開立' | '矯正中' | '結案'

/** 年度計畫月格狀態（對應紙本圖例） */
export type MonthStatus = '擬定' | '滿意' | '不滿意' | '矯正中' | '矯正圓滿' | null

/** 三類年度稽核 */
export type InternalAuditCategory = '系統稽核' | '製程稽核' | '型態稽核'

export type ObservationStatus = 'open' | 'closed' | 'became_ncr'

export type SuggestionStatus = 'open' | 'closed'

export type CompanyId = 'jiurun' | 'zhenglongxing'

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
  /** 公司別管理審查日期；舊資料使用 managementReviewDate 作回退 */
  managementReviewDates?: Partial<Record<CompanyId, string>>
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

/** 同場稽核的唯一計畫；months 只記錄排程月份，執行結果仍留在各公司 planRows。 */
export interface SharedPlanRow extends PlanRow {
  applicableCompanies: CompanyId[]
}

/** 兩家公司共用、供未來表單建立時複製的題目文字。 */
export interface SharedChecklistQuestion {
  category: string
  no: number
  content: string
}

export type ChecklistItemOrigin = 'seed' | 'custom' | 'carryforward'

export interface ChecklistItem {
  id: string
  category: string
  no: number
  content: string
  judgment: Judgment | null
  description: string
  /** 受控紀錄的代碼或位置；每家公司自行保存引用快照與判定 */
  evidenceReference?: string
  procedureRef?: string
  sourceYear?: number
  carriedFromId?: string
  origin?: ChecklistItemOrigin
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
  carriedToYear?: number
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
}

/** 第三方稽核建議事項一覽表 */
export interface ThirdPartySuggestion {
  id: string
  year: number
  procedure: string
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
  /** site_scope 項目實際查核的廠區範圍；舊資料可能尚未填寫 */
  siteScope?: string
  remark: string
}

export interface ExternalAuditPrepState {
  year: number
  /** 舊版共用完成旗標，保留匯入相容性；不代表兩家公司皆已確認 */
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
}

export interface AppState {
  activeCompanyId: CompanyId
  settings: AuditSettings
  companies: Record<CompanyId, CompanyData>
  sharedPlanRows?: SharedPlanRow[]
  /** 舊計畫有差異時保留兩份原值，供人工核對與 JSON 匯出。 */
  legacyCompanyPlanBackup?: Record<CompanyId, PlanRow[]>
  sharedChecklistTemplates?: Record<string, SharedChecklistQuestion[]>
  externalAuditPrep: ExternalAuditPrepState
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
  | 'settings'

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

export function getCompanyManagementReviewDate(settings: AuditSettings, companyId: CompanyId): string {
  return settings.managementReviewDates?.[companyId] ?? settings.managementReviewDate ?? ''
}
