import type { CompanyData, ProcedureRiskRecord, RiskLevel } from '../types'

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

/** 依稽核結果建議調整發生度（NCR 多或分數低時提高風險） */
export function suggestRiskBump(
  currentOccurrence: number,
  ncrCount: number,
  scorePercent: number,
): number {
  let bump = 0
  if (ncrCount >= 3) bump += 1
  else if (ncrCount >= 1) bump += 0.5
  if (scorePercent < 60) bump += 1
  else if (scorePercent < 80) bump += 0.5
  return clampRiskValue(currentOccurrence + bump)
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
  customerComplaintLevel: '客戶抱怨',
  changeImpact: '重大變更',
  monthsSinceLastAudit: '距上次稽核時間',
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

/** 循環 NCR 件數欄：— → 0件 → … → ≥4件 → —（必填欄回到 0件） */
export function cycleCountScale(current: number | undefined, required: boolean): number | undefined {
  if (current == null || Number.isNaN(current)) return 1
  if (current >= 5) return required ? 1 : undefined
  return current + 1
}

/** 三檔（無／中／高）→ 1／3／5 */
export function bandToScale(band: 'low' | 'mid' | 'high'): number {
  if (band === 'low') return 1
  if (band === 'mid') return 3
  return 5
}

/** 1–5 → 三檔標籤（客訴／變更） */
export function scaleToBandLabel(scale: number | undefined): string {
  if (scale == null || Number.isNaN(scale)) return '—'
  const s = clampRiskValue(scale)
  if (s <= 2) return '無'
  if (s <= 3) return '中'
  return '高'
}

/** 循環三檔欄：— → 無 → 中 → 高 → — */
export function cycleBandScale(current: number | undefined, required: boolean): number | undefined {
  if (current == null || Number.isNaN(current)) return 1
  if (current <= 2) return 3
  if (current <= 3) return 5
  return required ? 1 : undefined
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

/** 循環距上次欄 */
export function cycleMonthsScale(current: number | undefined, required: boolean): number | undefined {
  return cycleCountScale(current, required)
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

/** 循環固有欄：低 → 中 → 高 → 低 */
export function cycleInherentScale(current: number | undefined): number {
  const s = current == null || Number.isNaN(current) ? 1 : clampRiskValue(current)
  if (s <= 2) return 3
  if (s <= 3) return 5
  return 1
}

export type RiskFactorKind = 'inherent' | 'count' | 'band' | 'months'

export function factorKind(field: keyof ProcedurePriorityInput): RiskFactorKind {
  if (field === 'inherentRisk') return 'inherent'
  if (field === 'customerComplaintLevel' || field === 'changeImpact') return 'band'
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

export function cycleFactorScale(
  field: keyof ProcedurePriorityInput,
  current: number | undefined,
  required: boolean,
): number | undefined {
  const kind = factorKind(field)
  if (kind === 'inherent') return cycleInherentScale(current)
  if (kind === 'band') return cycleBandScale(current, required)
  if (kind === 'months') return cycleMonthsScale(current, required)
  return cycleCountScale(current, required)
}

/** 單因素加權貢獻（四捨五入至整數） */
export function factorWeightedPoints(field: keyof ProcedurePriorityInput, scale: number | undefined): number {
  const weight = PROCEDURE_RISK_WEIGHTS[field]
  const value = scale == null || Number.isNaN(scale) ? 3 : clampRiskValue(scale)
  return Math.round((value / 5) * weight)
}

/** 展開列拆帳文案 */
export function formatFactorBreakdown(field: keyof ProcedurePriorityInput, scale: number | undefined): string {
  const short = factorNames[field].replace('上次', '').replace('程序固有風險', '固有').replace('距上次稽核時間', '距上次')
  const label = formatFactorLabel(field, scale)
  const effective = scale == null || Number.isNaN(scale) ? 3 : clampRiskValue(scale)
  const pts = factorWeightedPoints(field, scale)
  const suffix = scale == null || Number.isNaN(scale) ? '（暫估）' : ''
  return `${short} ${label}→${effective} ×${PROCEDURE_RISK_WEIGHTS[field]}% = ${pts}${suffix}`
}

/** 依未結 NCR 件數建議逾期欄 scale（不自動寫入） */
export function suggestOverdueScaleFromOpenCount(openNcrCount: number): number | undefined {
  if (openNcrCount <= 0) return undefined
  return countToScale(openNcrCount)
}

/** 依最近稽核日期建議距上次 scale（不自動寫入） */
export function suggestMonthsScaleFromAudits(
  audits: Array<{ qpCode: string; departmentId: string; auditDate: string; plannedDate?: string }>,
  qpCode: string,
  departmentId: string,
  referenceDate: string,
): number | undefined {
  const dates = audits
    .filter((a) => a.qpCode === qpCode && a.departmentId === departmentId)
    .map((a) => a.auditDate || a.plannedDate || '')
    .filter(Boolean)
    .sort()
  const last = dates.at(-1)
  if (!last) return undefined
  const ref = new Date(referenceDate)
  const lastDate = new Date(last)
  if (Number.isNaN(ref.getTime()) || Number.isNaN(lastDate.getTime())) return undefined
  const months = (ref.getFullYear() - lastDate.getFullYear()) * 12 + (ref.getMonth() - lastDate.getMonth())
  return monthsToScale(Math.max(0, months))
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

/** Merge persisted procedureRisks with UI fallbacks so planner matches on-screen scores. */
export function buildEffectiveProcedureRisks(company: CompanyData): ProcedureRiskRecord[] {
  return company.planRows.map((plan) => {
    const saved = company.procedureRisks?.find(
      (item) => item.qpCode === plan.qpCode && item.departmentId === plan.departmentId,
    )
    return {
      id: saved?.id ?? `risk-${plan.qpCode}-${plan.departmentId}`,
      qpCode: plan.qpCode,
      departmentId: plan.departmentId,
      inherentRisk: saved?.inherentRisk ?? inherentScaleFromSeed(plan.riskLevel),
      previousInternalNcrCount: saved?.previousInternalNcrCount,
      previousThirdPartyNcrCount: saved?.previousThirdPartyNcrCount,
      overdueOpenNcrCount: saved?.overdueOpenNcrCount,
      customerComplaintLevel: saved?.customerComplaintLevel,
      changeImpact: saved?.changeImpact,
      monthsSinceLastAudit: saved?.monthsSinceLastAudit,
      evidenceReference: saved?.evidenceReference ?? '',
      updatedAt: saved?.updatedAt ?? new Date().toISOString(),
    }
  })
}
