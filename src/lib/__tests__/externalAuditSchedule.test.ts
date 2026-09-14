import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { createDefaultExternalAuditSchedule, companyFocusLabel } from '../externalAuditSchedule'

describe('externalAuditSchedule', () => {
  it('seeds dual-company day schedule with product models', () => {
    const schedule = createDefaultExternalAuditSchedule(2026, '2026-09-15')
    expect(schedule.entries.length).toBeGreaterThan(0)
    expect(schedule.companyProductHighlights.jiurun).toContain('航太')
    expect(schedule.companyProductHighlights.zhenglongxing).toContain('ODM')
    expect(schedule.entries.some((e) => e.productModels !== '—')).toBe(true)
  })

  it('demo state includes external audit schedule', () => {
    const state = createDemoState()
    expect(state.externalAuditSchedule?.entries.length).toBeGreaterThan(0)
    expect(companyFocusLabel('both')).toContain('九潤')
  })
})
