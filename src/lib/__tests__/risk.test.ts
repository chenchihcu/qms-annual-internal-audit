import { describe, it, expect } from 'vitest'
import {
  calculateRiskLevel,
  calculateRiskIndex,
  suggestRiskBump,
  clampRiskValue,
  parseRiskInputValue,
} from '../risk'

describe('calculateRiskLevel', () => {
  it('returns 低 for index 1-4', () => {
    expect(calculateRiskLevel(1, 2)).toEqual({ index: 2, level: '低' })
    expect(calculateRiskLevel(2, 2)).toEqual({ index: 4, level: '低' })
  })

  it('returns 中 for index 5-14', () => {
    expect(calculateRiskLevel(2, 3)).toEqual({ index: 6, level: '中' })
    expect(calculateRiskLevel(3, 4)).toEqual({ index: 12, level: '中' })
  })

  it('returns 高 for index 15-25', () => {
    expect(calculateRiskLevel(3, 5)).toEqual({ index: 15, level: '高' })
    expect(calculateRiskLevel(5, 5)).toEqual({ index: 25, level: '高' })
  })
})

describe('calculateRiskIndex', () => {
  it('clamps values to 1-5', () => {
    expect(calculateRiskIndex(0, 10)).toBe(5)
    expect(calculateRiskIndex(3, 3)).toBe(9)
  })
})

describe('suggestRiskBump', () => {
  it('suggests higher occurrence when NCR and score are poor', () => {
    expect(suggestRiskBump(2, 3, 50)).toBeGreaterThan(2)
  })

  it('keeps value when audit is good', () => {
    expect(suggestRiskBump(2, 0, 95)).toBe(2)
  })
})

describe('clampRiskValue', () => {
  it('clamps to valid range', () => {
    expect(clampRiskValue(0)).toBe(1)
    expect(clampRiskValue(6)).toBe(5)
  })
})

describe('parseRiskInputValue', () => {
  it('accepts integers 1-5 only', () => {
    expect(parseRiskInputValue('3')).toBe(3)
    expect(parseRiskInputValue('')).toBeNull()
    expect(parseRiskInputValue('0')).toBeNull()
    expect(parseRiskInputValue('6')).toBeNull()
    expect(parseRiskInputValue('abc')).toBeNull()
  })
})
