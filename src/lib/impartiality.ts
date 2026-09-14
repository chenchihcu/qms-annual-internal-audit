import type { DepartmentProfile, InternalAuditCategory, PlanRow, ProcedureAudit } from '../types'

export interface ImpartialityWarning {
  message: string
}

const AUDITOR_SEP = /[,、;；/\s]+/

export function parseAuditorNames(auditors: string): string[] {
  return auditors
    .split(AUDITOR_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
}

function namesMatch(a: string, b: string): boolean {
  const left = a.trim()
  const right = b.trim()
  if (!left || !right) return false
  if (left === right) return true
  return left.includes(right) || right.includes(left)
}

/** 稽核員若為某部門主管 (owner)，視為隸屬該部門 */
function auditorHomeDepartmentId(
  auditor: string,
  departments: DepartmentProfile[],
): string | undefined {
  for (const dept of departments) {
    if (namesMatch(auditor, dept.owner)) return dept.id
  }
  return undefined
}

export function checkImpartiality(input: {
  auditors: string
  departmentId: string
  department: string
  auditCategory: InternalAuditCategory
  departments: DepartmentProfile[]
}): ImpartialityWarning | null {
  const { auditors, departmentId, department, auditCategory, departments } = input
  const trimmed = auditors.trim()
  if (!trimmed) return null

  const auditedDept = departments.find((d) => d.id === departmentId)
  const auditorNames = parseAuditorNames(trimmed)

  if (auditedDept) {
    for (const name of auditorNames) {
      if (namesMatch(name, auditedDept.owner)) {
        return {
          message: `稽核人員「${name}」與被稽核部門主管「${auditedDept.owner}」相同或相近，可能存在利益衝突，請確認是否由其他單位人員稽核。`,
        }
      }
    }
  }

  if (department && trimmed.includes(department)) {
    return {
      message: `稽核人員欄位含被稽核部門「${department}」，可能存在自我稽核風險，請確認人員是否隸屬其他單位。`,
    }
  }

  if (auditCategory !== '系統稽核') {
    for (const name of auditorNames) {
      const homeDeptId = auditorHomeDepartmentId(name, departments)
      if (homeDeptId === departmentId) {
        const homeDept = departments.find((d) => d.id === homeDeptId)
        return {
          message: `稽核人員「${name}」與被稽核部門「${department}」人員重疊（${homeDept?.owner ?? '部門成員'}），非系統稽核時建議改派獨立稽核員。`,
        }
      }
    }
  }

  return null
}

export function checkPlanRowImpartiality(
  row: PlanRow,
  departments: DepartmentProfile[],
): ImpartialityWarning | null {
  return checkImpartiality({
    auditors: row.auditors,
    departmentId: row.departmentId,
    department: row.department,
    auditCategory: row.auditCategory,
    departments,
  })
}

export function checkAuditImpartiality(
  audit: ProcedureAudit,
  departments: DepartmentProfile[],
): ImpartialityWarning | null {
  return checkImpartiality({
    auditors: audit.auditors,
    departmentId: audit.departmentId,
    department: audit.department,
    auditCategory: audit.auditCategory,
    departments,
  })
}
