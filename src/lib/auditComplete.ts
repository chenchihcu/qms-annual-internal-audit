import type { ChecklistItem, ProcedureAudit } from '../types'
import { countMissingEvidenceItems } from './checklistEvidence'

/** 每個查檢項皆已判定（含不適用），且符合／不符項已填客觀證據 */
export function isProcedureComplete(audit: ProcedureAudit): boolean {
  if (audit.items.length === 0) return false
  if (!audit.items.every((item) => item.judgment !== null && item.judgment !== undefined)) {
    return false
  }
  return countMissingEvidenceItems(audit.items) === 0
}

export function hasNonConformJudgment(audit: ProcedureAudit): boolean {
  return audit.items.some((item) => item.judgment === '不符')
}

export function countPendingItems(items: ChecklistItem[]): number {
  return items.filter((item) => !item.judgment).length
}
