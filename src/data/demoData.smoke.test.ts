import { describe, it, expect } from 'vitest'
import { createDemoState } from './demoData'

describe('createDemoState', () => {
  it('creates v6 merged company with plan and audits', () => {
    const state = createDemoState()
    expect(state.version).toBe(6)
    expect(state.company.name).toContain('九潤')
    expect(state.company.planRows.length).toBeGreaterThan(0)
    for (const audit of state.company.audits) {
      expect(audit.items.length).toBeGreaterThan(0)
    }
  })
})
