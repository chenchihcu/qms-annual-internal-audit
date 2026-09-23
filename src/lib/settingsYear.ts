import { createDefaultPrepState } from './externalAuditPrep'
import type { AppState } from '../types'
import { companySettingsFor } from '../types'

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
