import { autoCarryForwardCompany } from './carryForward'
import { createDefaultPrepState, ensurePrepItems } from './externalAuditPrep'
import type { AppState } from '../types'

export function applyAuditYearChange(
  state: AppState,
  newYear: number,
  resetExternalPrep: boolean,
): AppState {
  const settings = { ...state.settings, auditYear: newYear }
  let externalAuditPrep = state.externalAuditPrep
  if (newYear !== state.externalAuditPrep.year) {
    externalAuditPrep = resetExternalPrep
      ? createDefaultPrepState(newYear)
      : ensurePrepItems({ ...state.externalAuditPrep, year: newYear })
  }

  const company = autoCarryForwardCompany(state.company, newYear)

  return { ...state, settings, externalAuditPrep, company }
}
