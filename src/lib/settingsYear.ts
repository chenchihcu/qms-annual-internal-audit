import { createDefaultPrepState } from './externalAuditPrep'
import { createDefaultExternalAuditSchedule } from './externalAuditSchedule'
import type { AppState } from '../types'

export function applyAuditYearChange(
  state: AppState,
  newYear: number,
  resetExternalPrep: boolean,
): AppState {
  const settings = { ...state.settings, auditYear: newYear }
  let externalAuditPrep = state.externalAuditPrep
  let externalAuditSchedule = state.externalAuditSchedule
  if (newYear !== state.externalAuditPrep.year) {
    externalAuditPrep = resetExternalPrep
      ? createDefaultPrepState(newYear)
      : { ...state.externalAuditPrep, year: newYear }
    if (resetExternalPrep || !externalAuditSchedule || externalAuditSchedule.year !== newYear) {
      externalAuditSchedule = createDefaultExternalAuditSchedule(
        newYear,
        settings.externalAuditDate ?? `${newYear}-09-15`,
      )
    } else {
      externalAuditSchedule = { ...externalAuditSchedule, year: newYear }
    }
  }
  return { ...state, settings, externalAuditPrep, externalAuditSchedule }
}
