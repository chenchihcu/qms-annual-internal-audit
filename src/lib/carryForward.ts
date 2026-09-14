import { createChecklistForProcedure } from '../data/checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE, type ProcedurePlanEntry } from '../data/procedurePlan'
import type {
  ChecklistItem,
  CompanyData,
  DepartmentProfile,
  ProcedureAudit,
} from '../types'
import { auditIdForPlanRow } from './auditorSync'

export interface CarryForwardTarget {
  qpCode: string
  departmentId: string
  dept: DepartmentProfile
  entry: ProcedurePlanEntry
}

/** 依年度計畫列解析帶入查檢表的程序／部門（觀察事項的 departmentId 可能與計畫列不一致） */
export function resolveCarryForwardTarget(
  company: CompanyData,
  qpCode: string,
  departmentId: string,
): CarryForwardTarget | null {
  const planRow =
    company.planRows.find((r) => r.qpCode === qpCode && r.departmentId === departmentId) ??
    company.planRows.find((r) => r.qpCode === qpCode)

  const targetQp = planRow?.qpCode ?? qpCode
  const targetDeptId = planRow?.departmentId ?? departmentId

  const entry =
    PROCEDURE_PLAN_TEMPLATE.find(
      (e) => e.qpCode === targetQp && e.departmentId === targetDeptId,
    ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === targetQp)

  if (!entry) return null

  const resolvedDeptId = planRow?.departmentId ?? entry.departmentId
  const dept = company.departments.find((d) => d.id === resolvedDeptId)
  if (!dept) return null

  return {
    qpCode: targetQp,
    departmentId: resolvedDeptId,
    dept,
    entry,
  }
}

function ensureAuditForTarget(company: CompanyData, target: CarryForwardTarget): ProcedureAudit {
  const auditId = auditIdForPlanRow(target.qpCode, target.departmentId)
  const existing = company.audits.find((a) => a.id === auditId)
  if (existing) return existing

  return {
    id: auditId,
    qpCode: target.qpCode,
    departmentId: target.departmentId,
    department: target.dept.name,
    process: target.entry.process,
    documents: target.entry.documents,
    notifyDate: '',
    auditDate: '',
    departmentManager: target.dept.owner,
    auditors: target.dept.defaultAuditors,
    auditCategory: target.entry.auditCategory,
    items: createChecklistForProcedure(target.qpCode, target.dept.name),
  }
}

function appendItemToAudits(
  audits: ProcedureAudit[],
  audit: ProcedureAudit,
  newItem: ChecklistItem,
): ProcedureAudit[] {
  if (audits.some((a) => a.id === audit.id)) {
    return audits.map((a) =>
      a.id === audit.id ? { ...a, items: [...a.items, newItem] } : a,
    )
  }
  return [...audits, { ...audit, items: [...audit.items, newItem] }]
}

export function applyObservationCarryForward(
  company: CompanyData,
  obsId: string,
  qpCode: string,
  departmentId: string,
  auditYear: number,
  newItemId = `chk-cf-${Date.now()}`,
): CompanyData | null {
  const obs = company.observations.find((o) => o.id === obsId)
  if (!obs || obs.carriedToYear) return null

  const target = resolveCarryForwardTarget(company, qpCode, departmentId)
  if (!target) return null

  const audit = ensureAuditForTarget(company, target)
  const newItem: ChecklistItem = {
    id: newItemId,
    category: '跨年追蹤',
    no: audit.items.length + 1,
    content: `[${obs.year}年觀察事項] ${obs.content}`,
    judgment: null,
    description: obs.description,
    sourceYear: obs.year,
    carriedFromId: obs.id,
    procedureRef: target.qpCode,
    origin: 'carryforward',
  }

  const audits = appendItemToAudits(company.audits, audit, newItem)
  const observations = company.observations.map((o) =>
    o.id === obsId
      ? { ...o, carriedToYear: auditYear, carriedToChecklistId: newItemId }
      : o,
  )

  return { ...company, audits, observations }
}
