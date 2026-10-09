import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { AppState, CompanyData, PlanRow } from '../types'
import { effectiveExternalAuditDate } from './externalAuditPrep'
import { autoArrangePlan } from './planner'
import { plannerReadyRisks } from './risk'

/** 依 QP|部門 計算本年度未結觀察與 NCR；第三方建議無 QP 鍵，不計入列加頻。 */
export function openCarryForwardByKey(company: CompanyData): Record<string, number> {
  const counts: Record<string, number> = {}
  const add = (qpCode: string, departmentId: string) => {
    const key = `${qpCode}|${departmentId}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  for (const observation of company.observations) {
    if (observation.status === 'open') add(observation.qpCode, observation.departmentId)
  }
  for (const ncr of company.ncrs) {
    if (ncr.status !== '結案') add(ncr.qpCode, ncr.departmentId)
  }
  return counts
}

/** 自動編排的唯一入口：預覽與套用用同一份輸入，避免畫面與寫入結果不同。 */
export function buildRegeneratedPlanRows(state: AppState): PlanRow[] {
  const company = state.workspace
  const settings = state.settings
  return autoArrangePlan(
    {
      departments: company.departments,
      planEntries: PROCEDURE_PLAN_TEMPLATE,
      auditYear: settings.auditYear,
      planWindowStart: settings.planWindowStart,
      planWindowEnd: settings.planWindowEnd,
      managementReviewDate: settings.managementReviewDate,
      externalAuditDate: effectiveExternalAuditDate(state.externalAuditPrep, settings) || undefined,
      existingRows: company.planRows,
      openCarryForwardByKey: openCarryForwardByKey(company),
      procedureRisks: plannerReadyRisks(company, settings.auditYear),
    },
    { leadAuditor: settings.leadAuditor },
  )
}

export interface PlanChangeRow {
  id: string
  label: string
  schedule: string
}

function monthsLabel(row: PlanRow | undefined): string {
  if (!row) return '無'
  const months = row.months.flatMap((status, index) => (status ? [index + 1] : []))
  return months.length > 0 ? `${months.join('、')}月` : '未排'
}

/** 預覽只列出等級或月格會改變的列。 */
export function describePlanChanges(before: PlanRow[], after: PlanRow[]): PlanChangeRow[] {
  const beforeById = new Map(before.map((row) => [row.id, row]))
  const rows: PlanChangeRow[] = []
  for (const row of after) {
    const previous = beforeById.get(row.id)
    const levelChanged = previous?.riskLevel !== row.riskLevel
    const monthsChanged = monthsLabel(previous) !== monthsLabel(row)
    if (!levelChanged && !monthsChanged) continue
    const parts: string[] = []
    if (levelChanged) parts.push(`風險 ${previous?.riskLevel ?? '—'}→${row.riskLevel}`)
    if (monthsChanged) parts.push(`${monthsLabel(previous)}→${monthsLabel(row)}`)
    rows.push({ id: row.id, label: `${row.qpCode} ${row.department}`, schedule: parts.join('；') })
  }
  return rows
}
