import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  companiesAreDifferentiated,
  isOldClonedDemo,
  shouldRefreshToCurrentDemo,
} from '../demoRefresh'

describe('demoRefresh', () => {
  it('detects differentiated current demo', () => {
    const state = createDemoState()
    expect(isOldClonedDemo(state)).toBe(false)
    expect(companiesAreDifferentiated(state)).toBe(true)
    expect(shouldRefreshToCurrentDemo({ ...state, dataSource: 'user' })).toBe(false)
    expect(shouldRefreshToCurrentDemo(state)).toBe(true)
  })

  it('detects old cloned demo layout', () => {
    const state = createDemoState()
    state.version = 6
    state.companies.zhenglongxing = JSON.parse(JSON.stringify(state.companies.jiurun))
    expect(isOldClonedDemo(state)).toBe(true)
    expect(shouldRefreshToCurrentDemo(state)).toBe(true)
  })
})
