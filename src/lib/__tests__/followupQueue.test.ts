import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { buildCarryForwardSummary, buildFollowupQueue, countOpenFollowups } from '../followupQueue'

describe('followupQueue', () => {
  it('merges open NCR, observations and suggestions', () => {
    const state = createDemoState()
    const rows = buildFollowupQueue(state.companies.jiurun)
    expect(rows.length).toBeGreaterThan(0)
    expect(countOpenFollowups(state.companies.jiurun)).toBe(rows.length)
    expect(rows.some((row) => row.kind === 'ncr' || row.kind === 'observation' || row.kind === 'suggestion')).toBe(true)
  })

  it('summarizes importable carry-forward without executing import', () => {
    const state = createDemoState()
    const summary = buildCarryForwardSummary(state)
    expect(summary).toMatchObject({
      importableObservations: expect.any(Number),
      importableNcrs: expect.any(Number),
      total: expect.any(Number),
    })
  })
})
