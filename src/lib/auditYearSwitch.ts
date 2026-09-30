import { getPdcaOverview } from './workflowStatus'
import type { AppState, CompanyId } from '../types'
import { companySettingsFor } from '../types'
import { WORKSPACE_COMPANY_ID } from './singleWorkspaceMigration'

export function buildYearSwitchDescription(
  state: AppState,
  targetYear: number,
  companyId: CompanyId = WORKSPACE_COMPANY_ID,
): string {
  const settings = companySettingsFor(state, companyId)
  const pdca = getPdcaOverview(state, companyId)
  const archived = state.yearArchives[String(targetYear)]?.workspace
  const restoreNote = archived
    ? `將還原 ${targetYear} 年已封存的計畫與事件。`
    : `將建立 ${targetYear} 年台帳：計畫列保留並清空月格，查檢事件與追蹤紀錄需重新建立。`
  const gapNote = !pdca.annualCloseReady && pdca.annualCloseGaps.length > 0
    ? `\n\n目前年度尚未達結案條件：\n${pdca.annualCloseGaps.slice(0, 4).map((gap) => `· ${gap.message}`).join('\n')}`
    : ''
  return `封存 ${settings.auditYear} 年台帳；外稽準備年度（${state.externalAuditPrep.year}）不變。\n${restoreNote}${gapNote}`
}

export function parseAuditYearDraft(value: string, currentYear: number): number | null {
  const year = Number(value)
  if (!Number.isInteger(year) || value.length !== 4 || year < 2000 || year > 2200) return null
  if (year === currentYear) return null
  return year
}
