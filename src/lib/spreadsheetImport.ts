import type { AppState, ChecklistItem, CompanyData, CompanyId, PlanRow, RiskLevel } from '../types'
import { AUDIT_CATEGORIES } from '../types'

export type SpreadsheetRecordType = 'checklist' | 'plan'

export interface SpreadsheetRow {
  recordType: SpreadsheetRecordType
  qpCode: string
  departmentId: string
  no?: number
  content?: string
  as9100Clause?: string
  sampleSize?: string
  objectiveEvidence?: string
  auditors?: string
  riskLevel?: RiskLevel
  process?: string
  documents?: string
  auditCategory?: string
}

export interface SpreadsheetParseResult {
  rows: SpreadsheetRow[]
  errors: string[]
  warnings: string[]
}

export interface SpreadsheetApplySummary {
  checklistUpdated: number
  checklistAdded: number
  planUpdated: number
  skipped: number
  errors: string[]
}

const HEADER_ALIASES: Record<string, keyof SpreadsheetRow | 'recordType'> = {
  recordtype: 'recordType',
  類型: 'recordType',
  type: 'recordType',
  qpcode: 'qpCode',
  程序: 'qpCode',
  qp: 'qpCode',
  departmentid: 'departmentId',
  部門id: 'departmentId',
  部門: 'departmentId',
  no: 'no',
  項次: 'no',
  content: 'content',
  稽核內容: 'content',
  內容: 'content',
  as9100clause: 'as9100Clause',
  條款: 'as9100Clause',
  samplesize: 'sampleSize',
  抽樣: 'sampleSize',
  objectiveevidence: 'objectiveEvidence',
  客觀證據: 'objectiveEvidence',
  auditors: 'auditors',
  稽核員: 'auditors',
  risklevel: 'riskLevel',
  風險: 'riskLevel',
  process: 'process',
  流程: 'process',
  documents: 'documents',
  文件: 'documents',
  auditcategory: 'auditCategory',
  稽核類別: 'auditCategory',
}

function normalizeHeader(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, '')
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i)
    if (ch === '"') {
      if (inQuotes && line.charAt(i + 1) === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function resolveDepartmentId(
  company: CompanyData,
  rawId: string,
  rowNum: number,
  errors: string[],
): string | null {
  const trimmed = rawId.trim()
  if (!trimmed) {
    errors.push(`第 ${rowNum} 列：缺少 departmentId`)
    return null
  }
  if (company.departments.some((d) => d.id === trimmed)) return trimmed
  const byName = company.departments.find((d) => d.name === trimmed)
  if (byName) return byName.id
  errors.push(`第 ${rowNum} 列：未知部門「${trimmed}」`)
  return null
}

export function parseSpreadsheetCsv(text: string): SpreadsheetParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return { rows: [], errors: ['CSV 至少需要標題列與一筆資料'], warnings }
  }

  const headerCells = parseCsvLine(lines[0]!)
  const columnMap = new Map<number, keyof SpreadsheetRow>()
  headerCells.forEach((cell, index) => {
    const key = HEADER_ALIASES[normalizeHeader(cell)]
    if (key) columnMap.set(index, key as keyof SpreadsheetRow)
  })

  if (![...columnMap.values()].includes('recordType' as keyof SpreadsheetRow)) {
    errors.push('CSV 缺少 recordType（或「類型」）欄位')
  }
  if (![...columnMap.values()].includes('qpCode')) {
    errors.push('CSV 缺少 qpCode（或「程序」）欄位')
  }
  if (![...columnMap.values()].includes('departmentId')) {
    errors.push('CSV 缺少 departmentId（或「部門」）欄位')
  }

  if (errors.length) return { rows: [], errors, warnings }

  const rows: SpreadsheetRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!)
    const partial: Partial<SpreadsheetRow> = {}
    columnMap.forEach((key, colIndex) => {
      const raw = cells[colIndex] ?? ''
      if (key === 'no') {
        const num = Number(raw)
        if (raw && !Number.isNaN(num)) partial.no = num
        else if (raw) warnings.push(`第 ${i + 1} 列：項次「${raw}」無效，已略過`)
      } else if (key === 'recordType') {
        const t = raw.trim().toLowerCase()
        if (t === 'checklist' || t === '查檢' || t === '查檢表') partial.recordType = 'checklist'
        else if (t === 'plan' || t === '計畫') partial.recordType = 'plan'
        else if (raw) warnings.push(`第 ${i + 1} 列：未知類型「${raw}」，已略過`)
      } else {
        ;(partial as Record<string, string>)[key] = raw
      }
    })

    if (!partial.recordType || !partial.qpCode?.trim()) continue
    rows.push({
      recordType: partial.recordType,
      qpCode: partial.qpCode.trim(),
      departmentId: partial.departmentId?.trim() ?? '',
      no: partial.no,
      content: partial.content,
      as9100Clause: partial.as9100Clause,
      sampleSize: partial.sampleSize,
      objectiveEvidence: partial.objectiveEvidence,
      auditors: partial.auditors,
      riskLevel: partial.riskLevel,
      process: partial.process,
      documents: partial.documents,
      auditCategory: partial.auditCategory,
    })
  }

  return { rows, errors, warnings }
}

