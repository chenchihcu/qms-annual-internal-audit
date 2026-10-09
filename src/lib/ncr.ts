import { defaultNcrCompanyScopeForItem } from './certificateScope'
import type { ChecklistItem, NCR, NCRStatus, Observation, ProcedureAudit } from '../types'

export interface NcrCloseGateResult {
  ok: boolean
  missing: string[]
}

const EMPTY_NCR_CLOSEOUT = {
  rootCause: '',
  correctiveAction: '',
  verificationEvidence: '',
}

export function ncrNumberLabel(ncrNumber: string): string {
  return ncrNumber.replace(/-(?:jiurun|zhenglongxing|zlx)$/iu, '')
}

export function ncrNumberLabels(ncrs: Array<Pick<NCR, 'id' | 'ncrNumber'>>): Map<string, string> {
  const labels = ncrs.map((ncr) => ncrNumberLabel(ncr.ncrNumber))
  const totals = new Map<string, number>()
  for (const label of labels) totals.set(label, (totals.get(label) ?? 0) + 1)

  const occurrences = new Map<string, number>()
  const result = new Map<string, string>()
  ncrs.forEach((ncr, index) => {
    const label = labels[index]
    const occurrence = (occurrences.get(label) ?? 0) + 1
    occurrences.set(label, occurrence)
    result.set(ncr.id, totals.get(label)! > 1 ? `${label} (${occurrence})` : label)
  })
  return result
}

export function normalizeNCRList(ncrs: Array<Partial<NCR> & Pick<NCR, 'id' | 'ncrNumber'>>): NCR[] {
  return ncrs.map(normalizeNCR)
}

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

function isNonConformForNcr(item: ChecklistItem, _ncr: NCR): boolean {
  return item.judgment === '不符'
}

/** 未結案且來源年早於目標年（缺 sourceYear 不算前年度） */
export function isPriorOpenNcr(ncr: NCR, targetYear: number): boolean {
  if (ncr.status === '結案') return false
  if (ncr.sourceYear == null) return false
  return ncr.sourceYear < targetYear
}

/** NCR linked to a checklist item that is no longer 不符 */
export function isNcrStale(ncr: NCR, audits: ProcedureAudit[]): boolean {
  if (!ncr.checklistItemId) return false
  const item = findChecklistItem(audits, ncr.checklistItemId)
  if (!item) return true
  return !isNonConformForNcr(item, ncr)
}

function ncrIdForItem(item: ChecklistItem): string {
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
    ...EMPTY_NCR_CLOSEOUT,
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
    sourceYear: year,
    sourceAuditId: audit.id,
    requirementSnapshot: item.content,
    evidenceSnapshot: item.evidenceReference ?? item.description,
    findingSnapshot: item.description || item.content,
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

export function findNcrsForChecklistItem(ncrs: NCR[], checklistItemId: string): NCR[] {
  return ncrs.filter((n) => n.checklistItemId === checklistItemId)
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
    if (!ncr.checklistItemId) return ncr
    const item = itemMap.get(ncr.checklistItemId)
    if (!item || !isNonConformForNcr(item, ncr)) return ncr
    const finding = item.description || item.content
    const evidence = item.evidenceReference ?? item.description
    return {
      ...ncr,
      requirementSnapshot: ncr.requirementSnapshot ?? item.content,
      evidenceSnapshot: ncr.evidenceSnapshot ?? evidence,
      findingSnapshot: ncr.findingSnapshot ?? finding,
    }
  })
}

export function isNcrOpen(ncr: NCR): boolean {
  return ncr.status === '開立' || ncr.status === '矯正中'
}

export function isNcrClosed(ncr: NCR): boolean {
  return ncr.status === '結案'
}

export function findNcrForObservation(ncrs: NCR[], observation: Observation): NCR | undefined {
  if (observation.ncrId) {
    const linked = ncrs.find((n) => n.id === observation.ncrId)
    if (linked) return linked
  }
  return ncrs.find((n) => n.observationId === observation.id)
}

export function ensureNcrFromChecklistObservation(
  audit: ProcedureAudit,
  itemId: string,
  existingNcrs: NCR[],
  year: number,
): { ncrs: NCR[]; ncrId: string | null } {
  const item = audit.items.find((i) => i.id === itemId)
  if (!item || item.judgment !== '觀察') {
    return { ncrs: existingNcrs, ncrId: null }
  }

  const existing = existingNcrs.find((n) => n.checklistItemId === itemId)
  if (existing) {
    return { ncrs: existingNcrs, ncrId: existing.id }
  }

  const description = item.description.trim() !== '' ? item.description : item.content
  const ncr = normalizeNCR({
    id: `ncr-obs-chk-${itemId}`,
    ncrNumber: generateNCRNumber(year, existingNcrs.length + 1),
    qpCode: audit.qpCode,
    departmentId: audit.departmentId,
    department: audit.department,
    process: audit.process,
    description,
    date: audit.auditDate || new Date().toISOString().slice(0, 10),
    status: '開立',
    checklistItemId: itemId,
    sourceYear: year,
    sourceAuditId: audit.id,
  })

  return { ncrs: [...existingNcrs, ncr], ncrId: ncr.id }
}

