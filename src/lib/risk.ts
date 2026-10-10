import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type {
  CompanyData,
  ProcedureRiskFactorKey,
  ProcedureRiskRecord,
  ProcedureRiskSnapshot,
  ProcedureRiskStatus,
  RiskLevel,
} from '../types'

export interface RiskResult {
  index: number
  level: RiskLevel
}

/** 風險等級區間：高 15–25 / 中 5–14 / 低 1–4 */
export const RISK_BANDS = {
  high: { min: 15, max: 25, label: '高' as const },
  medium: { min: 5, max: 14, label: '中' as const },
  low: { min: 1, max: 4, label: '低' as const },
} as const

export function clampRiskValue(value: number): number {
  return Math.min(5, Math.max(1, Math.round(value)))
}

export function calculateRiskIndex(occurrence: number, severity: number): number {
  const o = clampRiskValue(occurrence)
  const s = clampRiskValue(severity)
  return o * s
}

export function calculateRiskLevel(occurrence: number, severity: number): RiskResult {
  const index = calculateRiskIndex(occurrence, severity)
  let level: RiskLevel
  if (index >= RISK_BANDS.high.min) level = '高'
  else if (index >= RISK_BANDS.medium.min) level = '中'
  else level = '低'
  return { index, level }
}

export const PROCEDURE_RISK_WEIGHTS = {
  inherentRisk: 15,
  previousInternalNcrCount: 20,
  previousThirdPartyNcrCount: 15,
  overdueOpenNcrCount: 15,
  customerComplaintLevel: 15,
  changeImpact: 10,
  monthsSinceLastAudit: 10,
} as const

export interface ProcedurePriorityInput {
  inherentRisk: number
  previousInternalNcrCount?: number
  previousThirdPartyNcrCount?: number
  overdueOpenNcrCount?: number
  customerComplaintLevel?: number
  changeImpact?: number
  monthsSinceLastAudit?: number
}

export interface ProcedurePriorityResult {
  score: number
  level: RiskLevel
  provisional: boolean
  missingFactors: string[]
}

export const factorNames: Record<keyof ProcedurePriorityInput, string> = {
  inherentRisk: '程序固有風險',
  previousInternalNcrCount: '上次內稽 NCR',
  previousThirdPartyNcrCount: '上次第三方稽核 NCR',
  overdueOpenNcrCount: '逾期／未結 NCR',
  customerComplaintLevel: '客戶抱怨件數',
  changeImpact: '重大變更件數',
  monthsSinceLastAudit: '距上次稽核時間',
}

export interface RiskFactorDefinition {
  /** 量測什麼 */
  definition: string
  /** 資料來源（系統內紀錄或外部來源登錄） */
  source: string
  /** 評估期間 */
  period: string
  /** 分級對照 */
  scale: string
}

/** 各因素的單一定義來源：畫面與匯出共用；除固有風險取種子等級外，皆以可計數紀錄量化。 */
export const FACTOR_DEFINITIONS: Record<keyof ProcedurePriorityInput, RiskFactorDefinition> = {
  inherentRisk: {
    definition: '程序本身失效時對產品、客戶或法規的影響，不看事件紀錄',
    source: '程序種子重點等級；改值須填調整理由',
    period: '不適用',
    scale: '低→1、中→3、高→5',
  },
  previousInternalNcrCount: {
    definition: '內部稽核開立的不符合件數，同一事件（含跨年追蹤、觀察轉 NCR）只計一次',
    source: '查檢表不符／NCR 台帳（含前一年度封存）',
    period: '前一年度＋本年度',
    scale: '0／1／2／3／≥4 件→1–5',
  },
  previousThirdPartyNcrCount: {
    definition: '驗證機構或客戶稽核的缺失中，已轉成 NCR 的件數',
    source: '觀察台帳來源＝第三方稽核且已轉 NCR',
    period: '前一年度＋本年度',
    scale: '0／1／2／3／≥4 件→1–5',
  },
  overdueOpenNcrCount: {
    definition: '此程序目前尚未結案的 NCR（含前年度），逾期件數另行註記',
    source: 'NCR 台帳',
    period: '截至今天',
    scale: '0／1／2／3／≥4 件→1–5',
  },
  customerComplaintLevel: {
    definition: '與此程序相關的客戶抱怨件數，同一外部編號只計一次',
    source: '外部來源登錄（客戶抱怨）點選關聯程序後自動計數；無已確認登錄視為 0 件',
    period: '前一年度＋本年度',
    scale: '0／1／2／3／≥4 件→1–5',
  },
  changeImpact: {
    definition: '影響此程序的組織、製程、產品或文件重大變更件數，同一外部編號只計一次',
    source: '外部來源登錄（重大變更）點選關聯程序後自動計數；無已確認登錄視為 0 件',
    period: '前一年度＋本年度',
    scale: '0／1／2／3／≥4 件→1–5',
  },
  monthsSinceLastAudit: {
    definition: '最近一次已回報稽核日至本年度計畫窗口起的月數',
    source: '查檢表稽核日（含前年度封存）',
    period: '截至計畫窗口起',
    scale: '＜6／6–11／12–17／18–23／≥24 月→1–5',
  },
}

