import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import type { AuditSettings, CompanyData, PlanRow, ScoringRules } from '../types'
import { isChecklistItemPending } from './scoring'
import { isAuditComplete, scoreProcedureAudit } from './scoring'

export interface PlanGap {
  qpCode: string
  department: string
  departmentId: string
  reason: 'missing_plan' | 'unscheduled' | 'audit_missing' | 'audit_incomplete'
  detail?: string
}

export interface DualPendingItem {
  qpCode: string
  department: string
  departmentId: string
  no: number
  category: string
}

export interface OpenNcrByScope {
  jiurun: number
  zhenglongxing: number
  both: number
}

export interface MergedCertificateCoverage {
  gaps: PlanGap[]
  allInternalAuditComplete: boolean
  totalOpenNcr: number
  openNcrByScope: OpenNcrByScope
  dualPendingItems: DualPendingItem[]
  uncarriedObservationCount: number
  uncarriedNcrCount: number
}

function planRowKey(row: Pick<PlanRow, 'qpCode' | 'departmentId'>): string {
  return `${row.qpCode}|${row.departmentId}`
}

function isRowScheduled(row: PlanRow): boolean {
  return row.months.some((m) => m !== null && m !== undefined)
}

function collectDualPending(company: CompanyData): DualPendingItem[] {
  const pending: DualPendingItem[] = []
  for (const audit of company.audits) {
    for (const item of audit.items) {
      if (item.certificateScope === 'dual' && isChecklistItemPending(item)) {
        pending.push({
          qpCode: audit.qpCode,
          department: audit.department,
          departmentId: audit.departmentId,
          no: item.no,
          category: item.category,
        })
      }
    }
  }
  return pending
}

function countOpenNcrByScope(company: CompanyData): OpenNcrByScope {
  const counts: OpenNcrByScope = { jiurun: 0, zhenglongxing: 0, both: 0 }
  for (const ncr of company.ncrs) {
    if (ncr.status === '結案') continue
    const scope = ncr.companyScope ?? 'both'
    counts[scope]++
  }
  return counts
}

export function buildSharedCoverage(
  company: CompanyData,
  _auditYear: number,
  rules?: ScoringRules,
): PlanGap[] {
  const gaps: PlanGap[] = []
  const planByKey = new Map(company.planRows.map((r) => [planRowKey(r), r]))

  for (const entry of PROCEDURE_PLAN_TEMPLATE) {
    const key = `${entry.qpCode}|${entry.departmentId}`
    const row = planByKey.get(key)
    if (!row) {
      gaps.push({
        qpCode: entry.qpCode,
        department: entry.departmentName,
        departmentId: entry.departmentId,
        reason: 'missing_plan',
      })
      continue
    }
    if (!isRowScheduled(row)) {
      gaps.push({
        qpCode: entry.qpCode,
        department: row.department,
        departmentId: row.departmentId,
        reason: 'unscheduled',
      })
      continue
    }

    const auditId = `audit-${entry.qpCode}-${entry.departmentId}`
    const audit = company.audits.find((a) => a.id === auditId)
    if (!audit) {
      gaps.push({
        qpCode: entry.qpCode,
        department: row.department,
        departmentId: row.departmentId,
        reason: 'audit_missing',
      })
      continue
    }
    if (!isAuditComplete(audit, rules)) {
      const score = scoreProcedureAudit(audit, rules)
      gaps.push({
        qpCode: entry.qpCode,
        department: row.department,
        departmentId: row.departmentId,
        reason: 'audit_incomplete',
        detail: `未判定 ${score.breakdown.pending}／共 ${score.totalItems}`,
      })
    }
  }

  return gaps
}

export function buildMergedCertificateCoverage(
  company: CompanyData,
  auditYear: number,
  rules?: ScoringRules,
): MergedCertificateCoverage {
  const gaps = buildSharedCoverage(company, auditYear, rules)
  const dualPendingItems = collectDualPending(company)
  const openNcrByScope = countOpenNcrByScope(company)
  const totalOpenNcr = company.ncrs.filter((n) => n.status !== '結案').length

  const uncarriedObservationCount = company.observations.filter(
    (o) => o.status === 'open' && o.year < auditYear && !o.carriedToYear,
  ).length
  const uncarriedNcrCount = company.ncrs.filter(
    (n) => n.status !== '結案' && !n.carriedToYear,
  ).length

  const allInternalAuditComplete = gaps.length === 0 && dualPendingItems.length === 0

  return {
    gaps,
    allInternalAuditComplete,
    totalOpenNcr,
    openNcrByScope,
    dualPendingItems,
    uncarriedObservationCount,
    uncarriedNcrCount,
  }
}

export function deriveInternalAuditComplete(
  company: CompanyData,
  auditYear: number,
  rules?: ScoringRules,
): boolean {
  return buildMergedCertificateCoverage(company, auditYear, rules).allInternalAuditComplete
}

export function gapReasonLabel(reason: PlanGap['reason']): string {
  switch (reason) {
    case 'missing_plan':
      return '缺計畫列'
    case 'unscheduled':
      return '未排月格'
    case 'audit_missing':
      return '未建查檢'
    case 'audit_incomplete':
      return '查檢未完成'
    default:
      return reason
  }
}

export function evaluateDateSequence(settings: AuditSettings): string[] {
  const messages: string[] = []
  const { managementReviewDate, externalAuditDate, auditYear } = settings
  if (managementReviewDate && externalAuditDate) {
    const mgmt = new Date(managementReviewDate)
    const ext = new Date(externalAuditDate)
    if (!isNaN(mgmt.getTime()) && !isNaN(ext.getTime()) && mgmt >= ext) {
      messages.push('管理審查日期應早於外部稽核日期（內稽 → 管審 → 外稽）。')
    }
  }
  if (externalAuditDate) {
    const extMonth = new Date(externalAuditDate).getMonth() + 1
    const endMonth = new Date(settings.planWindowEnd).getMonth() + 1
    if (
      new Date(externalAuditDate).getFullYear() === auditYear &&
      endMonth > extMonth
    ) {
      messages.push(
        `年度計畫窗口結束月（${endMonth} 月）晚於外部稽核月（${extMonth} 月），請調整計畫或外稽日期。`,
      )
    }
  }
  return messages
}