export function findNcrForChecklistItem(ncrs: NCR[], itemId: string): NCR | undefined {
  return ncrs.find((n) => n.checklistItemId === itemId)
}

export function ensureNcrFromObservation(
  observation: Observation,
  existingNcrs: NCR[],
  year: number,
): { ncrs: NCR[]; ncrId: string } {
  const existing = findNcrForObservation(existingNcrs, observation)
  if (existing) {
    return { ncrs: existingNcrs, ncrId: existing.id }
  }

  const description =
    observation.description.trim() !== ''
      ? observation.description
      : observation.content

  const ncr = normalizeNCR({
    id: `ncr-obs-${observation.id}`,
    ncrNumber: generateNCRNumber(year, existingNcrs.length + 1),
    qpCode: observation.qpCode,
    departmentId: observation.departmentId,
    department: observation.department,
    process: observation.process,
    description,
    date: new Date().toISOString().slice(0, 10),
    status: '開立',
    observationId: observation.id,
    sourceYear: observation.year,
  })

  return { ncrs: [...existingNcrs, ncr], ncrId: ncr.id }
}

const CLOSE_REQUIRED_LABELS: Array<{ key: keyof NCR; label: string }> = [
  { key: 'correctiveActionReference', label: '矯正措施引用' },
  { key: 'effectivenessReference', label: '效果確認引用' },
  { key: 'effectivenessVerifiedBy', label: '效果確認人' },
  { key: 'effectivenessVerifiedAt', label: '效果確認日' },
]

export function validateNcrClose(ncr: NCR): NcrCloseGateResult {
  const missing = CLOSE_REQUIRED_LABELS.filter(({ key }) => !String(ncr[key] ?? '').trim()).map(
    ({ label }) => label,
  )
  return { ok: missing.length === 0, missing }
}

export function canTransitionNcrStatus(ncr: NCR, nextStatus: NCRStatus): NcrCloseGateResult {
  if (nextStatus !== '結案') return { ok: true, missing: [] }
  return validateNcrClose(ncr)
}

export type NcrReportStageId = 'filing' | 'rootCause' | 'corrective' | 'closed'

export interface NcrReportStageProgress {
  id: NcrReportStageId
  label: string
  complete: boolean
  statusLabel: string
}

/** QR-28-03 報告四段進度（推導值，不入庫） */
export function ncrReportProgress(
  ncr: Pick<NCR, 'description' | 'rootCause' | 'correctiveAction' | 'status'>,
): NcrReportStageProgress[] {
  const filing = Boolean(ncr.description?.trim())
  const rootCause = Boolean(ncr.rootCause?.trim())
  const corrective = Boolean(ncr.correctiveAction?.trim())
  const closed = ncr.status === '結案'
  return [
    { id: 'filing', label: 'NCR立案', complete: filing, statusLabel: filing ? '已填' : '未填' },
    { id: 'rootCause', label: '原因分析', complete: rootCause, statusLabel: rootCause ? '已填' : '未填' },
    { id: 'corrective', label: '矯正措施', complete: corrective, statusLabel: corrective ? '已填' : '未填' },
    { id: 'closed', label: '結案', complete: closed, statusLabel: closed ? '已結' : '未結' },
  ]
}

const NCR_DRAFT_COMPARE_KEYS: Array<keyof NCR> = [
  'date',
  'dueDate',
  'description',
  'process',
  'rootCause',
  'correctiveAction',
  'correctiveActionReference',
  'verificationEvidence',
  'effectivenessReference',
  'effectivenessVerifiedBy',
  'effectivenessVerifiedAt',
  'responsiblePerson',
  'status',
  'containment',
  'classification',
]

export function ncrDraftEquals(a: NCR, b: NCR): boolean {
  return NCR_DRAFT_COMPARE_KEYS.every((key) => String(a[key] ?? '') === String(b[key] ?? ''))
}

export function cloneNcrDraft(ncr: NCR): NCR {
  return { ...ncr }
}

export function resolveNcrSourceAuditors(ncr: NCR, audits: ProcedureAudit[]): string {
  if (!ncr.sourceAuditId) return ''
  return audits.find((audit) => audit.id === ncr.sourceAuditId)?.auditors ?? ''
}