/** NCR 件數 → 1–5：0→1、1→2、2→3、3→4、≥4→5 */
export function countToScale(count: number): number {
  const n = Math.max(0, Math.floor(count))
  if (n >= 4) return 5
  return clampRiskValue(n + 1)
}

/** 1–5 → NCR 件數區間標籤 */
export function scaleToCountLabel(scale: number | undefined): string {
  if (scale == null || Number.isNaN(scale)) return '—'
  const s = clampRiskValue(scale)
  if (s <= 1) return '0件'
  if (s === 2) return '1件'
  if (s === 3) return '2件'
  if (s === 4) return '3件'
  return '≥4件'
}

/** 1–5 → 三檔標籤（客訴／變更） */
export function scaleToBandLabel(scale: number | undefined): string {
  if (scale == null || Number.isNaN(scale)) return '—'
  const s = clampRiskValue(scale)
  if (s <= 2) return '無'
  if (s <= 3) return '中'
  return '高'
}

/** 距上次稽核月數 → 1–5 */
export function monthsToScale(months: number): number {
  const m = Math.max(0, Math.floor(months))
  if (m < 6) return 1
  if (m < 12) return 2
  if (m < 18) return 3
  if (m < 24) return 4
  return 5
}

/** 1–5 → 距上次稽核月數區間標籤 */
export function scaleToMonthsLabel(scale: number | undefined): string {
  if (scale == null || Number.isNaN(scale)) return '—'
  const s = clampRiskValue(scale)
  if (s <= 1) return '＜6月'
  if (s === 2) return '6–11月'
  if (s === 3) return '12–17月'
  if (s === 4) return '18–23月'
  return '≥24月'
}

/** 程序種子風險等級 → 固有 1–5 */
export function inherentScaleFromSeed(riskLevel: RiskLevel | undefined): number {
  if (riskLevel === '高') return 5
  if (riskLevel === '中') return 3
  return 1
}

/** 1–5 → 固有風險顯示（低／中／高） */
export function scaleToInherentLabel(scale: number | undefined): string {
  if (scale == null || Number.isNaN(scale)) return '—'
  const s = clampRiskValue(scale)
  if (s <= 2) return '低'
  if (s <= 3) return '中'
  return '高'
}

export type RiskFactorKind = 'inherent' | 'count' | 'band' | 'months'

export function factorKind(field: keyof ProcedurePriorityInput): RiskFactorKind {
  if (field === 'inherentRisk') return 'inherent'
  if (field === 'monthsSinceLastAudit') return 'months'
  return 'count'
}

export function formatFactorLabel(field: keyof ProcedurePriorityInput, scale: number | undefined): string {
  const kind = factorKind(field)
  if (kind === 'inherent') return scaleToInherentLabel(scale)
  if (kind === 'band') return scaleToBandLabel(scale)
  if (kind === 'months') return scaleToMonthsLabel(scale)
  return scaleToCountLabel(scale)
}

