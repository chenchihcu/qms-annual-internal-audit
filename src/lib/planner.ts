import type { DepartmentProfile, MonthStatus, PlanRow, RiskLevel } from '../types'
import type { ProcedurePlanEntry } from '../data/procedurePlan'
import {
  countChecklistItems,
  getFocusLegend,
  getProceduresRaw,
  isSeedFinalized,
} from '../data/checklistLoader'
import { calculateRiskLevel } from './risk'

export const STAKEHOLDER_WEIGHTS: Record<string, number> = {
  客戶: 10,
  '法規/認證': 10,
  經營層: 7,
  員工: 5,
  供應商: 5,
}

export interface PlannerInput {
  departments: DepartmentProfile[]
  planEntries: ProcedurePlanEntry[]
  auditYear: number
  planWindowStart: string
  planWindowEnd: string
  managementReviewDate?: string
  externalAuditDate?: string
  existingRows?: PlanRow[]
  openCarryForwardCount?: number
}

export interface PlannerOptions {
  leadAuditor?: string
}

function parseMonth(dateStr: string, year: number): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  if (d.getFullYear() !== year) return null
  return d.getMonth() + 1
}

export function getWindowMonths(
  year: number,
  start: string,
  end: string,
  mgmtReview?: string,
  externalAudit?: string,
): number[] {
  const startMonth = parseMonth(start, year) ?? 1
  const endMonth = parseMonth(end, year) ?? 12
  let bufferEnd = endMonth

  const cutoffMonths: number[] = []
  if (mgmtReview) {
    const reviewMonth = parseMonth(mgmtReview, year)
    if (reviewMonth && reviewMonth > 1) cutoffMonths.push(reviewMonth - 1)
  }
  if (externalAudit) {
    const extMonth = parseMonth(externalAudit, year)
    if (extMonth && extMonth > 1) cutoffMonths.push(extMonth - 1)
  }
  if (cutoffMonths.length > 0) {
    bufferEnd = Math.min(bufferEnd, ...cutoffMonths)
  }

  const months: number[] = []
  for (let m = startMonth; m <= bufferEnd; m++) months.push(m)
  if (months.length === 0) {
    for (let m = 1; m <= 12; m++) months.push(m)
  }
  return months
}

export function calculateDepartmentPriority(dept: DepartmentProfile): number {
  const stakeholderScore = dept.stakeholders.reduce(
    (sum, tag) => sum + (STAKEHOLDER_WEIGHTS[tag] ?? 0),
    0,
  )
  const { index } = calculateRiskLevel(dept.riskOccurrence, dept.riskSeverity)
  return stakeholderScore * 2 + index
}

function frequencyForRisk(level: RiskLevel, carryBoost: number): number {
  const base = level === '高' ? 3 : level === '中' ? 2 : 1
  return Math.min(4, base + (carryBoost > 0 ? 1 : 0))
}

function distributeMonths(
  count: number,
  availableMonths: number[],
  monthLoad: number[],
  preferEarly: boolean,
): number[] {
  if (count <= 0 || availableMonths.length === 0) return []

  const sorted = [...availableMonths].sort((a, b) => {
    const loadDiff = monthLoad[a - 1] - monthLoad[b - 1]
    if (loadDiff !== 0) return loadDiff
    return preferEarly ? a - b : b - a
  })

  const selected: number[] = []
  const pool = preferEarly
    ? sorted
    : [...sorted].sort((a, b) => monthLoad[a - 1] - monthLoad[b - 1] || a - b)

  for (let i = 0; i < count; i++) {
    const idx = i % pool.length
    const month = pool[idx]
    if (!selected.includes(month)) {
      selected.push(month)
      monthLoad[month - 1]++
    } else {
      const alt = pool.find((m) => !selected.includes(m))
      if (alt) {
        selected.push(alt)
        monthLoad[alt - 1]++
      }
    }
  }

  return selected.sort((a, b) => a - b)
}

function emptyMonths(): MonthStatus[] {
  return Array.from({ length: 12 }, () => null as MonthStatus)
}

