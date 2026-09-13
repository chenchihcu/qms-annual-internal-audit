import type { ChecklistItem, ProcedureAudit } from '../types'

/** 每個查檢項皆已判定（含不適用） */
export function isProcedureComplete(audit: ProcedureAudit): boolean {
  if (audit.items.length === 0) return false
  return audit.items.every((item) => item.judgment !== null && item.judgment !== undefined)
}

export function hasNonConformJudgment(audit: ProcedureAudit): boolean {
  return audit.items.some((item) => item.judgment === '不符')
}

export function countPendingItems(items: ChecklistItem[]): number {
  return items.filter((item) => !item.judgment).length
}
