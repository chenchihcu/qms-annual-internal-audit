import type { PlanRow } from '../types'

/**
 * 程序相關部門：年度計畫中同一 QP 的所有被稽核部門（依計畫列順序、去重）。
 * 只讀推導，不另存；與部門利害關係人標籤（ISO 9001 4.2 相關方）是不同概念。
 */
export function procedureRelatedDepartments(qpCode: string, planRows: PlanRow[]): string[] {
  const names: string[] = []
  for (const row of planRows) {
    if (row.qpCode !== qpCode) continue
    const name = row.department.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}
