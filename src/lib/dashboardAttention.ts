import { buildAuditFocusOverview } from './planner'
import { scoreProcedureAudit } from './scoring'
import type {
  AuditEventStatus,
  InternalAuditCategory,
  PlanRow,
  ProcedureAudit,
  RiskLevel,
  ScoringRules,
} from '../types'
import { DEFAULT_SCORING_RULES } from '../types'

export interface ProcedureAttentionRow {
  sheet: string
  qpCode: string
  department: string
  owner: string
  riskLevel: RiskLevel
  auditCategory: InternalAuditCategory
  auditId?: string
  status: AuditEventStatus
  score: number | null
  judgedCount: number
  totalItems: number
}

export type AttentionFilter = 'needsAttention' | 'highMediumRisk' | 'scored' | 'all'

export const ATTENTION_SCORE_THRESHOLD = 80

const RISK_ORDER: Record<RiskLevel, number> = { 高: 0, 中: 1, 低: 2 }

const FILTER_LABELS: Record<AttentionFilter, string> = {
  needsAttention: '需關注',
  highMediumRisk: '高中風險',
  scored: '已計分',
  all: '全部',
}

export const ATTENTION_FILTERS: AttentionFilter[] = [
  'needsAttention',
  'highMediumRisk',
  'scored',
  'all',
]

export function getAttentionFilterLabel(filter: AttentionFilter): string {
  return FILTER_LABELS[filter]
}

function resolveStatus(audit?: ProcedureAudit): AuditEventStatus {
  return audit?.status ?? '規劃中'
}

function countJudged(items: ProcedureAudit['items']): number {
  return items.filter((item) => item.judgment != null).length
}

export function buildProcedureAttentionRows(
  planRows: PlanRow[],
  audits: ProcedureAudit[],
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): ProcedureAttentionRow[] {
  const focusRows = buildAuditFocusOverview(planRows)
  const auditByKey = new Map(
    audits.map((audit) => [`${audit.qpCode}|${audit.department}`, audit]),
  )

  return focusRows.map((row) => {
    const audit = auditByKey.get(`${row.qpCode}|${row.department}`)
    const scoreResult = audit ? scoreProcedureAudit(audit, rules) : null

    return {
      sheet: row.sheet,
      qpCode: row.qpCode,
      department: row.department,
      owner: row.owner,
      riskLevel: row.riskLevel,
      auditCategory: row.auditCategory as InternalAuditCategory,
      auditId: audit?.id,
      status: resolveStatus(audit),
      score: scoreResult?.score ?? null,
      judgedCount: audit ? countJudged(audit.items) : 0,
      totalItems: audit?.items.length ?? row.itemCount,
    }
  })
}

export function isNeedsAttention(row: ProcedureAttentionRow): boolean {
  if (row.riskLevel === '高' || row.riskLevel === '中') return true
  if (row.score != null && row.score < ATTENTION_SCORE_THRESHOLD) return true
  if (row.status === '執行中') return true
  if (row.auditCategory === '製程稽核' || row.auditCategory === '型態稽核') return true
  return false
}

export function filterAttentionRows(
  rows: ProcedureAttentionRow[],
  filter: AttentionFilter,
): ProcedureAttentionRow[] {
  switch (filter) {
    case 'needsAttention':
      return rows.filter(isNeedsAttention)
    case 'highMediumRisk':
      return rows.filter((row) => row.riskLevel === '高' || row.riskLevel === '中')
    case 'scored':
      return rows.filter((row) => row.score != null)
    case 'all':
      return rows
  }
}

export function sortAttentionRows(rows: ProcedureAttentionRow[]): ProcedureAttentionRow[] {
  return [...rows].sort((a, b) => {
    const riskDiff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel]
    if (riskDiff !== 0) return riskDiff

    if (a.score == null && b.score != null) return -1
    if (a.score != null && b.score == null) return 1
    if (a.score != null && b.score != null && a.score !== b.score) {
      return a.score - b.score
    }

    return a.qpCode.localeCompare(b.qpCode, 'zh-Hant')
  })
}
