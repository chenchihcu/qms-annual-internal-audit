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

function isJudgmentSidePending(judgment: Judgment | null | undefined, item: ChecklistItem): boolean {
  if (!judgment) return true
  if (judgment === '不適用') {
    return !item.notApplicableReason?.trim() && !item.description?.trim()
  }
  if (itemNeedsObjectiveEvidence({ ...item, judgment })) {
    return !itemHasObjectiveEvidence(item)
  }
  return false
}

/** 未判定、缺客觀證據，或不適用但未填理由 */
export function isChecklistItemPending(item: ChecklistItem): boolean {
  return isJudgmentSidePending(item.judgment, item)
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

export function formatScoreDisplay(result: ScoreResult): string {
  if (result.status === 'scored' && result.score !== null) return `${result.score}%`
  if (result.status === 'not_applicable') return '不適用'
  if (result.status === 'incomplete') return '未完成'
  return '未評'
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

export interface AnnualScoreSummary {
  overallScore: number | null
  overallStatus: ScoreStatus
  departmentScores: Array<{
    auditId: string
    label: string
    score: number | null
    status: ScoreStatus
    applicableItems: number
  }>
  totalNCR: number
  totalObservation: number
}

export function calculateAnnualScore(
  audits: ProcedureAudit[],
  rules?: ScoringRules,
): AnnualScoreSummary {
  const departmentScores = audits.map((audit) => {
    const result = scoreProcedureAudit(audit, rules)
    return {
      auditId: audit.id,
      label: `${audit.qpCode} · ${audit.department}`,
      score: result.score,
      status: result.status,
      applicableItems: result.applicableItems,
    }
  })

  let totalNumerator = 0
  let totalApplicable = 0
  let totalNCR = 0
  let totalObservation = 0
  let hasIncomplete = false

  for (const audit of audits) {
    const result = scoreChecklistItems(audit.items, rules)
    for (const item of audit.items) {
      totalNCR += countNonConformJudgments(item)
      totalObservation += countObservationJudgments(item)
    }
    if (result.status === 'incomplete') hasIncomplete = true
    if (result.status === 'scored' && result.score !== null) {
      totalApplicable += result.applicableItems
      totalNumerator += (result.score / 100) * result.applicableItems
    }
  }

  let overallStatus: ScoreStatus = 'unevaluated'
  if (hasIncomplete) overallStatus = 'incomplete'
  else if (totalApplicable > 0) overallStatus = 'scored'

  const overallScore =
    overallStatus === 'scored'
      ? Math.round((totalNumerator / totalApplicable) * 1000) / 10
      : null

  return {
    overallScore,
    overallStatus,
    departmentScores,
    totalNCR,
    totalObservation,
  }
}
