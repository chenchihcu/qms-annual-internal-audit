import type { DepartmentProfile, MonthStatus, PlanRow, ProcedureRiskRecord, RiskLevel } from '../types'
import type { ProcedurePlanEntry } from '../data/procedurePlan'
import {
  countChecklistItems,
  getFocusLegend,
  getProceduresRaw,
  isSeedFinalized,
} from '../data/checklistLoader'
import { assessProcedurePriority, calculateRiskLevel, clampRiskValue, recordPriorityInput } from './risk'

export type OsBand = 'low' | 'mid' | 'high'

export const OS_BAND_SCALE: Record<OsBand, number> = {
  low: 1,
  mid: 3,
  high: 5,
}

export const OS_BAND_LABELS: Record<OsBand, string> = {
  low: '低',
  mid: '中',
  high: '高',
}

export const OS_BAND_ORDER: OsBand[] = ['low', 'mid', 'high']

export const OCCURRENCE_BAND_GUIDE: Record<OsBand, string> = {
  low: '近兩年幾乎未發生',
  mid: '約每年一次',
  high: '一年多次或持續發生',
}

export const SEVERITY_BAND_GUIDE: Record<OsBand, string> = {
  low: '內部可吸收、無外部衝擊',
  mid: '需矯正、影響部門績效',
  high: '客訴、認證觀察或法規不合格',
}

export function scaleToOsBand(scale: number): OsBand {
  const s = clampRiskValue(scale)
  if (s <= 2) return 'low'
  if (s <= 3) return 'mid'
  return 'high'
}

export function osBandToScale(band: OsBand): number {
  return OS_BAND_SCALE[band]
}

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
  /** @deprecated 全域件數 >2 時所有列加頻；改用 openCarryForwardByKey。 */
  openCarryForwardCount?: number
  /** `qpCode|departmentId` → 該列跨年未結件數；有值時只對該列加頻。 */
  openCarryForwardByKey?: Record<string, number>
  /** 只傳本年度已確認／已核准的紀錄（plannerReadyRisks）。 */
  procedureRisks?: ProcedureRiskRecord[]
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

/** 部門風險等級 → 年度計畫窗口內建議稽核次數（不含跨年未結案加成） */
export function annualAuditFrequencyForLevel(level: RiskLevel): number {
  if (level === '高') return 3
  if (level === '中') return 2
  return 1
}

export interface ArrangementImpact {
  summary: string
  sortLine: string
  frequencyLine: string
  timingLine: string
}

export function describeArrangementImpact(
  dept: DepartmentProfile,
  level: RiskLevel,
): ArrangementImpact {
  const priority = calculateDepartmentPriority(dept)
  const freq = annualAuditFrequencyForLevel(level)
  const hasCustomerReg = dept.stakeholders.some((s) => s === '客戶' || s === '法規/認證')
  const preferEarly = level === '高' || hasCustomerReg

  const sortLine = `QP 排序：優先分數 ${priority}（高者先排進月格）`
  const frequencyLine = `年次數：約 ${freq} 次（依部門風險「${level}」；高 3／中 2／低 1）`
  const timingLine = preferEarly
    ? `月格時點：偏計畫窗口前半${hasCustomerReg ? '（含客戶／法規標籤）' : '（高風險）'}`
    : '月格時點：窗口內均衡分散'
  const summary = `本部門 QP · 優先 ${priority} · 年約 ${freq} 次 · ${preferEarly ? '偏早' : '均衡'}`

  return { summary, sortLine, frequencyLine, timingLine }
}

function frequencyForRisk(level: RiskLevel, carryBoost: number): number {
  return Math.min(4, annualAuditFrequencyForLevel(level) + (carryBoost > 0 ? 1 : 0))
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
  return Array.from({ length: 12 }, () => null) as MonthStatus[]
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
    openCarryForwardByKey,
    procedureRisks = [],
  } = input

  const deptMap = new Map(departments.map((d) => [d.id, d]))
  const riskMap = new Map(
    procedureRisks.map((r) => [`${r.qpCode}|${r.departmentId}`, r]),
  )

  function assessSaved(entry: ProcedurePlanEntry) {
    const saved = riskMap.get(`${entry.qpCode}|${entry.departmentId}`)
    return saved ? assessProcedurePriority(recordPriorityInput(saved), saved.unavailableFactors) : null
  }

  function resolveRiskLevel(entry: ProcedurePlanEntry, dept: DepartmentProfile): RiskLevel {
    const assessed = assessSaved(entry)
    if (assessed) return assessed.level ?? assessed.formulaLevel
    const seedRisk = entry.riskLevel ?? '低'
    const { level } = calculateRiskLevel(dept.riskOccurrence, dept.riskSeverity)
    if (seedRisk === '高' || level === '高') return '高'
    if (seedRisk === '中' || level === '中') return '中'
    return '低'
  }

  function priorityScore(entry: ProcedurePlanEntry, dept: DepartmentProfile): number {
    const assessed = assessSaved(entry)
    if (assessed) return assessed.score * 100
    const riskOrder = { 高: 3, 中: 2, 低: 1 }
    const seedRisk = riskOrder[entry.riskLevel ?? '低']
    const deptPri = calculateDepartmentPriority(dept)
    return seedRisk * 100 + deptPri
  }

  function carryBoostFor(entry: ProcedurePlanEntry): number {
    if (openCarryForwardByKey) return (openCarryForwardByKey[`${entry.qpCode}|${entry.departmentId}`] ?? 0) > 0 ? 1 : 0
    return openCarryForwardCount > 2 ? 1 : 0
  }
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
    const deptA = deptMap.get(a.departmentId)
    const deptB = deptMap.get(b.departmentId)
    const priA = deptA ? priorityScore(a, deptA) : 0
    const priB = deptB ? priorityScore(b, deptB) : 0
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

    const riskLevel = resolveRiskLevel(entry, dept)

    const freq = frequencyForRisk(riskLevel, carryBoostFor(entry))
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

/** 月格僅切換排程（空白 ↔ 擬定）；執行結果由查檢與 NCR 推導顯示。 */
export function cycleMonthStatus(current: MonthStatus): MonthStatus {
  if (current == null) return '擬定'
  if (current === '擬定') return null
  return null
}