export function autoArrangePlan(
  input: PlannerInput,
  options: PlannerOptions = {},
): PlanRow[] {
  const {
    departments,
    planEntries,
    auditYear,
    planWindowStart,
    planWindowEnd,
    managementReviewDate,
    externalAuditDate,
    existingRows,
    openCarryForwardCount = 0,
  } = input

  const deptMap = new Map(departments.map((d) => [d.id, d]))
  const availableMonths = getWindowMonths(
    auditYear,
    planWindowStart,
    planWindowEnd,
    managementReviewDate,
    externalAuditDate,
  )

  const monthLoad = new Array(12).fill(0)
  const overrideMap = new Map<string, PlanRow>()
  existingRows?.forEach((row) => {
    if (row.manualOverride) overrideMap.set(row.id, row)
    row.months.forEach((status, i) => {
      if (status) monthLoad[i]++
    })
  })

  const sortedEntries = [...planEntries].sort((a, b) => {
    const riskOrder = { 高: 3, 中: 2, 低: 1 }
    const ra = riskOrder[a.riskLevel ?? '低']
    const rb = riskOrder[b.riskLevel ?? '低']
    if (rb !== ra) return rb - ra
    const deptA = deptMap.get(a.departmentId)
    const deptB = deptMap.get(b.departmentId)
    const priA = deptA ? calculateDepartmentPriority(deptA) : 0
    const priB = deptB ? calculateDepartmentPriority(deptB) : 0
    if (priB !== priA) return priB - priA
    return a.qpCode.localeCompare(b.qpCode)
  })

  const rows: PlanRow[] = []

  sortedEntries.forEach((entry, index) => {
    const rowId = `plan-${entry.qpCode}-${entry.departmentId}`
    const existing = overrideMap.get(rowId)
    const dept = deptMap.get(entry.departmentId)
    if (!dept) return

    if (existing) {
      rows.push({ ...existing, sequence: index + 1 })
      return
    }

    const seedRisk = entry.riskLevel ?? '低'
    const { level } = calculateRiskLevel(dept.riskOccurrence, dept.riskSeverity)
    const riskLevel: RiskLevel =
      seedRisk === '高' || level === '高'
        ? '高'
        : seedRisk === '中' || level === '中'
          ? '中'
          : '低'

    const freq = frequencyForRisk(riskLevel, openCarryForwardCount > 2 ? 1 : 0)
    const preferEarly =
      riskLevel === '高' || dept.stakeholders.some((s) => s === '客戶' || s === '法規/認證')

    const selectedMonths = distributeMonths(freq, availableMonths, monthLoad, preferEarly)
    const months = emptyMonths()
    selectedMonths.forEach((m) => {
      months[m - 1] = '擬定'
    })

    rows.push({
      id: rowId,
      qpCode: entry.qpCode,
      departmentId: entry.departmentId,
      sequence: index + 1,
      riskLevel,
      department: entry.departmentName,
      process: entry.process,
      documents: entry.documents,
      auditUnit: dept.auditUnit,
      owner: dept.owner || entry.owner,
      auditors: dept.defaultAuditors || options.leadAuditor || '',
      auditCategory: entry.auditCategory,
      months,
      manualOverride: false,
    })
  })

  return rows.sort((a, b) => a.sequence - b.sequence)
}

export interface AuditFocusRow {
  sheet: string
  qpCode: string
  department: string
  owner: string
  riskLevel: RiskLevel
  itemCount: number
  auditCategory: string
}

export function buildAuditFocusOverview(rows: PlanRow[]): AuditFocusRow[] {
  const legend = getFocusLegend()
  if (legend.length > 0 && isSeedFinalized()) {
    const bySheet = new Map(getProceduresRaw().map((p) => [p.sheet, p]))
    const focusRows = legend.map((f) => {
      const proc = bySheet.get(f.sheet)
      const qp = proc?.procedureCode ?? `sheet-${f.sheet}`
      const dept = proc?.department ?? f.department
      const row = rows.find((r) => r.qpCode === qp && r.department === dept)
      return {
        sheet: f.sheet,
        qpCode: qp,
        department: f.department,
        owner: row?.owner ?? f.owner,
        riskLevel: f.riskLevel as RiskLevel,
        itemCount: countChecklistItems(qp, dept),
        auditCategory: row?.auditCategory ?? '系統稽核',
      }
    })
    const processRow = rows.find((r) => r.qpCode === 'QR-28-04')
    const configRow = rows.find((r) => r.qpCode === 'QR-28-05')
    if (processRow) {
      focusRows.push({
        sheet: 'QR-28-04',
        qpCode: 'QR-28-04',
        department: processRow.department,
        owner: processRow.owner,
        riskLevel: processRow.riskLevel,
        itemCount: countChecklistItems('QR-28-04', processRow.department),
        auditCategory: '製程稽核',
      })
    }
    if (configRow) {
      focusRows.push({
        sheet: 'QR-28-05',
        qpCode: 'QR-28-05',
        department: configRow.department,
        owner: configRow.owner,
        riskLevel: configRow.riskLevel,
        itemCount: countChecklistItems('QR-28-05', configRow.department),
        auditCategory: '型態稽核',
      })
    }
    return focusRows
  }
  return rows.map((row) => ({
    sheet: row.documents,
    qpCode: row.qpCode,
    department: row.department,
    owner: row.owner,
    riskLevel: row.riskLevel,
    itemCount: countChecklistItems(row.qpCode, row.department),
    auditCategory: row.auditCategory,
  }))
}

export function cycleMonthStatus(current: MonthStatus): MonthStatus {
  const order: MonthStatus[] = [null, '擬定', '滿意', '不滿意', '矯正中', '矯正圓滿']
  const idx = order.indexOf(current)
  return order[(idx + 1) % order.length]
}
