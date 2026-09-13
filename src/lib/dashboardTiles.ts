import { buildAuditFocusOverview } from './planner'
import { formatScoreDisplay, scoreProcedureAudit } from './scoring'
import type { CompanyData, PlanRow, RiskLevel, ScoringRules } from '../types'

export interface DashboardRiskTile {
  qpCode: string
  departmentId: string
  department: string
  riskLevel: RiskLevel
  scoreLabel: string
  scoreClass: string
  auditKey: string
}

const RISK_ORDER: RiskLevel[] = ['高', '中', '低']

function scoreClassFor(scoreLabel: string): string {
  if (scoreLabel === '—' || scoreLabel === '未評') return 'text-muted'
  if (scoreLabel === '不適用') return 'text-muted'
  const num = parseFloat(scoreLabel)
  if (Number.isNaN(num)) return 'text-muted'
  if (num >= 80) return 'text-green-600 dark:text-green-400'
  if (num >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function resolveDepartmentId(row: { qpCode: string; department: string }, planRows: PlanRow[]): string {
  const exact = planRows.find((p) => p.qpCode === row.qpCode && p.department === row.department)
  if (exact) return exact.departmentId
  const byQp = planRows.find((p) => p.qpCode === row.qpCode)
  return byQp?.departmentId ?? ''
}

export function buildDashboardRiskTiles(
  company: CompanyData,
  scoringRules: ScoringRules,
): Array<{ riskLevel: RiskLevel; tiles: DashboardRiskTile[] }> {
  const focusRows = buildAuditFocusOverview(company.planRows)
  const tiles: DashboardRiskTile[] = focusRows
    .map((row) => {
      const departmentId = resolveDepartmentId(row, company.planRows)
      const audit = company.audits.find(
        (a) => a.qpCode === row.qpCode && a.departmentId === departmentId,
      )
      const score = audit ? scoreProcedureAudit(audit, scoringRules) : null
      const scoreLabel = score ? formatScoreDisplay(score) : '—'
      return {
        qpCode: row.qpCode,
        departmentId,
        department: row.department,
        riskLevel: row.riskLevel,
        scoreLabel,
        scoreClass: scoreClassFor(scoreLabel),
        auditKey: departmentId ? `${row.qpCode}|${departmentId}` : '',
      }
    })
    .filter((t) => t.departmentId)

  return RISK_ORDER.map((riskLevel) => ({
    riskLevel,
    tiles: tiles.filter((t) => t.riskLevel === riskLevel),
  })).filter((g) => g.tiles.length > 0)
}
