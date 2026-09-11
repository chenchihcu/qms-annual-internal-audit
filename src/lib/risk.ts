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
