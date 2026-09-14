import type { ViewRole } from '../types'
import { DEFAULT_VIEW_ROLE } from '../types'

export function resolveViewRole(role: ViewRole | undefined): ViewRole {
  return role ?? DEFAULT_VIEW_ROLE
}

export function isReadOnlyRole(role: ViewRole | undefined): boolean {
  return resolveViewRole(role) === 'alert_readonly'
}

export function canEditChecklist(role: ViewRole | undefined): boolean {
  const r = resolveViewRole(role)
  return r === 'lead_auditor' || r === 'auditee'
}

export function canEditPlan(role: ViewRole | undefined): boolean {
  return resolveViewRole(role) === 'lead_auditor'
}

export function canCloseNcr(role: ViewRole | undefined): boolean {
  return resolveViewRole(role) === 'lead_auditor'
}

export function canImportSpreadsheet(role: ViewRole | undefined): boolean {
  return resolveViewRole(role) === 'lead_auditor'
}

export function canManageAttachments(role: ViewRole | undefined): boolean {
  const r = resolveViewRole(role)
  return r === 'lead_auditor' || r === 'auditee'
}

export function canEditNcrFields(role: ViewRole | undefined): boolean {
  const r = resolveViewRole(role)
  return r === 'lead_auditor' || r === 'auditee'
}

export function canMarkAuditNotified(role: ViewRole | undefined): boolean {
  return resolveViewRole(role) === 'lead_auditor'
}

export function canAddManualNcr(role: ViewRole | undefined): boolean {
  return resolveViewRole(role) === 'lead_auditor'
}

export function canEditExternalPrep(role: ViewRole | undefined): boolean {
  return resolveViewRole(role) === 'lead_auditor'
}
