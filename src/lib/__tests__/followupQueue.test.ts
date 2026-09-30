import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { buildCarryForwardSummary, buildFollowupQueue, countOpenFollowups, isFollowupOverdue } from '../followupQueue'

describe('followupQueue', () => {
  it('merges open NCR, observations and suggestions', () => {
    const state = createDemoState()
    const rows = buildFollowupQueue(state.workspace)
    expect(rows.length).toBeGreaterThan(0)
    expect(countOpenFollowups(state.workspace)).toBe(rows.length)
    expect(rows.some((row) => row.kind === 'ncr' || row.kind === 'observation' || row.kind === 'suggestion')).toBe(true)
  })

  it('uses an NCR due date instead of its issue date in the follow-up queue', () => {
    const company = createDemoState().workspace
    const ncr = company.ncrs.find((item) => item.status !== '結案')
    expect(ncr).toBeTruthy()
    ncr!.date = '2026-03-15'
    ncr!.dueDate = '2026-10-15'

    expect(buildFollowupQueue(company).find((row) => row.id === ncr!.id)).toMatchObject({
      kind: 'ncr',
      dueDate: '2026-10-15',
      sortKey: '2026-10-15',
    })
  })

  it('marks valid dates before today as overdue', () => {
    expect(isFollowupOverdue('2026-09-23', '2026-09-24')).toBe(true)
    expect(isFollowupOverdue('2026-09-24', '2026-09-24')).toBe(false)
    expect(isFollowupOverdue(undefined, '2026-09-24')).toBe(false)
    expect(isFollowupOverdue('2026-02-30', '2026-09-24')).toBe(false)
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
