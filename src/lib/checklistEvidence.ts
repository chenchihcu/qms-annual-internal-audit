import type { ChecklistItem } from '../types'

const SAMPLE_RE = /(?:^|[；;]\s*)數[：:]\s*([^；;]+)/
const EVIDENCE_RE = /(?:^|[；;]\s*)客觀證據[：:]\s*([^；;]+)/
const CLAUSE_RE = /(?:^|[；;]\s*)AS9100\s*條款[：:]\s*([^；;]+)/i

export function parseLegacyEvidenceDescription(description: string): {
  sampleSize: string
  objectiveEvidence: string
  as9100Clause: string
  remainder: string
} {
  if (!description.trim()) {
    return { sampleSize: '', objectiveEvidence: '', as9100Clause: '', remainder: '' }
  }

  const sampleSize = description.match(SAMPLE_RE)?.[1]?.trim() ?? ''
  const objectiveEvidence = description.match(EVIDENCE_RE)?.[1]?.trim() ?? ''
  const as9100Clause = description.match(CLAUSE_RE)?.[1]?.trim() ?? ''

  let remainder = description
  for (const re of [SAMPLE_RE, EVIDENCE_RE, CLAUSE_RE]) {
    remainder = remainder.replace(re, '')
  }
  remainder = remainder.replace(/^[；;\s]+|[；;\s]+$/g, '').trim()

  return { sampleSize, objectiveEvidence, as9100Clause, remainder }
}

export function migrateChecklistItem(item: ChecklistItem): ChecklistItem {
  const hasStructured =
    Boolean(item.sampleSize?.trim()) ||
    Boolean(item.objectiveEvidence?.trim()) ||
    Boolean(item.as9100Clause?.trim())

  if (hasStructured || !item.description?.trim()) return item

  const parsed = parseLegacyEvidenceDescription(item.description)
  if (!parsed.sampleSize && !parsed.objectiveEvidence && !parsed.as9100Clause) return item

  return {
    ...item,
    sampleSize: parsed.sampleSize,
    objectiveEvidence: parsed.objectiveEvidence,
    as9100Clause: parsed.as9100Clause,
    description: parsed.remainder,
  }
}

export const EVIDENCE_FIELDS = ['description', 'sampleSize', 'objectiveEvidence', 'notApplicableReason'] as const

export type EvidenceField = (typeof EVIDENCE_FIELDS)[number]

const REQUIRED_EVIDENCE_FIELDS: Record<string, readonly EvidenceField[]> = {
  符合: ['objectiveEvidence'],
  不符: ['objectiveEvidence', 'description'],
  觀察: ['description'],
  不適用: ['notApplicableReason'],
}

const OPTIONAL_EVIDENCE_FIELDS: Record<string, readonly EvidenceField[]> = {
  符合: ['description', 'sampleSize'],
  不符: ['sampleSize'],
  觀察: ['objectiveEvidence', 'sampleSize'],
  不適用: ['sampleSize'],
}

export function evidenceFieldValue(item: ChecklistItem, field: EvidenceField): string {
  return item[field] ?? ''
}

/** 該判定要完成的欄，加上已有文字或使用者打開的欄。不清除未顯示的已存值。 */
export function visibleEvidenceFields(
  item: ChecklistItem,
  revealed: Partial<Record<EvidenceField, boolean>> = {},
): EvidenceField[] {
  const required = item.judgment ? REQUIRED_EVIDENCE_FIELDS[item.judgment] ?? [] : []
  const visible = new Set<EvidenceField>(required)
  for (const field of EVIDENCE_FIELDS) {
    if (evidenceFieldValue(item, field).trim() || revealed[field]) visible.add(field)
  }
  return EVIDENCE_FIELDS.filter((field) => visible.has(field))
}

/** 可另外打開、且不是該判定必填的欄。未判定不提供。 */
export function optionalEvidenceFields(item: ChecklistItem): EvidenceField[] {
  if (!item.judgment) return []
  const optional = OPTIONAL_EVIDENCE_FIELDS[item.judgment] ?? []
  return EVIDENCE_FIELDS.filter((field) => optional.includes(field))
}

/** 符合／不符須填客觀證據才算完成與計分 */
export function itemNeedsObjectiveEvidence(item: ChecklistItem): boolean {
  return item.judgment === '符合' || item.judgment === '不符'
}

export function itemHasObjectiveEvidence(item: ChecklistItem): boolean {
  return Boolean(item.objectiveEvidence?.trim())
}

export function countMissingEvidenceItems(items: ChecklistItem[]): number {
  return items.filter((item) => itemNeedsObjectiveEvidence(item) && !itemHasObjectiveEvidence(item))
    .length
}
