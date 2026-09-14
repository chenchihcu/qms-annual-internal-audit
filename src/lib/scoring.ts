import type { ChecklistItem, PlanRow, ProcedureAudit, ScoringRules } from '../types'
import { DEFAULT_SCORING_RULES } from '../types'
import { countMissingEvidenceItems } from './checklistEvidence'
import { getScheduledMonthIndices } from './planStatus'

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
  if (pending > 0) return 'unevaluated'
  if (applicable > 0) return 'scored'
  if (totalItems > 0 && notApplicable === totalItems) return 'not_applicable'
  if (totalItems === 0) return 'unevaluated'
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

  const missingEvidence = countMissingEvidenceItems(items)
  const status = resolveScoreStatus(
    applicable,
    breakdown.pending + missingEvidence,
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
  /** 年度計畫中至少有一格排程的程序數 */
  scheduledProcedures: number
  /** 已完成評分（查檢完整且可計分）的程序數 */
  scoredProcedures: number
  /** 所有排程程序皆已評分 */
  allScheduledScored: boolean
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

function isPlanRowScheduled(row: PlanRow): boolean {
  return getScheduledMonthIndices(row).length > 0
}

function findAuditForPlanRow(audits: ProcedureAudit[], row: PlanRow): ProcedureAudit | undefined {
  return audits.find((a) => a.qpCode === row.qpCode && a.departmentId === row.departmentId)
}

export function calculateAnnualScore(
  audits: ProcedureAudit[],
  rules?: ScoringRules,
  planRows: PlanRow[] = [],
): AnnualScoreSummary {
  const scheduledRows = planRows.filter(isPlanRowScheduled)
  const scheduledProcedures = scheduledRows.length

  const departmentScores = scheduledRows.map((row) => {
    const audit = findAuditForPlanRow(audits, row)
    const result = audit ? scoreProcedureAudit(audit, rules) : null
    return {
      auditId: audit?.id ?? `plan-${row.qpCode}-${row.departmentId}`,
      label: `${row.qpCode} · ${row.department}`,
      score: result?.score ?? null,
      status: result?.status ?? ('unevaluated' as ScoreStatus),
      applicableItems: result?.applicableItems ?? 0,
    }
  })

  let totalNumerator = 0
  let totalApplicable = 0
  let scoredProcedures = 0
  let totalNCR = 0
  let totalObservation = 0

  for (const audit of audits) {
    for (const item of audit.items) {
      if (item.judgment === '不符') totalNCR++
      if (item.judgment === '觀察') totalObservation++
    }
  }

  for (const row of scheduledRows) {
    const audit = findAuditForPlanRow(audits, row)
    if (!audit) continue
    const result = scoreProcedureAudit(audit, rules)
    if (result.status === 'scored' && result.score !== null) {
      scoredProcedures++
      totalApplicable += result.applicableItems
      totalNumerator += (result.score / 100) * result.applicableItems
    }
  }

  const allScheduledScored =
    scheduledProcedures > 0 && scoredProcedures === scheduledProcedures

  const partialScore =
    totalApplicable > 0 ? Math.round((totalNumerator / totalApplicable) * 1000) / 10 : null

  let overallStatus: ScoreStatus = 'unevaluated'
  let overallScore: number | null = null

  if (allScheduledScored && partialScore !== null) {
    overallStatus = 'scored'
    overallScore = partialScore
  } else if (partialScore !== null) {
    overallStatus = 'unevaluated'
    overallScore = null
  }

  return {
    overallScore,
    overallStatus,
    scheduledProcedures,
    scoredProcedures,
    allScheduledScored,
    departmentScores,
    totalNCR,
    totalObservation,
  }
}
