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

  it('auto carry-forwards open prior-year observations on year change', () => {
    const state = createDemoState()
    state.company.observations.push({
      id: 'obs-prior',
      year: 2025,
      qpCode: 'QP-01',
      departmentId: 'dept-admin',
      department: '管理部',
      process: 'p',
      content: '跨年觀察',
      description: '',
      status: 'open',
    })
    const next = applyAuditYearChange(state, 2027, false)
    expect(
      next.company.observations.find((o) => o.id === 'obs-prior')?.carriedToYear,
    ).toBe(2027)
    expect(
      next.company.audits.some((a) =>
        a.items.some((i) => i.content.includes('跨年觀察')),
      ),
    ).toBe(true)
  })
})
