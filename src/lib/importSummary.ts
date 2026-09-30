import type { AppState } from '../types'
import { companySettingsFor } from '../types'
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
  const co = state.workspace
  return {
    version: state.version,
    auditYear: companySettingsFor(state).auditYear,
    companies: [co.name],
    ncrCount: co.ncrs.length,
    observationCount: co.observations.length,
    suggestionCount: co.suggestions.length,
    sharedPlanCount: state.sharedPlanRows?.length ?? 0,
    planConflictCount: 0,
  }
}

export function parseImportJSON(json: string): AppState {
  const parsed = JSON.parse(json) as AppState
  if (parsed.version < 4) {
    throw new Error('不支援的資料版本')
  }
  if (!parsed.workspace || !parsed.settings) {
    throw new Error('JSON 缺少必要欄位')
  }
  return parsed
}
