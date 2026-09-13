/** 計畫列 → 程序稽核表頭：稽核人員可同步的條件 */
export function shouldPropagatePlanAuditorsToAudit(
  previousPlanAuditors: string,
  nextPlanAuditors: string,
  auditAuditors: string,
): boolean {
  if (nextPlanAuditors === auditAuditors) return false
  if (auditAuditors.trim() === '') return true
  return auditAuditors === previousPlanAuditors
}

/** 程序稽核表頭 → 計畫列：稽核人員可同步的條件 */
export function shouldPropagateAuditAuditorsToPlan(
  previousAuditAuditors: string,
  nextAuditAuditors: string,
  planAuditors: string,
): boolean {
  if (nextAuditAuditors === planAuditors) return false
  if (planAuditors.trim() === '') return true
  return planAuditors === previousAuditAuditors
}

export function auditIdForPlanRow(qpCode: string, departmentId: string): string {
  return `audit-${qpCode}-${departmentId}`
}
