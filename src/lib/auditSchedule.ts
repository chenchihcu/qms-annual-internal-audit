import { scoreProcedureAudit } from './scoring'
import type {
  AuditEventStatus,
  CompanyData,
  InternalAuditCategory,
  PlanRow,
  ProcedureAudit,
  RiskLevel,
  ScoringRules,
} from '../types'
import { DEFAULT_SCORING_RULES } from '../types'

export type ScheduleFilter = 'inProgress' | 'thisMonth' | 'all'
export type CategoryFilter = 'all' | InternalAuditCategory

export interface AuditScheduleRow {
  auditId: string
  qpCode: string
  department: string
  departmentId: string
  auditCategory: InternalAuditCategory
  riskLevel: RiskLevel
  status: AuditEventStatus
  plannedDate?: string
  auditDate?: string
  scheduledMonths: string
  judgedCount: number
  totalItems: number
  score: number | null
}

const STATUS_ORDER: Record<AuditEventStatus, number> = {
  執行中: 0,
  規劃中: 1,
  已回報: 2,
}

function planKey(qpCode: string, departmentId: string) {
  return `${qpCode}|${departmentId}`
}

function scheduledMonthLabels(plan?: PlanRow): string {
  if (!plan) return ''
  return plan.months
    .map((status, index) => (status ? `${index + 1}月` : ''))
    .filter(Boolean)
    .join('、')
}

export function buildAuditScheduleRows(
  company: CompanyData,
  rules: ScoringRules = DEFAULT_SCORING_RULES,
): AuditScheduleRow[] {
  const planByKey = new Map(company.planRows.map((row) => [planKey(row.qpCode, row.departmentId), row]))

  return company.audits
    .map((audit: ProcedureAudit) => {
      const plan = planByKey.get(planKey(audit.qpCode, audit.departmentId))
      const scoreResult = scoreProcedureAudit(audit, rules)
      return {
        auditId: audit.id,
        qpCode: audit.qpCode,
        department: audit.department,
        departmentId: audit.departmentId,
        auditCategory: audit.auditCategory,
        riskLevel: plan?.riskLevel ?? '低',
        status: audit.status ?? '規劃中',
        plannedDate: audit.plannedDate,
        auditDate: audit.auditDate,
        scheduledMonths: scheduledMonthLabels(plan),
        judgedCount: audit.items.filter((item) => item.judgment != null).length,
        totalItems: audit.items.length,
        score: scoreResult.score,
      }
    })
    .sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (statusDiff !== 0) return statusDiff
      return a.qpCode.localeCompare(b.qpCode, 'zh-Hant')
    })
}

export function defaultScheduleFilter(rows: AuditScheduleRow[]): ScheduleFilter {
  if (rows.some((row) => row.status === '執行中')) return 'inProgress'
  const month = new Date().getMonth() + 1
  if (rows.some((row) => row.scheduledMonths.includes(`${month}月`))) return 'thisMonth'
  return 'all'
}

export function filterScheduleRows(
  rows: AuditScheduleRow[],
  scheduleFilter: ScheduleFilter,
  categoryFilter: CategoryFilter,
  referenceDate = new Date(),
): AuditScheduleRow[] {
  const month = referenceDate.getMonth() + 1
  const year = referenceDate.getFullYear()

  return rows.filter((row) => {
    if (categoryFilter !== 'all' && row.auditCategory !== categoryFilter) return false
    if (scheduleFilter === 'all') return true
    if (scheduleFilter === 'inProgress') return row.status === '執行中'
    if (scheduleFilter === 'thisMonth') {
      if (row.scheduledMonths.includes(`${month}月`)) return true
      const date = row.auditDate || row.plannedDate
      if (date) {
        const parsed = new Date(date)
        return parsed.getFullYear() === year && parsed.getMonth() + 1 === month
      }
      return false
    }
    return true
  })
}

export const SCHEDULE_FILTER_LABELS: Record<ScheduleFilter, string> = {
  inProgress: '執行中',
  thisMonth: '本月',
  all: '全部',
}

export const CATEGORY_FILTER_LABELS: Record<CategoryFilter, string> = {
  all: '全部類型',
  系統稽核: '系統稽核',
  製程稽核: '製程稽核',
  型態稽核: '型態稽核',
}
