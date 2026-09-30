import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { buildDashboardRiskTiles } from '../dashboardTiles'

describe('buildDashboardRiskTiles', () => {
  it('builds clickable audit keys for plan rows', () => {
    const state = createDemoState()
    const company = state.workspace
    const groups = buildDashboardRiskTiles(company, state.settings.scoringRules)
    expect(groups.length).toBeGreaterThan(0)
    const firstTile = groups[0].tiles[0]
    expect(firstTile.auditKey).toMatch(/^(QP|QR)-/)
    expect(firstTile.auditKey).toContain('|')
  })
})
