import type { ChecklistItem, NCR, NCRStatus, ProcedureAudit } from '../types'

export function generateNCRNumber(year: number, index: number): string {
  return `NCR-${year}-${String(index).padStart(3, '0')}`
}

export function collectNCRsFromAudits(
  audits: ProcedureAudit[],
  year: number,
  existingNcrs: NCR[] = [],
): NCR[] {
  const existingByItemId = new Map(
    existingNcrs.filter((n) => n.checklistItemId).map((n) => [n.checklistItemId!, n]),
  )

  const result: NCR[] = [...existingNcrs]
  let nextIndex = existingNcrs.length + 1

  for (const audit of audits) {
    for (const item of audit.items) {
      if (item.judgment !== '不符') continue
      if (existingByItemId.has(item.id)) continue

      const ncr: NCR = {
        id: `ncr-${item.id}`,
        ncrNumber: generateNCRNumber(year, nextIndex),
        qpCode: audit.qpCode,
        departmentId: audit.departmentId,
        department: audit.department,
        process: audit.process,
        description: item.description || item.content,
        date: audit.auditDate || new Date().toISOString().slice(0, 10),
        status: '開立',
        checklistItemId: item.id,
        sourceAuditId: audit.id,
        requirementSnapshot: item.content,
        evidenceSnapshot: item.evidenceReference ?? item.description,
        findingSnapshot: item.description || item.content,
      }
      result.push(ncr)
      existingByItemId.set(item.id, ncr)
      nextIndex++
    }
  }

  return result
}

export function syncNCRDescriptions(
  ncrs: NCR[],
  audits: ProcedureAudit[],
): NCR[] {
  const itemMap = new Map<string, ChecklistItem>()
  for (const audit of audits) {
    for (const item of audit.items) {
      itemMap.set(item.id, item)
    }
  }

  return ncrs.map((ncr) => {
    if (!ncr.checklistItemId || ncr.findingSnapshot) return ncr
    const item = itemMap.get(ncr.checklistItemId)
    if (!item || item.judgment !== '不符') return ncr
    const finding = item.description || item.content
    return { ...ncr, description: finding, findingSnapshot: finding }
  })
}

export function updateNCRStatus(ncrs: NCR[], id: string, status: NCRStatus): NCR[] {
  return ncrs.map((n) => (n.id === id ? { ...n, status } : n))
}

export function findChecklistItem(
  audits: ProcedureAudit[],
  itemId: string,
): ChecklistItem | undefined {
  for (const audit of audits) {
    const found = audit.items.find((i) => i.id === itemId)
    if (found) return found
  }
  return undefined
}

/** NCR is stale when its linked checklist item is missing or no longer 不符. */
export function isNcrStale(ncr: NCR, audits: ProcedureAudit[]): boolean {
  if (!ncr.checklistItemId) return false
  const item = findChecklistItem(audits, ncr.checklistItemId)
  if (!item) return true
  return item.judgment !== '不符'
}
