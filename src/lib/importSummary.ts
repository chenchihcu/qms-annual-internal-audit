import type { AppState } from '../types'
import { getLegacyPlanConflicts } from './sharedPlan'

export interface ImportSummary {
  version: number
  auditYear: number
  companies: string[]
  ncrCount: number
  observationCount: number
  suggestionCount: number
  sharedPlanCount: number
  planConflictCount: number
}

export function summarizeImportState(state: AppState): ImportSummary {
  let ncrCount = 0
  let observationCount = 0
  let suggestionCount = 0
  for (const co of Object.values(state.companies)) {
    ncrCount += co.ncrs.length
    observationCount += co.observations.length
    suggestionCount += co.suggestions.length
  }
  return {
    version: state.version,
    auditYear: state.settings.auditYear,
    companies: Object.values(state.companies).map((c) => c.name),
    ncrCount,
    observationCount,
    suggestionCount,
    sharedPlanCount: state.sharedPlanRows?.length ?? 0,
    planConflictCount: getLegacyPlanConflicts(state).length,
  }
}

export function parseImportJSON(json: string): AppState {
  const parsed = JSON.parse(json) as AppState
  if (parsed.version < 4) {
    throw new Error('不支援的資料版本')
  }
  if (!parsed.companies || !parsed.settings) {
    throw new Error('JSON 缺少必要欄位')
  }
  return parsed
}
