import { itemHasObjectiveEvidence, itemNeedsObjectiveEvidence } from './checklistEvidence'
import type { ChecklistItem, Judgment, ProcedureAudit, ScoringRules } from '../types'
import { DEFAULT_SCORING_RULES } from '../types'

export type ScoreStatus = 'scored' | 'incomplete' | 'unevaluated' | 'not_applicable'

export interface ScoreResult {
  score: number | null
  status: ScoreStatus
  totalItems: number
  applicableItems: number
  breakdown: {
    conform: number
    nonConform: number
    observation: number
    notApplicable: number
    pending: number
  }
}

export type ChecklistPendingReason = '未判定' | '缺客觀證據' | '缺不適用理由'

/** 查檢項尚不可計分的原因；可計分時回傳 null */
export function checklistPendingReason(item: ChecklistItem): ChecklistPendingReason | null {
  const { judgment } = item
  if (!judgment) return '未判定'
  if (judgment === '不適用') {
    return !item.notApplicableReason?.trim() && !item.description?.trim() ? '缺不適用理由' : null
  }
  if (itemNeedsObjectiveEvidence({ ...item, judgment })) {
    return itemHasObjectiveEvidence(item) ? null : '缺客觀證據'
  }
  return null
}

/** 未判定、缺客觀證據，或不適用但未填理由 */
export function isChecklistItemPending(item: ChecklistItem): boolean {
  return checklistPendingReason(item) !== null
}

function applyJudgmentToBreakdown(
  judgment: Judgment,
  breakdown: ScoreResult['breakdown'],
  rules: ScoringRules,
): { numerator: number; applicable: number; judged: number } {
  let numerator = 0
  let applicable = 0
  const judged = 1
  switch (judgment) {
    case '不適用':
      breakdown.notApplicable++
      break
    case '符合':
      breakdown.conform++
      applicable++
      numerator += rules.conform
      break
    case '不符':
      breakdown.nonConform++
      applicable++
      numerator += rules.nonConform
      break
    case '觀察':
      breakdown.observation++
      applicable++
      numerator += rules.observation
      break
  }
  return { numerator, applicable, judged }
}

function resolveScoreStatus(
  applicable: number,
  pending: number,
  notApplicable: number,
  totalItems: number,
  judgedCount: number,
): ScoreStatus {
  if (totalItems === 0) return 'unevaluated'
  if (pending > 0) {
    if (applicable > 0 || judgedCount > 0) return 'incomplete'
    return 'unevaluated'
  }
  if (applicable > 0) return 'scored'
  if (notApplicable === totalItems) return 'not_applicable'
  return 'unevaluated'
}

export function scoreChecklistItems(
  items: ChecklistItem[],
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): ScoreResult {
  const breakdown = {
    conform: 0,
    nonConform: 0,
    observation: 0,
    notApplicable: 0,
    pending: 0,
  }

  let numerator = 0
  let applicable = 0
  let judgedCount = 0
  let scoringUnits = 0

  for (const item of items) {
    scoringUnits++
    if (item.judgment) judgedCount++

    if (isChecklistItemPending(item)) {
      breakdown.pending++
      continue
    }

    if (item.judgment) {
      const r = applyJudgmentToBreakdown(item.judgment, breakdown, rules)
      numerator += r.numerator
      applicable += r.applicable
    }
  }

  const status = resolveScoreStatus(
    applicable,
    breakdown.pending,
    breakdown.notApplicable,
    scoringUnits || items.length,
    judgedCount,
  )
  const score =
    status === 'scored' ? Math.round((numerator / applicable) * 1000) / 10 : null

  return {
    score,
    status,
    totalItems: scoringUnits || items.length,
    applicableItems: applicable,
    breakdown,
  }
}

export function scoreProcedureAudit(
  audit: ProcedureAudit,
  rules?: ScoringRules,
): ScoreResult {
  return scoreChecklistItems(audit.items, rules)
}

export function isAuditComplete(audit: ProcedureAudit, rules?: ScoringRules): boolean {
  const result = scoreProcedureAudit(audit, rules)
  return result.status === 'scored' || result.status === 'not_applicable'
}

export function hasAnyJudgment(audits: ProcedureAudit[]): boolean {
  return audits.some((audit) => audit.items.some((item) => item.judgment != null))
}

export function countNonConformJudgments(item: ChecklistItem): number {
  return item.judgment === '不符' ? 1 : 0
}

export function countObservationJudgments(item: ChecklistItem): number {
  return item.judgment === '觀察' ? 1 : 0
}
