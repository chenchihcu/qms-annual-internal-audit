import { getScheduledMonthIndices } from './planStatus'
import type { PlanRow, ProcedureAudit } from '../types'

function monthStartDate(auditYear: number, month: number): string {
  return `${auditYear}-${String(month).padStart(2, '0')}-01`
}

function monthMidDate(auditYear: number, month: number): string {
  return `${auditYear}-${String(month).padStart(2, '0')}-15`
}

/** 計畫列第一個排定月（1–12） */
export function resolvePlannedMonthFromPlan(row: PlanRow): number | null {
  const scheduled = getScheduledMonthIndices(row)
  return scheduled.length > 0 ? scheduled[0] + 1 : null
}

export function resolvePlannedMonth(row: PlanRow, audit: ProcedureAudit, auditYear: number): number | null {
  const fromPlan = resolvePlannedMonthFromPlan(row)
  if (fromPlan) return fromPlan

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

/** 計畫排定月帶入查檢表標頭；計畫為排程依據，開啟查檢時與計畫月同步 */
export function carryPlanDatesToAudit(
  row: PlanRow,
  audit: ProcedureAudit,
  auditYear: number,
): ProcedureAudit {
  const plannedMonth = resolvePlannedMonthFromPlan(row)
  if (!plannedMonth) return audit

  return {
    ...audit,
    plannedMonth,
    notifyDate: monthStartDate(auditYear, plannedMonth),
    auditDate: monthMidDate(auditYear, plannedMonth),
  }
}
