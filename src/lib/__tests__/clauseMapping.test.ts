import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { buildClauseIndex, filterClauseMappings } from '../clauseMapping'

describe('clauseMapping', () => {
  it('indexes demo checklist items by AS9100 clause', () => {
    const state = createDemoState()
    const index = buildClauseIndex(state)
    const clause87 = index.find((r) => r.clause === '8.7')
    expect(clause87?.checklistRefs.length).toBeGreaterThan(0)
    expect(clause87?.ncrRefs.length).toBeGreaterThan(0)
  })

  it('filters mappings by clause prefix', () => {
    const state = createDemoState()
    const index = buildClauseIndex(state)
    const filtered = filterClauseMappings(index, '8.7')
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((r) => r.clause.startsWith('8.7') || r.clause === '8.7')).toBe(true)
  })
})
