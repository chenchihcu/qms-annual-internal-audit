import { describe, it, expect } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { applyAuditYearChange } from '../settingsYear'

describe('applyAuditYearChange', () => {
  it('preserves external prep items when resetExternalPrep is false', () => {
    const state = createDemoState()
    state.externalAuditPrep.items[0].jiurunDone = true
    state.externalAuditPrep.items[0].remark = '已準備'

    const next = applyAuditYearChange(state, 2027, false)
    expect(next.settings.auditYear).toBe(2027)
    expect(next.externalAuditPrep.year).toBe(2027)
    expect(next.externalAuditPrep.items[0].jiurunDone).toBe(true)
    expect(next.externalAuditPrep.items[0].remark).toBe('已準備')
  })

  it('resets external prep when resetExternalPrep is true', () => {
    const state = createDemoState()
    state.externalAuditPrep.items[0].jiurunDone = true

    const next = applyAuditYearChange(state, 2027, true)
    expect(next.externalAuditPrep.year).toBe(2027)
    expect(next.externalAuditPrep.items[0].jiurunDone).toBe(false)
  })
})
