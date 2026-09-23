import { getPdcaOverview } from './workflowStatus'
import type { AppState, CompanyId } from '../types'
import { companySettingsFor } from '../types'

export function buildYearSwitchDescription(
  state: AppState,
  targetYear: number,
  companyId: CompanyId = state.activeCompanyId,
): string {
  const settings = companySettingsFor(state, companyId)
  const company = state.companies[companyId]
  const pdca = getPdcaOverview(state, companyId)
  const archived = state.yearArchives[String(targetYear)]?.companies[companyId]
  const restoreNote = archived
    ? `將還原 ${company.name} ${targetYear} 年已封存的計畫與事件。`
    : `將建立 ${company.name} ${targetYear} 年空白年度台帳（計畫與事件需重新建立）。`
  const gapNote = !pdca.annualCloseReady && pdca.annualCloseGaps.length > 0
    ? `\n\n目前公司年度尚未達結案條件：\n${pdca.annualCloseGaps.slice(0, 4).map((gap) => `· ${gap.message}`).join('\n')}`
    : ''
  return `只封存 ${company.name} ${settings.auditYear} 年台帳；另一家與外稽準備年度（${state.externalAuditPrep.year}）不變。\n${restoreNote}${gapNote}`
}

export function parseAuditYearDraft(value: string, currentYear: number): number | null {
  const year = Number(value)
  if (!Number.isInteger(year) || value.length !== 4 || year < 2000 || year > 2200) return null
  if (year === currentYear) return null
  return year
}
