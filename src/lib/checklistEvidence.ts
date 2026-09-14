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
