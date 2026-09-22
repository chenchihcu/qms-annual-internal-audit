import type { AppState, ScoringRules } from '../types'
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

export function previewDepartmentOwnerChange(
  state: AppState,
  departmentId: string,
  newOwner: string,
  rules: ScoringRules,
): DepartmentOwnerChangePreview | null {
  const dept = state.company.departments.find((d) => d.id === departmentId)
  if (!dept) return null

  const normalized = normalizeOwner(newOwner)
  const planRowCount = state.company.planRows.filter((r) => r.departmentId === departmentId).length

  let openAuditCount = 0
  let frozenAuditCount = 0
  for (const audit of state.company.audits) {
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
): AppState {
  const preview = previewDepartmentOwnerChange(state, departmentId, newOwner, rules)
  if (!preview || !preview.changed) return state

  const normalized = preview.newOwner
  const co = state.company

  return {
    ...state,
    company: {
      ...co,
      departments: co.departments.map((d) =>
        d.id === departmentId ? { ...d, owner: normalized } : d,
      ),
      planRows: co.planRows.map((row) =>
        row.departmentId === departmentId ? { ...row, owner: normalized } : row,
      ),
      audits: co.audits.map((audit) => {
        if (audit.departmentId !== departmentId) return audit
        if (isAuditComplete(audit, rules)) return audit
        return { ...audit, departmentManager: normalized }
      }),
    },
  }
}
