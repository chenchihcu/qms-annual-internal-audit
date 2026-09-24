import type { DepartmentProfile, MonthStatus, PlanRow, ProcedureRiskRecord, RiskLevel } from '../types'
import type { ProcedurePlanEntry } from '../data/procedurePlan'
import {
  countChecklistItems,
  getFocusLegend,
  getProceduresRaw,
  isSeedFinalized,
} from '../data/checklistLoader'
import { calculateProcedurePriority, calculateRiskLevel, clampRiskValue } from './risk'

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
  openCarryForwardCount?: number
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

/** Shown beside auto-arrange preview / apply actions that rewrite plan months. */
export const MANUAL_OVERRIDE_PLAN_NOTE = '手動覆寫的計畫列會保留。'

export const ARRANGEMENT_IMPACT_RULES = {
  scope: '此部門底下各 QP 在年度計畫的「順序」與「月格次數／早晚」。',
  trigger: '僅在方案風險或年度計畫頁按「預覽自動編排」時套用。',
  excludes: 'QR-02-01 已存檔的 QP 改以方案風險為準；已手動覆寫的月格不會被改寫。',
  columnNote: '本欄為各部門在「尚未存 QR-02-01」時的估算；實際以自動編排結果為準。',
} as const

/** 利害關係人工作流與紙本／標準對照（本頁無獨立 QR 匯出） */
export const STAKEHOLDER_WORKFLOW_REFERENCES = {
  procedures: [
    { code: 'QP-28', name: '內部稽核管理程序', note: '年度計畫擬定、稽核頻率與月格編排' },
    { code: 'QP-02', name: '風險與機會管理程序', note: 'QR-02-01 方案風險（與本頁部門 O×S 分軌）' },
  ],
  clauses: [
    { standard: 'ISO 9001', clause: '4.2', label: '了解相關方需求與期望（利害關係人標籤）' },
    { standard: 'ISO 9001', clause: '9.2', label: '內部稽核方案規劃（計畫順序／頻率）' },
  ],
  forms: [
    { code: '—', name: '本頁工作流輸入', role: '部門利害關係人與 O／S 三檔事實', storage: '備份 JSON' },
    { code: 'QR-28-01', name: '年度稽核計畫表', role: '編排產出（月格）', tab: 'plan' as const },
    { code: 'QR-02-01', name: '風險與機會監控評估表', role: 'QP 方案風險（優先於本頁估算）', tab: 'risk' as const },
  ],
} as const

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
    procedureRisks = [],
  } = input

  const deptMap = new Map(departments.map((d) => [d.id, d]))
  const riskMap = new Map(
    procedureRisks.map((r) => [`${r.qpCode}|${r.departmentId}`, r]),
  )

  function resolveRiskLevel(entry: ProcedurePlanEntry, dept: DepartmentProfile): RiskLevel {
    const saved = riskMap.get(`${entry.qpCode}|${entry.departmentId}`)
    if (saved) {
      const values = {
        inherentRisk: saved.inherentRisk,
        previousInternalNcrCount: saved.previousInternalNcrCount,
        previousThirdPartyNcrCount: saved.previousThirdPartyNcrCount,
        overdueOpenNcrCount: saved.overdueOpenNcrCount,
        customerComplaintLevel: saved.customerComplaintLevel,
        changeImpact: saved.changeImpact,
        monthsSinceLastAudit: saved.monthsSinceLastAudit,
      }
      return calculateProcedurePriority(values).level
    }
    const seedRisk = entry.riskLevel ?? '低'
    const { level } = calculateRiskLevel(dept.riskOccurrence, dept.riskSeverity)
    if (seedRisk === '高' || level === '高') return '高'
    if (seedRisk === '中' || level === '中') return '中'
    return '低'
  }

  function priorityScore(entry: ProcedurePlanEntry, dept: DepartmentProfile): number {
    const saved = riskMap.get(`${entry.qpCode}|${entry.departmentId}`)
    if (saved) {
      return calculateProcedurePriority({
        inherentRisk: saved.inherentRisk,
        previousInternalNcrCount: saved.previousInternalNcrCount,
        previousThirdPartyNcrCount: saved.previousThirdPartyNcrCount,
        overdueOpenNcrCount: saved.overdueOpenNcrCount,
        customerComplaintLevel: saved.customerComplaintLevel,
        changeImpact: saved.changeImpact,
        monthsSinceLastAudit: saved.monthsSinceLastAudit,
      }).score * 100
    }
    const riskOrder = { 高: 3, 中: 2, 低: 1 }
    const seedRisk = riskOrder[entry.riskLevel ?? '低']
    const deptPri = calculateDepartmentPriority(dept)
    return seedRisk * 100 + deptPri
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

/** 月格僅切換排程（空白 ↔ 擬定）；執行結果由查檢與 NCR 推導顯示。 */
export function cycleMonthStatus(current: MonthStatus): MonthStatus {
  if (current == null) return '擬定'
  if (current === '擬定') return null
  return null
}