function findOrCreateAudit(company: CompanyData, qpCode: string, departmentId: string) {
  const auditId = `audit-${qpCode}-${departmentId}`
  let audit = company.audits.find((a) => a.id === auditId)
  if (audit) return audit
  const dept = company.departments.find((d) => d.id === departmentId)
  const planRow = company.planRows.find(
    (r) => r.qpCode === qpCode && r.departmentId === departmentId,
  )
  audit = {
    id: auditId,
    qpCode,
    departmentId,
    department: dept?.name ?? departmentId,
    process: planRow?.process ?? qpCode,
    documents: planRow?.documents ?? qpCode,
    notifyDate: '',
    notifySent: false,
    auditDate: '',
    departmentManager: dept?.owner ?? '',
    auditors: planRow?.auditors ?? dept?.defaultAuditors ?? '',
    auditCategory: planRow?.auditCategory ?? '系統稽核',
    items: [],
  }
  company.audits.push(audit)
  return audit
}

function applyChecklistRow(
  company: CompanyData,
  row: SpreadsheetRow,
  rowNum: number,
  summary: SpreadsheetApplySummary,
): void {
  const audit = findOrCreateAudit(company, row.qpCode, row.departmentId)
  if (row.no === undefined) {
    summary.errors.push(`第 ${rowNum} 列：查檢表列缺少 no`)
    summary.skipped++
    return
  }

  let item = audit.items.find((i) => i.no === row.no)
  if (item) {
    item = patchChecklistItem(item, row)
    audit.items = audit.items.map((i) => (i.no === row.no ? item! : i))
    summary.checklistUpdated++
    return
  }

  const newItem: ChecklistItem = {
    id: `chk-import-${row.qpCode}-${row.no}-${Date.now()}`,
    category: '匯入',
    no: row.no,
    content: row.content ?? '',
    judgment: null,
    description: '',
    procedureRef: row.qpCode,
    origin: 'custom',
    ...pickChecklistFields(row),
  }
  audit.items = [...audit.items, newItem].sort((a, b) => a.no - b.no)
  summary.checklistAdded++
}

function pickChecklistFields(row: SpreadsheetRow): Partial<ChecklistItem> {
  const patch: Partial<ChecklistItem> = {}
  if (row.content !== undefined) patch.content = row.content
  if (row.as9100Clause !== undefined) patch.as9100Clause = row.as9100Clause
  if (row.sampleSize !== undefined) patch.sampleSize = row.sampleSize
  if (row.objectiveEvidence !== undefined) patch.objectiveEvidence = row.objectiveEvidence
  return patch
}

function patchChecklistItem(item: ChecklistItem, row: SpreadsheetRow): ChecklistItem {
  return { ...item, ...pickChecklistFields(row) }
}

function applyPlanRow(
  company: CompanyData,
  row: SpreadsheetRow,
  summary: SpreadsheetApplySummary,
): void {
  const planId = `plan-${row.qpCode}-${row.departmentId}`
  let planRow = company.planRows.find((r) => r.id === planId)
  if (!planRow) {
    const dept = company.departments.find((d) => d.id === row.departmentId)
    planRow = {
      id: planId,
      qpCode: row.qpCode,
      departmentId: row.departmentId,
      sequence: company.planRows.length + 1,
      riskLevel: '中',
      department: dept?.name ?? row.departmentId,
      process: row.process ?? row.qpCode,
      documents: row.documents ?? row.qpCode,
      auditUnit: dept?.auditUnit ?? '',
      owner: dept?.owner ?? '',
      auditors: dept?.defaultAuditors ?? '',
      auditCategory: '系統稽核',
      months: Array(12).fill(null),
      manualOverride: true,
    }
    company.planRows.push(planRow)
  }

  const patch: Partial<PlanRow> = { manualOverride: true }
  if (row.auditors !== undefined) patch.auditors = row.auditors
  if (row.process !== undefined) patch.process = row.process
  if (row.documents !== undefined) patch.documents = row.documents
  if (row.riskLevel && ['高', '中', '低'].includes(row.riskLevel)) {
    patch.riskLevel = row.riskLevel
  }
  if (
    row.auditCategory &&
    (AUDIT_CATEGORIES as readonly string[]).includes(row.auditCategory)
  ) {
    patch.auditCategory = row.auditCategory as PlanRow['auditCategory']
  }

  Object.assign(planRow, patch)
  summary.planUpdated++
}

export function applySpreadsheetImport(
  state: AppState,
  companyId: CompanyId,
  rows: SpreadsheetRow[],
): { state: AppState; summary: SpreadsheetApplySummary } {
  const company = structuredClone(state.companies[companyId])
  const summary: SpreadsheetApplySummary = {
    checklistUpdated: 0,
    checklistAdded: 0,
    planUpdated: 0,
    skipped: 0,
    errors: [],
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2
    const deptId = resolveDepartmentId(company, row.departmentId, rowNum, summary.errors)
    if (!deptId) {
      summary.skipped++
      return
    }
    row.departmentId = deptId

    if (row.recordType === 'checklist') {
      applyChecklistRow(company, row, rowNum, summary)
    } else if (row.recordType === 'plan') {
      applyPlanRow(company, row, summary)
    } else {
      summary.skipped++
    }
  })

  return {
    state: {
      ...state,
      companies: { ...state.companies, [companyId]: company },
      dataSource: 'user',
    },
    summary,
  }
}

export function summarizeSpreadsheetImport(summary: SpreadsheetApplySummary): string {
  return [
    `查檢更新 ${summary.checklistUpdated}、新增 ${summary.checklistAdded}`,
    `計畫更新 ${summary.planUpdated}`,
    summary.skipped ? `略過 ${summary.skipped}` : '',
    summary.errors.length ? `錯誤 ${summary.errors.length}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
