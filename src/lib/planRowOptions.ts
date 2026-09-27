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

export function procedureQpSelectOptions(
  planRows: PlanRow[],
  getProcedureTitle?: (qpCode: string, department: string) => string,
) {
  const seen = new Set<string>()
  return planRows.reduce<{ value: string; label: string }[]>((options, row) => {
    if (seen.has(row.qpCode)) return options
    seen.add(row.qpCode)
    const title = getProcedureTitle?.(row.qpCode, row.department) ?? row.process
    options.push({ value: row.qpCode, label: `${row.qpCode} · ${title}` })
    return options
  }, [])
}
