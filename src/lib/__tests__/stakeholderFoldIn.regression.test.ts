import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { calculateDepartmentPriority } from '../planner'
import { buildRegeneratedPlanRows } from '../planRegeneration'
import baseline from './fixtures/stakeholderFoldInBaseline.json'

/** 基準擷取自 master b79dc6f（利害關係人頁併入年度計畫前）；排程順序不得移動。 */
function snapshot(state = createDemoState()) {
  return {
    priorities: Object.fromEntries(state.workspace.departments.map((d) => [d.id, calculateDepartmentPriority(d)])),
    rows: buildRegeneratedPlanRows(state).map((row) => [row.id, row.sequence, row.riskLevel, row.months]),
  }
}

describe('stakeholders page fold-in keeps the schedule unchanged', () => {
  it('matches the pre-change department priorities for demo data', () => {
    expect(snapshot().priorities).toEqual(baseline.priorities)
  })

  it('matches the pre-change auto-arranged plan for demo data', () => {
    expect(snapshot().rows).toEqual(baseline.rows)
  })

  it('returns to the same plan after a tag is toggled off and back on', () => {
    const state = createDemoState()
    const dept = state.workspace.departments[0]
    const original = [...dept.stakeholders]
    dept.stakeholders = original.slice(1)
    expect(snapshot(state).priorities[dept.id]).not.toBe(baseline.priorities[dept.id as keyof typeof baseline.priorities])
    dept.stakeholders = [...original.slice(1), original[0]]
    expect(snapshot(state)).toEqual({ priorities: baseline.priorities, rows: baseline.rows })
  })
})
