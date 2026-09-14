import { describe, expect, it } from 'vitest'
import { buildAppHash, parseAppHash } from '../navigation'

describe('parseAppHash planMonth', () => {
  it('round-trips planMonth in hash', () => {
    const hash = buildAppHash('audit', 'QP-05|dept-qa', undefined, 2)
    expect(parseAppHash(hash).planMonth).toBe(2)
    expect(parseAppHash(hash).auditKey).toBe('QP-05|dept-qa')
  })

  it('ignores invalid planMonth', () => {
    expect(parseAppHash('#tab=audit&planMonth=13').planMonth).toBeUndefined()
    expect(parseAppHash('#tab=audit&planMonth=abc').planMonth).toBeUndefined()
  })
})
