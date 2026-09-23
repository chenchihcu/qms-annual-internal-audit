import type { ChecklistItem, ProcedureAudit, ScoringRules } from '../types'
import { DEFAULT_SCORING_RULES } from '../types'

export interface ScoreResult {
  score: number | null
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

  for (const item of items) {
    if (!item.judgment) {
      breakdown.pending++
      continue
    }
    switch (item.judgment) {
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
  }

  const score = applicable === 0 ? null : (numerator / applicable) * 100

  return {
    score: score == null ? null : Math.round(score * 10) / 10,
    totalItems: items.length,
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

export interface AnnualScoreSummary {
  overallScore: number | null
  departmentScores: Array<{
    auditId: string
    label: string
    score: number | null
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
      applicableItems: result.applicableItems,
    }
  })

  let totalNumerator = 0
  let totalApplicable = 0
  let totalNCR = 0
  let totalObservation = 0

  for (const audit of audits) {
    const result = scoreChecklistItems(audit.items, rules)
    totalApplicable += result.applicableItems
    for (const item of audit.items) {
      if (item.judgment === '不符') totalNCR++
      if (item.judgment === '觀察') totalObservation++
    }
    if (result.applicableItems > 0 && result.score != null) {
      totalNumerator += (result.score / 100) * result.applicableItems
    }
  }

  const overallScore =
    totalApplicable === 0
      ? null
      : Math.round((totalNumerator / totalApplicable) * 1000) / 10

  return {
    overallScore,
    departmentScores,
    totalNCR,
    totalObservation,
  }
}

export function formatScoreDisplay(result: ScoreResult): string {
  if (result.score !== null && result.applicableItems > 0) return `${result.score}%`
  if (result.totalItems > 0 && result.applicableItems === 0) return '不適用'
  return '未評'
}
