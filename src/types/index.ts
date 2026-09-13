export type StakeholderTag = '客戶' | '法規/認證' | '員工' | '供應商' | '經營層'

export type RiskLevel = '高' | '中' | '低'

export type Judgment = '符合' | '不符' | '觀察' | '不適用'

export type NCRStatus = '開立' | '矯正中' | '結案'

export type NCRClassification = '重大' | '輕微'

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
  /** 手動覆寫特定月格狀態（其餘月格由稽核/NCR 自動推導） */
  manualMonthOverrides?: (MonthStatus | null)[]
  manualOverride: boolean
}

export type ChecklistItemOrigin = 'seed' | 'custom' | 'carryforward'

export interface ChecklistItem {
  id: string
  category: string
  no: number
  content: string
  judgment: Judgment | null
  description: string
  /** 抽樣數量 */
  sampleSize?: string
  /** 客觀證據 */
  objectiveEvidence?: string
  /** AS9100 條款 */
  as9100Clause?: string
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
  /** 對應年度計畫排定月份（1–12） */
  plannedMonth?: number
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
  /** 不符合事項描述（QR-28-03） */
  description: string
  date: string
  status: NCRStatus
  /** 根本原因分析 */
  rootCause: string
  /** 矯正措施 */
  correctiveAction: string
  /** 驗證／結案佐證 */
  verificationEvidence: string
  responsiblePerson?: string
  dueDate?: string
  containment?: string
  classification?: NCRClassification
  checklistItemId?: string
  /** 由跨年觀察事項「已轉 NCR」建立 */
  observationId?: string
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
  /** 連結至由「已轉 NCR」建立的 NCR */
  ncrId?: string
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
  remark: string
}

export interface ExternalAuditPrepState {
  year: number
  /** 未設定時依雙公司程序稽核資料自動判定 */
  internalAuditCompleteOverride?: boolean
  /** @deprecated v6 起改用 internalAuditCompleteOverride；遷移時保留讀取 */
  internalAuditComplete?: boolean
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

export type DataSource = 'demo' | 'user'

export interface AppState {
  activeCompanyId: CompanyId
  settings: AuditSettings
  companies: Record<CompanyId, CompanyData>
  externalAuditPrep: ExternalAuditPrepState
  /** 示範資料或使用者正式資料 */
  dataSource?: DataSource
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
