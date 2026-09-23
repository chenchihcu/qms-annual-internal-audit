import type { InternalAuditCategory } from '../types'
import seed from './checklists.seed.json'
import type { RawSeedProcedure } from './seedImport'

export interface ProcedurePlanEntry {
  qpCode: string
  departmentId: string
  departmentName: string
  process: string
  documents: string
  auditCategory: InternalAuditCategory
  owner: string
  riskLevel?: '高' | '中' | '低'
  sheet?: string
}

const DEPT_ID: Record<string, string> = {
  品保部: 'dept-qa',
  管理部: 'dept-admin',
  生產製造部: 'dept-prod',
  業務部: 'dept-sales',
  開發工程: 'dept-eng',
  開發工程部: 'dept-eng',
  管理代表: 'dept-mr',
}

type FocusRow = {
  sheet: string
  riskLevel: string
  department: string
  owner: string
  itemCountHint: string
}

const focusBySheet = new Map(
  ((seed as { focusLegend?: FocusRow[] }).focusLegend ?? []).map((f) => [f.sheet, f]),
)

function deptId(name: string): string {
  return DEPT_ID[name] ?? `dept-${name}`
}

function categoryFor(code: string): InternalAuditCategory {
  if (code === 'QR-28-04') return '製程稽核'
  if (code === 'QR-28-05') return '型態稽核'
  return '系統稽核'
}

export function buildProcedurePlanTemplate(): ProcedurePlanEntry[] {
  const raw = (seed as { proceduresRaw: RawSeedProcedure[] }).proceduresRaw ?? []
  const entries: ProcedurePlanEntry[] = raw.map((p) => {
    const focus = focusBySheet.get(p.sheet)
    return {
      qpCode: p.procedureCode,
      departmentId: deptId(p.department),
      departmentName: p.department,
      process: p.procedureName,
      documents: p.procedureCode,
      auditCategory: categoryFor(p.procedureCode),
      owner: focus?.owner ?? p.supervisor?.split('.').pop() ?? p.supervisor ?? '',
      riskLevel: (focus?.riskLevel as '高' | '中' | '低') ?? '低',
      sheet: p.sheet,
    }
  })

  entries.push({
    qpCode: 'QR-28-04',
    departmentId: 'dept-prod',
    departmentName: '生產製造部',
    process: '製程稽核查檢表',
    documents: 'QR-28-04',
    auditCategory: '製程稽核',
    owner: '陳志嘉',
    riskLevel: '中',
    sheet: 'QR-28-04',
  })
  entries.push({
    qpCode: 'QR-28-05',
    departmentId: 'dept-qa',
    departmentName: '品保部',
    process: '型態稽核查檢表',
    documents: 'QR-28-05',
    auditCategory: '型態稽核',
    owner: '陳智富',
    riskLevel: '低',
    sheet: 'QR-28-05',
  })

  return entries
}

export const PROCEDURE_PLAN_TEMPLATE = buildProcedurePlanTemplate()
