import { getDisplayMonthStatus } from './planStatus'
import { isNcrOpen, ncrNumberLabels } from './ncr'
import type { CompanyData, MonthStatus, NCR, PlanRow } from '../types'

const DONE_STATUSES: MonthStatus[] = ['滿意', '矯正圓滿']

export interface TodayWorkProcedure {
  qpCode: string
  departmentId: string
  department: string
  status: MonthStatus
  auditKey: string
}

export interface TodayWorkNcr {
  id: string
  ncrNumber: string
  qpCode: string
  dueDate?: string
}

export interface TodayWorkSummary {
  month: number
  procedures: TodayWorkProcedure[]
  openNcrs: TodayWorkNcr[]
}

function isScheduledInMonth(row: PlanRow, monthIndex: number): boolean {
  return row.months[monthIndex] !== null && row.months[monthIndex] !== undefined
}

export function buildTodayWork(
  company: CompanyData,
  auditYear: number,
  referenceDate: Date = new Date(),
): TodayWorkSummary {
  const monthIndex =
    referenceDate.getFullYear() === auditYear ? referenceDate.getMonth() : -1

  const procedures: TodayWorkProcedure[] = []
  if (monthIndex >= 0) {
    for (const row of company.planRows) {
      if (!isScheduledInMonth(row, monthIndex)) continue
      const status = getDisplayMonthStatus(
        row,
        monthIndex,
        company.audits,
        company.ncrs,
        auditYear,
      )
      if (status && DONE_STATUSES.includes(status)) continue
      procedures.push({
        qpCode: row.qpCode,
        departmentId: row.departmentId,
        department: row.department,
        status,
        auditKey: `${row.qpCode}|${row.departmentId}`,
      })
    }
  }

  const ncrLabels = ncrNumberLabels(company.ncrs)
  const openNcrs: TodayWorkNcr[] = company.ncrs.filter(isNcrOpen).map((ncr: NCR) => ({
    id: ncr.id,
    ncrNumber: ncrLabels.get(ncr.id) ?? ncr.ncrNumber,
    qpCode: ncr.qpCode,
    ...(ncr.dueDate ? { dueDate: ncr.dueDate } : {}),
  }))

  return {
    month: monthIndex + 1,
    procedures,
    openNcrs,
  }
}
