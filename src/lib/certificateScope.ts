import type { ChecklistItem, ProcedureAudit } from '../types'
import { isSeedChecklistItem } from './checklistItem'

/** 新查檢題目在單一工作區只保留一個判定。 */
export function resolveCertificateScope(
  _qpCode: string,
  _department: string | undefined,
  _no: number,
): 'shared' {
  return 'shared'
}

export function applyCertificateScopeToItem(
  item: ChecklistItem,
  _qpCode: string,
  _department?: string,
): ChecklistItem {
  const { judgmentByCompany: _legacyJudgments, ...singleJudgmentItem } = item
  return { ...singleJudgmentItem, certificateScope: 'shared' }
}

/** Kept for legacy callers; the one-workspace ledger has no company-specific NCR scope. */
export function defaultNcrCompanyScopeForItem(_item: ChecklistItem): 'both' {
  return 'both'
}

export function ncrCompanyScopeForDualSide(_side: 'jiurun' | 'zhenglongxing'): 'both' {
  return 'both'
}

export function listDualCertificateItemKeys(): string[] {
  return []
}

export function backfillCertificateScopeForItem(
  item: ChecklistItem,
  qpCode: string,
  department: string,
): ChecklistItem {
  if (!isSeedChecklistItem(item)) return applyCertificateScopeToItem(item, qpCode, department)
  if (item.certificateScope === 'shared' && item.judgmentByCompany == null) return item
  return applyCertificateScopeToItem(item, qpCode, department)
}

export function backfillCertificateScopeForAudit(audit: ProcedureAudit): ProcedureAudit {
  const items = audit.items.map((item) => backfillCertificateScopeForItem(item, audit.qpCode, audit.department))
  return items.some((item, index) => item !== audit.items[index]) ? { ...audit, items } : audit
}
