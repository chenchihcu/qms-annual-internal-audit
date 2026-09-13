import type { ChecklistItem, NCR, NCRStatus, ProcedureAudit } from '../types'

export const EMPTY_NCR_CLOSEOUT = {
  rootCause: '',
  correctiveAction: '',
  verificationEvidence: '',
} as const

/** 舊版 localStorage 可能缺少結案欄位，補預設空字串避免渲染錯誤 */
export function normalizeNCR(ncr: Partial<NCR> & Pick<NCR, 'id' | 'ncrNumber'>): NCR {
  return {
    ...EMPTY_NCR_CLOSEOUT,
    qpCode: '',
    departmentId: '',
    department: '',
    process: '',
    description: '',
    date: '',
    status: '開立',
    ...ncr,
    rootCause: ncr.rootCause ?? '',
    correctiveAction: ncr.correctiveAction ?? '',
    verificationEvidence: ncr.verificationEvidence ?? '',
  }
}

export function normalizeNCRList(ncrs: Array<Partial<NCR> & Pick<NCR, 'id' | 'ncrNumber'>>): NCR[] {
  return ncrs.map(normalizeNCR)
}

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

/** NCR linked to a checklist item that is no longer 不符 */
export function isNcrStale(ncr: NCR, audits: ProcedureAudit[]): boolean {
  if (!ncr.checklistItemId) return false
  const item = findChecklistItem(audits, ncr.checklistItemId)
  return !item || item.judgment !== '不符'
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

      const ncr = normalizeNCR({
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
      })
      result.push(ncr)
      existingByItemId.set(item.id, ncr)
      nextIndex++
    }
  }

  return result
}

export function updateNCRStatus(ncrs: NCR[], id: string, status: NCRStatus): NCR[] {
  return ncrs.map((n) => (n.id === id ? { ...n, status } : n))
}
