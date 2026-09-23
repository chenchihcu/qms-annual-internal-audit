import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { resolveDataSource, shouldShowDemoBanner } from '../demoMode'

describe('demoMode', () => {
  it('shows banner for fresh demo state', () => {
    const state = createDemoState()
    expect(resolveDataSource(state)).toBe('demo')
    expect(shouldShowDemoBanner(state)).toBe(true)
  })

  it('hides banner when dataSource is user', () => {
    const state = { ...createDemoState(), dataSource: 'user' as const }
    expect(shouldShowDemoBanner(state)).toBe(false)
  })

  it('keeps banner while editing demo until user dismisses or imports', () => {
    const state = createDemoState()
    state.companySettings.jiurun.leadAuditor = '正式稽核員'
    expect(shouldShowDemoBanner(state)).toBe(true)
  })
})
