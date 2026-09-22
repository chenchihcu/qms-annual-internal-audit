import { describe, expect, it } from 'vitest'
import { ALL_TABS, NAV_TABS } from '../navigation'

describe('NAV_TABS', () => {
  it('follows internal audit workflow order', () => {
    expect(ALL_TABS.map((t) => t.id)).toEqual([
      'settings',
      'risk',
      'plan',
      'audit',
      'ncr',
      'observations',
      'suggestions',
      'dashboard',
      'prep',
    ])
  })

  it('assigns distinct accent classes per tab', () => {
    const inactive = NAV_TABS.map((t) => t.inactiveClass)
    const active = NAV_TABS.map((t) => t.activeClass)
    expect(new Set(inactive).size).toBe(NAV_TABS.length)
    expect(new Set(active).size).toBe(NAV_TABS.length)
  })
})