/** 公司自訂的稽核優先順序模型；未知因素以中位數 3 暫估並明確標為暫定。 */
export function calculateProcedurePriority(input: ProcedurePriorityInput): ProcedurePriorityResult {
  const missingFactors: string[] = []
  let total = 0
  for (const key of Object.keys(PROCEDURE_RISK_WEIGHTS) as Array<keyof ProcedurePriorityInput>) {
    const raw = input[key]
    if (raw == null || Number.isNaN(raw)) missingFactors.push(factorNames[key])
    const value = raw == null || Number.isNaN(raw) ? 3 : clampRiskValue(raw)
    total += (value / 5) * PROCEDURE_RISK_WEIGHTS[key]
  }
  const score = Math.round(total)
  const level: RiskLevel = score >= 70 ? '高' : score >= 40 ? '中' : '低'
  return { score, level, provisional: missingFactors.length > 0, missingFactors }
}

export const RISK_FACTOR_KEYS = Object.keys(PROCEDURE_RISK_WEIGHTS) as ProcedureRiskFactorKey[]

/** 固有風險預設只讀程序種子；計畫列 riskLevel 是編排結果，回讀會讓固有風險漂移。 */
export function seedRiskLevelFor(
  qpCode: string,
  departmentId: string,
  fallback?: RiskLevel,
): RiskLevel | undefined {
  const entry = PROCEDURE_PLAN_TEMPLATE.find(
    (item) => item.qpCode === qpCode && item.departmentId === departmentId,
  )
  return entry?.riskLevel ?? fallback
}

/** 種子固有風險 1／3／5；不在種子的自建列才退回計畫列等級。 */
export function seedInherentScale(qpCode: string, departmentId: string, fallback?: RiskLevel): number {
  return inherentScaleFromSeed(seedRiskLevelFor(qpCode, departmentId, fallback))
}

const LEVEL_RANK: Record<RiskLevel, number> = { 低: 1, 中: 2, 高: 3 }

/** 固有風險地板：最終等級不低於固有等級減一級（固有高 → 至少中）。公司自訂規則，非標準要求。 */
export function inherentFloorLevel(inherentRisk: number): RiskLevel | null {
  return scaleToInherentLabel(inherentRisk) === '高' ? '中' : null
}

export interface ProcedureRiskAssessment {
  score: number
  /** 仍有未決定因子時為 null（資料不足），不給正式等級、不參與編排。 */
  level: RiskLevel | null
  formulaLevel: RiskLevel
  floorApplied: boolean
  /** 未填值也未註明未取得的因子。 */
  missingKeys: ProcedureRiskFactorKey[]
  missingFactors: string[]
  /** 已註明未取得、以 3 保守計分的因子。 */
  unavailableKeys: ProcedureRiskFactorKey[]
  /** 分數含中位數 3 暫估（缺值或未取得）。 */
  provisional: boolean
}

function isBlank(value: number | undefined): boolean {
  return value == null || Number.isNaN(value)
}

export function assessProcedurePriority(
  input: ProcedurePriorityInput,
  unavailable: Partial<Record<ProcedureRiskFactorKey, string>> = {},
): ProcedureRiskAssessment {
  const base = calculateProcedurePriority(input)
  const blankKeys = RISK_FACTOR_KEYS.filter((key) => isBlank(input[key]))
  const unavailableKeys = blankKeys.filter((key) => Boolean(unavailable[key]?.trim()))
  const missingKeys = blankKeys.filter((key) => !unavailable[key]?.trim())
  const floor = inherentFloorLevel(input.inherentRisk)
  const floorHit = floor != null && LEVEL_RANK[base.level] < LEVEL_RANK[floor]
  const complete = missingKeys.length === 0
  return {
    score: base.score,
    level: complete ? (floorHit ? floor : base.level) : null,
    formulaLevel: base.level,
    floorApplied: complete && floorHit,
    missingKeys,
    missingFactors: missingKeys.map((key) => factorNames[key]),
    unavailableKeys,
    provisional: base.provisional,
  }
}

