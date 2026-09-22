import type { PlanRow } from '../types'

export function buildPlanRowKey(qpCode: string, departmentId: string): string {
  return `${qpCode}|${departmentId}`
}

export function planRowSelectOptions(planRows: PlanRow[]) {
  return planRows.map((r) => ({
    value: buildPlanRowKey(r.qpCode, r.departmentId),
    label: `${r.qpCode} · ${r.department}`,
  }))
}
