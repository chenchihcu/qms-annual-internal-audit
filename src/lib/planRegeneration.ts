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

/** 預覽列出套用後會改變的每一列：順序、風險等級、月格，以及新增或移除的列。 */
export function describePlanChanges(before: PlanRow[], after: PlanRow[]): PlanChangeRow[] {
  const beforeById = new Map(before.map((row) => [row.id, row]))
  const afterIds = new Set(after.map((row) => row.id))
  const rows: PlanChangeRow[] = []
  for (const row of after) {
    const previous = beforeById.get(row.id)
    const sequenceChanged = previous?.sequence !== row.sequence
    const levelChanged = previous?.riskLevel !== row.riskLevel
    const monthsChanged = monthsLabel(previous) !== monthsLabel(row)
    if (!sequenceChanged && !levelChanged && !monthsChanged) continue
    const parts: string[] = []
    if (!previous) parts.push('新增列')
    if (sequenceChanged && previous) parts.push(`順序 ${previous.sequence}→${row.sequence}`)
    if (levelChanged) parts.push(`風險 ${previous?.riskLevel ?? '—'}→${row.riskLevel}`)
    if (monthsChanged) parts.push(`${monthsLabel(previous)}→${monthsLabel(row)}`)
    rows.push({ id: row.id, label: `${row.qpCode} ${row.department}`, schedule: parts.join('；') })
  }
  for (const row of before) {
    if (!afterIds.has(row.id)) rows.push({ id: row.id, label: `${row.qpCode} ${row.department}`, schedule: '移除列' })
  }
  return rows
}

/**
 * 計畫核准簽章：涵蓋年度計畫頁可改動的內容（列、順序、等級、月格、手動結果、人員、類型）與計畫窗口日期。
 * 核准後任一路徑修改計畫，簽章即不符而視為未核准，不必在每個寫入點各自撤銷。
 */
export function planApprovalSignature(state: Pick<AppState, 'workspace' | 'settings'>): string {
  const { settings } = state
  const payload = JSON.stringify({
    rows: state.workspace.planRows.map((row) => [
      row.id, row.sequence, row.riskLevel, row.months, row.manualMonthOverrides ?? null,
      row.auditors, row.owner, row.auditCategory, row.process, row.documents,
    ]),
    window: [settings.yearStart, settings.planWindowStart, settings.planWindowEnd, settings.managementReviewDate ?? ''],
  })
  let hash = 5381
  for (let index = 0; index < payload.length; index += 1) hash = ((hash * 33) ^ payload.charCodeAt(index)) >>> 0
  return `${payload.length.toString(36)}-${hash.toString(36)}`
}

/** 已核准且核准後未修改；缺簽章者視為未核准（需重新核准）。 */
export function isPlanApprovalCurrent(state: Pick<AppState, 'workspace' | 'settings'>): boolean {
  const { planApprovedAt, planApprovedSignature } = state.settings
  return Boolean(planApprovedAt && planApprovedSignature && planApprovedSignature === planApprovalSignature(state))
}
