import { describe, expect, it } from 'vitest'
import { ALL_TABS, buildAppHash, NAV_TABS, parseAppHash } from '../navigation'

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

describe('parseAppHash', () => {
  it('defaults empty hash to dashboard', () => {
    expect(parseAppHash('')).toEqual({ tab: 'dashboard' })
    expect(parseAppHash('#')).toEqual({ tab: 'dashboard' })
  })

  it('parses audit key on audit tab only', () => {
    expect(parseAppHash('#tab=audit&audit=QP-01|dept-qa')).toEqual({
      tab: 'audit',
      auditKey: 'QP-01|dept-qa',
    })
    expect(parseAppHash('#tab=ncr&audit=QP-01|dept-qa')).toEqual({ tab: 'ncr' })
  })

  it('parses observation section on observations tab only', () => {
    expect(parseAppHash('#tab=observations&section=prior')).toEqual({
      tab: 'observations',
      section: 'prior',
    })
    expect(parseAppHash('#tab=dashboard&section=prior')).toEqual({ tab: 'dashboard' })
  })
})

describe('buildAppHash', () => {
  it('includes audit and section only for relevant tabs', () => {
    expect(buildAppHash('audit', { auditKey: 'QP-02|dept-mr' })).toBe(
      '#tab=audit&audit=QP-02%7Cdept-mr',
    )
    expect(buildAppHash('observations', { section: 'current' })).toBe(
      '#tab=observations&section=current',
    )
    expect(buildAppHash('ncr', { auditKey: 'x', section: 'prior' })).toBe('#tab=ncr')
  })
})
