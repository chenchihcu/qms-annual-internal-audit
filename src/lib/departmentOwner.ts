import type { AppState, CompanyId, ScoringRules } from '../types'
import { isAuditComplete } from './scoring'

export interface DepartmentOwnerChangePreview {
  departmentId: string
  departmentName: string
  currentOwner: string
  newOwner: string
  planRowCount: number
  openAuditCount: number
  frozenAuditCount: number
  changed: boolean
}

function normalizeOwner(owner: string): string {
  return owner.trim()
}

function companyFor(state: AppState, companyId: CompanyId = state.activeCompanyId) {
  return state.companies[companyId]
}

export function previewDepartmentOwnerChange(
  state: AppState,
  departmentId: string,
  newOwner: string,
  rules: ScoringRules,
  companyId: CompanyId = state.activeCompanyId,
): DepartmentOwnerChangePreview | null {
  const company = companyFor(state, companyId)
  const dept = company.departments.find((d) => d.id === departmentId)
  if (!dept) return null

  const normalized = normalizeOwner(newOwner)
  const planRowCount = company.planRows.filter((r) => r.departmentId === departmentId).length

  let openAuditCount = 0
  let frozenAuditCount = 0
  for (const audit of company.audits) {
    if (audit.departmentId !== departmentId) continue
    if (isAuditComplete(audit, rules)) frozenAuditCount++
    else openAuditCount++
  }

  return {
    departmentId,
    departmentName: dept.name,
    currentOwner: dept.owner,
    newOwner: normalized,
    planRowCount,
    openAuditCount,
    frozenAuditCount,
    changed: normalized !== dept.owner,
  }
}

export function formatDepartmentOwnerChangeDescription(
  preview: DepartmentOwnerChangePreview,
): string {
  const { departmentName, currentOwner, newOwner, planRowCount, openAuditCount, frozenAuditCount } =
    preview
  const fromTo =
    currentOwner === newOwner
      ? `「${departmentName}」負責人仍為「${newOwner}」`
      : `將「${departmentName}」負責人由「${currentOwner || '（空白）'}」改為「${newOwner || '（空白）'}」`
  return `${fromTo}。將同步 ${planRowCount} 筆年度計畫列、${openAuditCount} 筆未完成查檢表；已評分 ${frozenAuditCount} 筆維持原主管。`
}

export function applyDepartmentOwnerChange(
  state: AppState,
  departmentId: string,
  newOwner: string,
  rules: ScoringRules,
  companyId: CompanyId = state.activeCompanyId,
): AppState {
  const preview = previewDepartmentOwnerChange(state, departmentId, newOwner, rules, companyId)
  if (!preview || !preview.changed) return state

  const normalized = preview.newOwner
  const company = companyFor(state, companyId)

  return {
    ...state,
    companies: {
      ...state.companies,
      [companyId]: {
        ...company,
        departments: company.departments.map((d) =>
          d.id === departmentId ? { ...d, owner: normalized } : d,
        ),
        planRows: company.planRows.map((row) =>
          row.departmentId === departmentId ? { ...row, owner: normalized } : row,
        ),
        audits: company.audits.map((audit) => {
          if (audit.departmentId !== departmentId) return audit
          if (isAuditComplete(audit, rules)) return audit
          return { ...audit, departmentManager: normalized }
        }),
      },
    },
  }
}
