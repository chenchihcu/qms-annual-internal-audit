import type { ChecklistItem, ProcedureAudit, ScoringRules } from '../types'
import { DEFAULT_SCORING_RULES } from '../types'

export type ScoreStatus = 'scored' | 'unevaluated' | 'not_applicable'

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

function resolveScoreStatus(
  applicable: number,
  pending: number,
  notApplicable: number,
  totalItems: number,
): ScoreStatus {
  if (applicable > 0) return 'scored'
  if (totalItems > 0 && notApplicable === totalItems) return 'not_applicable'
  if (pending > 0 || totalItems === 0) return 'unevaluated'
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

  const status = resolveScoreStatus(
    applicable,
    breakdown.pending,
    breakdown.notApplicable,
    items.length,
  )
  const score =
    status === 'scored' ? Math.round((numerator / applicable) * 1000) / 10 : null

  return {
    score,
    status,
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

export function formatScoreDisplay(result: ScoreResult): string {
  if (result.status === 'scored' && result.score !== null) return `${result.score}%`
  if (result.status === 'not_applicable') return '不適用'
  return '未評'
}

export function hasAnyJudgment(audits: ProcedureAudit[]): boolean {
  return audits.some((a) => a.items.some((i) => i.judgment !== null && i.judgment !== undefined))
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

  for (const audit of audits) {
    const result = scoreChecklistItems(audit.items, rules)
    for (const item of audit.items) {
      if (item.judgment === '不符') totalNCR++
      if (item.judgment === '觀察') totalObservation++
    }
    if (result.status === 'scored' && result.score !== null) {
      totalApplicable += result.applicableItems
      totalNumerator += (result.score / 100) * result.applicableItems
    }
  }

  const overallStatus: ScoreStatus = totalApplicable > 0 ? 'scored' : 'unevaluated'
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
