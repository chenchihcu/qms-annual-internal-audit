import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { WORKSPACE_COMPANY_ID } from '../singleWorkspaceMigration'
import { moveCompanyRecordToTrash } from '../trash'
import { resolveFollowupRecordLink } from '../followupRecordLink'

function demoState() {
  return createDemoState()
}

describe('resolveFollowupRecordLink', () => {
  it('returns found for a current-year observation on the ledger', () => {
    const state = demoState()
    const observation = state.workspace.observations[0]
    expect(observation).toBeDefined()
    const result = resolveFollowupRecordLink(state, observation.id, 'observation')
    expect(result.status).toBe('found')
  })

  it('returns trash when the record is in recycle bin', () => {
    const state = demoState()
    const observation = state.workspace.observations[0]
    const trashed = moveCompanyRecordToTrash(
      state,
      'observation',
      observation.id,
      WORKSPACE_COMPANY_ID,
      'trash-test-1',
      '2026-09-29T00:00:00.000Z',
    )
    const result = resolveFollowupRecordLink(trashed, observation.id, 'observation')
    expect(result.status).toBe('trash')
    expect(result.message).toMatch(/回收區/)
  })

  it('returns missing for an unknown id', () => {
    const state = demoState()
    const result = resolveFollowupRecordLink(state, 'missing-record-id', 'ncr')
    expect(result.status).toBe('missing')
  })
})
