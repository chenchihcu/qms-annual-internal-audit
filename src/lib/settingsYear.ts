import { autoCarryForwardCompany } from './carryForward'
import { createDefaultPrepState, ensurePrepItems } from './externalAuditPrep'
import type { AppState } from '../types'

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
  newYear: number,
  resetExternalPrep: boolean,
): { state: AppState; warnings: string[] } {
  const settings = { ...state.settings, auditYear: newYear }
  let externalAuditPrep = state.externalAuditPrep
  if (newYear !== state.externalAuditPrep.year) {
    externalAuditPrep = resetExternalPrep
      ? createDefaultPrepState(newYear)
      : ensurePrepItems({ ...state.externalAuditPrep, year: newYear })
  }

  const { company, warnings } = autoCarryForwardCompany(state.company, newYear)

  return {
    state: { ...state, settings, externalAuditPrep, company },
    warnings,
  }
}
