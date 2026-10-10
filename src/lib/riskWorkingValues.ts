import type { AppState, ProcedureRiskFactorKey, ProcedureRiskRecord, RiskLevel } from '../types'
import { RISK_FACTOR_KEYS, assessProcedurePriority, type ProcedurePriorityInput } from './risk'
import { buildRiskDerivationPool, deriveRiskFactors, type DerivedRiskFactors } from './riskDerivation'

export type FactorValues = Partial<Record<ProcedureRiskFactorKey, number>>
export type FactorText = Partial<Record<ProcedureRiskFactorKey, string>>

export interface RiskWorkingValues {
  values: FactorValues
  /** 人工改值的因子；其餘有系統來源者自動帶入。 */
  manual: ProcedureRiskFactorKey[]
  unavailable: FactorText
}

/**
 * 人工值只在系統值未變時沿用：
 * - 存值等於目前系統值 → 自動。
 * - 人工改值後系統值已變（覆寫紀錄的 suggested 與目前不同）→ 改回系統值，該列待存檔重審
 *   （例：未登錄視為 0 件前手填的 0 件，不可持續蓋過之後的新登錄）。
 * - 舊紀錄無 manualFactors 時：與系統值不同（或系統無值）視為人工。
 */
export function isManualSaved(
  key: ProcedureRiskFactorKey,
  saved: ProcedureRiskRecord | undefined,
  derived: DerivedRiskFactors,
): boolean {
  const value = saved?.[key]
  if (value == null) return false
  const suggested = derived[key].suggested
  if (suggested != null && value === suggested) return false
  const override = [...(saved?.overrides ?? [])].reverse().find((item) => item.factor === key && item.value === value)
  if (override && suggested != null && override.suggested !== suggested) return false
  if (saved?.manualFactors) return saved.manualFactors.includes(key)
  return true
}

/** 工作值：人工值優先，其餘取系統值（自動統計）；未取得理由只在無值時保留。 */
export function buildWorkingValues(saved: ProcedureRiskRecord | undefined, derived: DerivedRiskFactors): RiskWorkingValues {
  const values: FactorValues = {}
  const manual: ProcedureRiskFactorKey[] = []
  const unavailable: FactorText = {}
  for (const key of RISK_FACTOR_KEYS) {
    if (isManualSaved(key, saved, derived)) {
      values[key] = saved![key]
      manual.push(key)
    } else if (derived[key].suggested != null) {
      values[key] = derived[key].suggested
    }
    const reason = saved?.unavailableFactors?.[key]
    if (values[key] == null && reason != null) unavailable[key] = reason
  }
  return { values, manual, unavailable }
}

export function workingInput(values: FactorValues): ProcedurePriorityInput {
  const input: ProcedurePriorityInput = { inherentRisk: values.inherentRisk ?? 1 }
  for (const key of RISK_FACTOR_KEYS) {
    if (key !== 'inherentRisk' && values[key] != null) input[key] = values[key]
  }
  return input
}

export function workingUnavailable(working: Pick<RiskWorkingValues, 'values' | 'unavailable'>): FactorText {
  const result: FactorText = {}
  for (const key of RISK_FACTOR_KEYS) {
    if (working.values[key] == null && key in working.unavailable) result[key] = working.unavailable[key] ?? ''
  }
  return result
}

export type LiveRiskScores = Map<string, { score: number; level: RiskLevel | null }>

/** 依已存人工值與目前來源紀錄即時計算各計畫列的優先分（未存檔也顯示）。 */
export function computeLiveRiskScores(state: Pick<AppState, 'workspace' | 'yearArchives' | 'settings'>): LiveRiskScores {
  const pool = buildRiskDerivationPool(state)
  const scores: LiveRiskScores = new Map()
  for (const row of state.workspace.planRows) {
    const saved = state.workspace.procedureRisks?.find((item) => item.qpCode === row.qpCode && item.departmentId === row.departmentId)
    const derived = deriveRiskFactors(pool, row.qpCode, row.departmentId, { seedFallback: row.riskLevel })
    const working = buildWorkingValues(saved, derived)
    const assessment = assessProcedurePriority(workingInput(working.values), workingUnavailable(working))
    scores.set(`${row.qpCode}|${row.departmentId}`, { score: assessment.score, level: assessment.level })
  }
  return scores
}
