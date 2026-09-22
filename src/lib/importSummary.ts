import { normalizeToV6 } from './migrateToV6'
import type { AppState, NcrCompanyScope } from '../types'
import { DUAL_COMPANY_LABEL, NCR_COMPANY_SCOPE_LABELS } from '../types'

export interface ImportSummary {
  version: number
  auditYear: number
  certificateLabel: string
  ncrCount: number
  ncrByScope: Record<NcrCompanyScope, number>
  observationCount: number
  suggestionCount: number
}

export function summarizeImportState(state: AppState): ImportSummary {
  const ncrByScope: Record<NcrCompanyScope, number> = {
    jiurun: 0,
    zhenglongxing: 0,
    both: 0,
  }
  for (const ncr of state.company.ncrs) {
    const scope = ncr.companyScope ?? 'both'
    ncrByScope[scope]++
  }
  return {
    version: state.version,
    auditYear: state.settings.auditYear,
    certificateLabel: DUAL_COMPANY_LABEL,
    ncrCount: state.company.ncrs.length,
    ncrByScope,
    observationCount: state.company.observations.length,
    suggestionCount: state.company.suggestions.length,
  }
}

export function formatImportSummary(summary: ImportSummary): string {
  const scopeParts = (['jiurun', 'zhenglongxing', 'both'] as NcrCompanyScope[])
    .filter((s) => summary.ncrByScope[s] > 0)
    .map((s) => `${NCR_COMPANY_SCOPE_LABELS[s]} ${summary.ncrByScope[s]}`)
  const ncrDetail = scopeParts.length > 0 ? `（${scopeParts.join('、')}）` : ''
  return `版本 ${summary.version} · ${summary.auditYear} 年 · ${summary.certificateLabel} · NCR ${summary.ncrCount}${ncrDetail} · 觀察 ${summary.observationCount} · 建議 ${summary.suggestionCount}`
}

export function parseImportJSON(json: string): AppState {
  const parsed = JSON.parse(json) as unknown
  return normalizeToV6(parsed)
}
