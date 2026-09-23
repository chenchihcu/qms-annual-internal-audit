import { createChecklistForProcedure } from '../data/checklistLoader'
import { PROCEDURE_PLAN_TEMPLATE } from '../data/procedurePlan'
import { isPriorOpenNcr } from './ncr'
import type { ChecklistItem, CompanyData, Observation, NCR, ProcedureAudit } from '../types'

function carryForwardErrorMessage(qpCode: string, departmentId: string): string {
  const dept = PROCEDURE_PLAN_TEMPLATE.find(
    (e) => e.qpCode === qpCode && e.departmentId === departmentId,
  )
  const deptName =
    PROCEDURE_PLAN_TEMPLATE.find((e) => e.departmentId === departmentId)?.departmentName ??
    departmentId
  if (!dept) {
    return `找不到 ${qpCode}／${deptName} 的程序或部門，無法帶入查檢表`
  }
  return `找不到 ${qpCode}／${deptName} 的部門資料，無法帶入查檢表`
}

function findPlanEntry(qpCode: string, departmentId: string) {
  return (
    PROCEDURE_PLAN_TEMPLATE.find(
      (e) => e.qpCode === qpCode && e.departmentId === departmentId,
    ) ?? PROCEDURE_PLAN_TEMPLATE.find((e) => e.qpCode === qpCode)
  )
}

function ensureAudit(
  company: CompanyData,
  qpCode: string,
  departmentId: string,
): { audits: ProcedureAudit[]; audit: ProcedureAudit } {
  const auditId = `audit-${qpCode}-${departmentId}`
  let audit = company.audits.find((a) => a.id === auditId)
  const dept = company.departments.find((d) => d.id === departmentId)
  const entry = findPlanEntry(qpCode, departmentId)
  if (!dept || !entry) {
    throw new Error(carryForwardErrorMessage(qpCode, departmentId))
  }

  if (!audit) {
    audit = {
      id: auditId,
      qpCode,
      departmentId,
      department: dept.name,
      process: entry.process,
      documents: entry.documents,
      notifyDate: '',
      auditDate: '',
      departmentManager: dept.owner,
      auditors: dept.defaultAuditors,
      auditCategory: entry.auditCategory,
      items: createChecklistForProcedure(qpCode, dept.name),
    }
    return { audits: [...company.audits, audit], audit }
  }
  return { audits: company.audits, audit }
}

function appendChecklistItem(
  audit: ProcedureAudit,
  item: ChecklistItem,
): ProcedureAudit {
  return { ...audit, items: [...audit.items, item] }
}

export function carryForwardObservationIntoCompany(
  company: CompanyData,
  obs: Observation,
  targetYear: number,
): CompanyData {
  if (obs.carriedToYear || obs.status !== 'open') return company

  const qpCode = obs.qpCode || 'QP-01'
  const departmentId = obs.departmentId
  let { audits, audit } = ensureAudit(company, qpCode, departmentId)

  const newItemId = `chk-cf-${obs.id}-${targetYear}`
  const newItem: ChecklistItem = {
    id: newItemId,
    category: '跨年追蹤',
    no: audit.items.length + 1,
    content: `[${obs.year}年觀察事項] ${obs.content}`,
    judgment: null,
    description: obs.description,
    sourceYear: obs.year,
    carriedFromId: obs.id,
    procedureRef: qpCode,
    origin: 'carryforward',
  }

  const updatedAudit = appendChecklistItem(audit, newItem)
  audits = audits.map((a) => (a.id === audit.id ? updatedAudit : a))

  const observations = company.observations.map((o) =>
    o.id === obs.id
      ? { ...o, carriedToYear: targetYear, carriedToChecklistId: newItemId }
      : o,
  )

  return { ...company, audits, observations }
}

export function carryForwardNcrIntoCompany(
  company: CompanyData,
  ncr: NCR,
  targetYear: number,
): CompanyData {
  if (ncr.carriedToYear || ncr.status === '結案') return company

  const { audits, audit } = ensureAudit(company, ncr.qpCode, ncr.departmentId)
  const newItemId = `chk-ncr-cf-${ncr.id}-${targetYear}`
  const year = ncr.sourceYear ?? targetYear - 1
  const newItem: ChecklistItem = {
    id: newItemId,
    category: '跨年追蹤',
    no: audit.items.length + 1,
    content: `[${year}年 NCR ${ncr.ncrNumber}] ${ncr.description}`,
    judgment: null,
    description: '前年度未結案不符合追蹤',
    sourceYear: year,
    procedureRef: ncr.qpCode,
    origin: 'carryforward',
  }

  const updatedAudit = appendChecklistItem(audit, newItem)
  const updatedAudits = audits.map((a) => (a.id === audit.id ? updatedAudit : a))
  const ncrs = company.ncrs.map((n) =>
    n.id === ncr.id ? { ...n, carriedToYear: targetYear } : n,
  )

  return { ...company, audits: updatedAudits, ncrs }
}

export interface AutoCarryForwardResult {
  company: CompanyData
  warnings: string[]
}

export function autoCarryForwardCompany(
  company: CompanyData,
  targetYear: number,
): AutoCarryForwardResult {
  let next = company
  const warnings: string[] = []

  for (const obs of company.observations) {
    if (obs.status === 'open' && obs.year < targetYear && !obs.carriedToYear) {
      try {
        next = carryForwardObservationIntoCompany(next, obs, targetYear)
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : '觀察事項帶入失敗')
      }
    }
  }
  for (const ncr of next.ncrs) {
    if (isPriorOpenNcr(ncr, targetYear) && !ncr.carriedToYear) {
      try {
        next = carryForwardNcrIntoCompany(next, ncr, targetYear)
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : 'NCR 帶入失敗')
      }
    }
  }
  return { company: next, warnings }
}
