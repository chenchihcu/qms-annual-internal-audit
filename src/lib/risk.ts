import type { RiskLevel } from '../types'

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

const factorNames: Record<keyof ProcedurePriorityInput, string> = {
  inherentRisk: '程序固有風險',
  previousInternalNcrCount: '上次內稽 NCR',
  previousThirdPartyNcrCount: '上次第三方稽核 NCR',
  overdueOpenNcrCount: '逾期／未結 NCR',
  customerComplaintLevel: '客戶抱怨',
  changeImpact: '重大變更',
  monthsSinceLastAudit: '距上次稽核時間',
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
