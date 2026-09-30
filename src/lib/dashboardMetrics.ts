import type { AppState, CompanyId } from '../types'
import { companySettingsFor } from '../types'
import { WORKSPACE_COMPANY_ID } from './singleWorkspaceMigration'

/** 台帳 open 且年度等於目前內稽年度 */
export function countCurrentYearOpenObservations(
  state: AppState,
  companyId: CompanyId = WORKSPACE_COMPANY_ID,
): number {
  const company = state.workspace
  const auditYear = companySettingsFor(state, companyId).auditYear
  return company.observations.filter((o) => o.status === 'open' && o.year === auditYear).length
}

/** 前年度 open 觀察，含封存年度資料 */
export function countPriorOpenObservations(
  state: AppState,
  companyId: CompanyId = WORKSPACE_COMPANY_ID,
): number {
  const company = state.workspace
  const auditYear = companySettingsFor(state, companyId).auditYear
  const all = [
    ...company.observations,
    ...Object.entries(state.yearArchives)
      .filter(([year]) => year !== String(auditYear))
      .flatMap(([, archive]) => archive.workspace?.observations ?? []),
  ]
  return all.filter((o) => o.year < auditYear && o.status === 'open').length
}
