import {
  defaultNcrCompanyScopeForItem,
  ncrCompanyScopeForDualSide,
} from './certificateScope'
import type { ChecklistItem, CompanyId, NCR, NCRStatus, ProcedureAudit } from '../types'

export function generateNCRNumber(year: number, index: number): string {
  return `NCR-${year}-${String(index).padStart(3, '0')}`
}

export function findChecklistItem(
  audits: ProcedureAudit[],
  itemId: string,
): ChecklistItem | undefined {
  for (const audit of audits) {
    const item = audit.items.find((i) => i.id === itemId)
    if (item) return item
  }
  return undefined
}

function isNonConformForNcr(item: ChecklistItem, ncr: NCR): boolean {
  const scope = item.certificateScope ?? 'shared'
  const ncrScope = ncr.companyScope ?? 'both'
  if (scope === 'dual' && item.judgmentByCompany) {
    if (ncrScope === 'jiurun') return item.judgmentByCompany.jiurun === '不符'
    if (ncrScope === 'zhenglongxing') return item.judgmentByCompany.zhenglongxing === '不符'
    return false
  }
  if (ncrScope === 'jiurun' || ncrScope === 'zhenglongxing') {
    return item.judgment === '不符' && (item.certificateScope ?? 'shared') === ncrScope
  }
  return item.judgment === '不符'
}

/** NCR linked to a checklist item that is no longer 不符 */
export function isNcrStale(ncr: NCR, audits: ProcedureAudit[]): boolean {
  if (!ncr.checklistItemId) return false
  const item = findChecklistItem(audits, ncr.checklistItemId)
  if (!item) return true
  return !isNonConformForNcr(item, ncr)
}

function ncrIdForItem(item: ChecklistItem, side?: CompanyId): string {
  if (item.certificateScope === 'dual' && side) {
    return `ncr-${item.id}-${side}`
  }
  return `ncr-${item.id}`
}

function buildNcrFromItem(
  audit: ProcedureAudit,
  item: ChecklistItem,
  year: number,
  index: number,
  companyScope: NCR['companyScope'],
  checklistItemId: string,
  id: string,
): NCR {
  return {
    id,
    ncrNumber: generateNCRNumber(year, index),
    qpCode: audit.qpCode,
    departmentId: audit.departmentId,
    department: audit.department,
    process: audit.process,
    description: item.description || item.content,
    date: audit.auditDate || new Date().toISOString().slice(0, 10),
    status: '開立',
    checklistItemId,
    companyScope,
  }
}

export function collectNCRsFromAudits(
  audits: ProcedureAudit[],
  year: number,
  existingNcrs: NCR[] = [],
): NCR[] {
  const existingById = new Map(existingNcrs.map((n) => [n.id, n]))
  const result: NCR[] = [...existingNcrs]
  let nextIndex = existingNcrs.length + 1

  for (const audit of audits) {
    for (const item of audit.items) {
      const scope = item.certificateScope ?? 'shared'

      if (scope === 'dual' && item.judgmentByCompany) {
        for (const side of ['jiurun', 'zhenglongxing'] as CompanyId[]) {
          if (item.judgmentByCompany[side] !== '不符') continue
          const id = ncrIdForItem(item, side)
          if (existingById.has(id)) continue
          const ncr = buildNcrFromItem(
            audit,
            item,
            year,
            nextIndex,
            ncrCompanyScopeForDualSide(side),
            item.id,
            id,
          )
          result.push(ncr)
          existingById.set(id, ncr)
          nextIndex++
        }
        continue
      }

      if (item.judgment !== '不符') continue
      const id = ncrIdForItem(item)
      if (existingById.has(id)) continue
      const companyScope = defaultNcrCompanyScopeForItem(item)
      const ncr = buildNcrFromItem(audit, item, year, nextIndex, companyScope, item.id, id)
      result.push(ncr)
      existingById.set(id, ncr)
      nextIndex++
    }
  }

  return result
}

export function updateNCRStatus(ncrs: NCR[], id: string, status: NCRStatus): NCR[] {
  return ncrs.map((n) => (n.id === id ? { ...n, status } : n))
}
