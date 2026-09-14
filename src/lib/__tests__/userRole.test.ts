import { describe, expect, it } from 'vitest'
import {
  canCloseNcr,
  canEditPlan,
  canImportSpreadsheet,
  isReadOnlyRole,
} from '../userRole'

describe('userRole', () => {
  it('auditee cannot close NCR or edit plan', () => {
    expect(canCloseNcr('auditee')).toBe(false)
    expect(canEditPlan('auditee')).toBe(false)
    expect(canImportSpreadsheet('auditee')).toBe(false)
  })

  it('lead auditor has full permissions', () => {
    expect(canCloseNcr('lead_auditor')).toBe(true)
    expect(canEditPlan('lead_auditor')).toBe(true)
    expect(canImportSpreadsheet('lead_auditor')).toBe(true)
  })

  it('alert readonly is read-only', () => {
    expect(isReadOnlyRole('alert_readonly')).toBe(true)
    expect(canCloseNcr('alert_readonly')).toBe(false)
    expect(canEditPlan('alert_readonly')).toBe(false)
  })
})
