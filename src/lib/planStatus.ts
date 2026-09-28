import { hasNonConformJudgment, isProcedureComplete } from './auditComplete'
import { isNcrClosed, isNcrOpen } from './ncr'
import type { MonthStatus, NCR, PlanRow, ProcedureAudit } from '../types'

export function isMonthScheduled(row: PlanRow, monthIndex: number): boolean {
  const status = row.months[monthIndex]
  return status !== null && status !== undefined
}

export function getScheduledMonthIndices(row: PlanRow): number[] {
  return row.months
    .map((status, index) => (status !== null && status !== undefined ? index : -1))
    .filter((index) => index >= 0)
}

export function resolveAuditMonth(audit: ProcedureAudit, auditYear: number): number | null {
  if (audit.plannedMonth && audit.plannedMonth >= 1 && audit.plannedMonth <= 12) {
    return audit.plannedMonth
  }
  if (audit.auditDate) {
    const date = new Date(audit.auditDate)
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === auditYear) {
      return date.getMonth() + 1
    }
  }
  return null
}

function findAuditForRow(
  audits: ProcedureAudit[],
  row: PlanRow,
): ProcedureAudit | undefined {
  return audits.find((audit) => audit.qpCode === row.qpCode && audit.departmentId === row.departmentId)
}

function ncrsForProcedure(ncrs: NCR[], row: PlanRow): NCR[] {
  return ncrs.filter((ncr) => ncr.qpCode === row.qpCode && ncr.departmentId === row.departmentId)
}

/** 由查檢完成度與 NCR 狀態推導月格狀態（不含手動覆寫）；同一計畫列所有已排程月格共用結果 */
export function deriveMonthStatus(
  row: PlanRow,
  monthIndex: number,
  audits: ProcedureAudit[],
  ncrs: NCR[],
  _auditYear: number,
): MonthStatus {
  if (!isMonthScheduled(row, monthIndex)) return null

  const audit = findAuditForRow(audits, row)
  const procedureNcrs = ncrsForProcedure(ncrs, row)
  const openNcrs = procedureNcrs.filter(isNcrOpen)

  if (openNcrs.length > 0) {
    return '矯正中'
  }

  if (procedureNcrs.length > 0 && procedureNcrs.every(isNcrClosed)) {
    return '矯正圓滿'
  }

  if (!audit || !isProcedureComplete(audit)) {
    return '擬定'
  }

  if (hasNonConformJudgment(audit)) {
    return '不滿意'
  }

  return '滿意'
}

export type MonthCellChoice = 'blank' | '擬定' | '滿意' | '不滿意' | '矯正中' | '矯正圓滿'

const RESULT_CHOICES: MonthCellChoice[] = ['滿意', '不滿意', '矯正中', '矯正圓滿']

/** 點選月格：排程只寫 `months`（空白／擬定）；滿意等結果只寫 `manualMonthOverrides`。 */
export function applyMonthCellChoice(
  row: Pick<PlanRow, 'months' | 'manualMonthOverrides'>,
  monthIndex: number,
  choice: MonthCellChoice,
): { months: MonthStatus[]; manualMonthOverrides: (MonthStatus | null)[] } {
  const months = [...row.months] as MonthStatus[]
  const manualMonthOverrides = Array.from({ length: 12 }, (_, index) => row.manualMonthOverrides?.[index] ?? null)
  if (monthIndex < 0 || monthIndex > 11) return { months, manualMonthOverrides }

  if (choice === 'blank') {
    months[monthIndex] = null
    manualMonthOverrides[monthIndex] = null
    return { months, manualMonthOverrides }
  }

  months[monthIndex] = '擬定'
  manualMonthOverrides[monthIndex] = RESULT_CHOICES.includes(choice) ? choice : null
  return { months, manualMonthOverrides }
}

export function getDisplayMonthStatus(
  row: PlanRow,
  monthIndex: number,
  audits: ProcedureAudit[],
  ncrs: NCR[],
  auditYear: number,
): MonthStatus {
  const manual = row.manualMonthOverrides?.[monthIndex]
  if (manual !== undefined && manual !== null) {
    return manual
  }
  return deriveMonthStatus(row, monthIndex, audits, ncrs, auditYear)
}

export function derivePlanRowMonths(
  row: PlanRow,
  audits: ProcedureAudit[],
  ncrs: NCR[],
  auditYear: number,
): MonthStatus[] {
  return row.months.map((_, monthIndex) =>
    getDisplayMonthStatus(row, monthIndex, audits, ncrs, auditYear),
  )
}
