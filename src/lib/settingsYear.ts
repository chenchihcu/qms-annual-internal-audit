import { createDefaultPrepState } from './externalAuditPrep'
import type { AppState } from '../types'
import { companySettingsFor } from '../types'

export const MIN_AUDIT_YEAR = 2000
export const MAX_AUDIT_YEAR = 2100

export function parseAuditYear(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (!Number.isInteger(n) || n < MIN_AUDIT_YEAR || n > MAX_AUDIT_YEAR) return null
  return n
}

export function applyAuditYearChange(
  state: AppState,
  companyId: AppState['activeCompanyId'],
  newYear: number,
  resetExternalPrep: boolean,
): AppState {
  const current = companySettingsFor(state, companyId)
  const nextSettings = { ...current, auditYear: newYear }
  let externalAuditPrep = state.externalAuditPrep
  if (resetExternalPrep && newYear !== state.externalAuditPrep.year) {
    externalAuditPrep = createDefaultPrepState(newYear)
  }
  return {
    ...state,
    companySettings: {
      ...state.companySettings,
      [companyId]: nextSettings,
    },
    externalAuditPrep,
  }
}
