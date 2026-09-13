import { getScheduledMonthIndices } from './planStatus'
import type { PlanRow, ProcedureAudit } from '../types'

function monthStartDate(auditYear: number, month: number): string {
  return `${auditYear}-${String(month).padStart(2, '0')}-01`
}

function monthMidDate(auditYear: number, month: number): string {
  return `${auditYear}-${String(month).padStart(2, '0')}-15`
}

export function resolvePlannedMonth(row: PlanRow, audit: ProcedureAudit, auditYear: number): number | null {
  if (audit.plannedMonth && audit.plannedMonth >= 1 && audit.plannedMonth <= 12) {
    return audit.plannedMonth
  }
  if (audit.auditDate) {
    const date = new Date(audit.auditDate)
    if (!Number.isNaN(date.getTime()) && date.getFullYear() === auditYear) {
      const month = date.getMonth() + 1
      if (row.months[month - 1]) return month
    }
  }
  const scheduled = getScheduledMonthIndices(row)
  return scheduled.length > 0 ? scheduled[0] + 1 : null
}

/** 計畫排定月帶入查檢表標頭（僅填空白欄位） */
export function carryPlanDatesToAudit(
  row: PlanRow,
  audit: ProcedureAudit,
  auditYear: number,
): ProcedureAudit {
  const plannedMonth = resolvePlannedMonth(row, audit, auditYear)
  if (!plannedMonth) return audit

  const patch: Partial<ProcedureAudit> = {}
  if (!audit.plannedMonth) patch.plannedMonth = plannedMonth
  if (!audit.notifyDate?.trim()) patch.notifyDate = monthStartDate(auditYear, plannedMonth)
  if (!audit.auditDate?.trim()) patch.auditDate = monthMidDate(auditYear, plannedMonth)

  if (Object.keys(patch).length === 0) return audit
  return { ...audit, ...patch }
}