export function recordPriorityInput(record: ProcedureRiskRecord): ProcedurePriorityInput {
  return {
    inherentRisk: record.inherentRisk,
    previousInternalNcrCount: record.previousInternalNcrCount,
    previousThirdPartyNcrCount: record.previousThirdPartyNcrCount,
    overdueOpenNcrCount: record.overdueOpenNcrCount,
    customerComplaintLevel: record.customerComplaintLevel,
    changeImpact: record.changeImpact,
    monthsSinceLastAudit: record.monthsSinceLastAudit,
  }
}

export function assessRiskRecord(record: ProcedureRiskRecord): ProcedureRiskAssessment {
  return assessProcedurePriority(recordPriorityInput(record), record.unavailableFactors)
}

/** 外部來源因子（客訴／變更件數）：≥1 件卻未連結外部來源登錄時，須填外部紀錄依據。 */
export const BASIS_REQUIRED_FACTORS: ProcedureRiskFactorKey[] = ['customerComplaintLevel', 'changeImpact']

export function basisRequired(
  factor: ProcedureRiskFactorKey,
  value: number | undefined,
  linkedSourceCount = 0,
): boolean {
  return BASIS_REQUIRED_FACTORS.includes(factor) && value != null && clampRiskValue(value) >= 2 && linkedSourceCount === 0
}

/** 確認前檢查：所有因子有值或已註明未取得；客訴／變更 ≥1 件須有來源登錄或依據。 */
export function riskConfirmBlockers(record: ProcedureRiskRecord): string[] {
  const blockers = assessRiskRecord(record).missingFactors.map((name) => `${name}未填`)
  for (const factor of BASIS_REQUIRED_FACTORS) {
    const linked = record.factorSources?.[factor]?.length ?? 0
    const overridden = record.overrides?.some((override) => override.factor === factor && override.value === record[factor]) ?? false
    if (basisRequired(factor, record[factor], linked) && !overridden && !record.factorBasis?.[factor]?.trim()) {
      blockers.push(`${factorNames[factor]}缺依據`)
    }
  }
  return blockers
}

export type EffectiveRiskStatus = 'none' | 'legacy' | 'stale' | ProcedureRiskStatus

/** 讀取時判定，不改寫資料：舊紀錄無年度、或年度不符者不視為本年度評估。 */
export function effectiveRiskStatus(
  record: ProcedureRiskRecord | undefined,
  auditYear: number,
): EffectiveRiskStatus {
  if (!record) return 'none'
  if (record.assessmentYear == null) return 'legacy'
  if (record.assessmentYear !== auditYear) return 'stale'
  return record.status ?? 'draft'
}

export const RISK_STATUS_LABELS: Record<EffectiveRiskStatus, string> = {
  none: '未評估',
  legacy: '舊紀錄待確認',
  stale: '前年度待重評',
  draft: '草稿',
  confirmed: '已確認',
  approved: '已核准',
}

export function isRiskConfirmedForYear(record: ProcedureRiskRecord | undefined, auditYear: number): boolean {
  const status = effectiveRiskStatus(record, auditYear)
  return status === 'confirmed' || status === 'approved'
}

/** 編排只採用本年度已確認／已核准且有正式等級的紀錄；其餘走種子與部門 O×S。 */
export function plannerReadyRisks(company: CompanyData, auditYear: number): ProcedureRiskRecord[] {
  return (company.procedureRisks ?? []).filter(
    (record) => isRiskConfirmedForYear(record, auditYear) && assessRiskRecord(record).level != null,
  )
}

export function buildRiskSnapshot(record: ProcedureRiskRecord): ProcedureRiskSnapshot {
  const assessment = assessRiskRecord(record)
  const factors: ProcedureRiskSnapshot['factors'] = {}
  for (const key of RISK_FACTOR_KEYS) {
    const value = record[key]
    if (!isBlank(value)) factors[key] = value
  }
  return {
    factors,
    unavailableFactors: { ...(record.unavailableFactors ?? {}) },
    score: assessment.score,
    level: assessment.level,
    evidenceReference: record.evidenceReference,
  }
}
