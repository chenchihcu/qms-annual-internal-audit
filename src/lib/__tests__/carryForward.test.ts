import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { auditIdForPlanRow } from '../auditorSync'
import {
  applyObservationCarryForward,
  resolveCarryForwardTarget,
} from '../carryForward'
import { findNcrForObservation } from '../ncr'

describe('resolveCarryForwardTarget', () => {
  it('maps demo observation QP-01 dept-admin to plan row dept-qa (jiurun)', () => {
    const state = createDemoState()
    const target = resolveCarryForwardTarget(
      state.companies.jiurun,
      'QP-01',
      'dept-admin',
    )
    expect(target).not.toBeNull()
    expect(target!.qpCode).toBe('QP-01')
    expect(target!.departmentId).toBe('dept-qa')
  })

  it('maps demo observation QP-22 dept-prod to plan row dept-qa (jiurun)', () => {
    const state = createDemoState()
    const target = resolveCarryForwardTarget(
      state.companies.jiurun,
      'QP-22',
      'dept-prod',
    )
    expect(target).not.toBeNull()
    expect(target!.departmentId).toBe('dept-qa')
  })

  it('resolves zhenglongxing QP-12 observation', () => {
    const state = createDemoState()
    const target = resolveCarryForwardTarget(
      state.companies.zhenglongxing,
      'QP-12',
      'dept-qa',
    )
    expect(target).not.toBeNull()
    expect(target!.qpCode).toBe('QP-12')
  })
})

describe('applyObservationCarryForward', () => {
  it('adds 跨年追蹤 checklist row and marks observation carried for jiurun', () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const obs = company.observations[0]
    const next = applyObservationCarryForward(
      company,
      obs.id,
      obs.qpCode,
      obs.departmentId,
      state.settings.auditYear,
      'chk-cf-test-1',
    )
    expect(next).not.toBeNull()

    const target = resolveCarryForwardTarget(company, obs.qpCode, obs.departmentId)!
    const auditId = auditIdForPlanRow(target.qpCode, target.departmentId)
    const audit = next!.audits.find((a) => a.id === auditId)
    expect(audit).toBeTruthy()
    const carriedItem = audit!.items.find((i) => i.id === 'chk-cf-test-1')
    expect(carriedItem?.category).toBe('跨年追蹤')
    expect(carriedItem?.content).toContain('2025年觀察事項')
    expect(carriedItem?.origin).toBe('carryforward')

    const updatedObs = next!.observations.find((o) => o.id === obs.id)
    expect(updatedObs?.carriedToYear).toBe(2026)
    expect(updatedObs?.carriedToChecklistId).toBe('chk-cf-test-1')
  })

  it('adds carry row for zhenglongxing demo observation', () => {
    const state = createDemoState()
    const company = state.companies.zhenglongxing
    const obs = company.observations[0]
    const next = applyObservationCarryForward(
      company,
      obs.id,
      obs.qpCode,
      obs.departmentId,
      state.settings.auditYear,
      'chk-cf-test-zlx',
    )
    expect(next).not.toBeNull()
    expect(next!.observations.find((o) => o.id === obs.id)?.carriedToYear).toBe(2026)
  })

  it('does not carry twice', () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const obs = company.observations[0]
    const once = applyObservationCarryForward(
      company,
      obs.id,
      obs.qpCode,
      obs.departmentId,
      state.settings.auditYear,
      'chk-cf-test-2',
    )
    const twice = applyObservationCarryForward(
      once!,
      obs.id,
      obs.qpCode,
      obs.departmentId,
      state.settings.auditYear,
      'chk-cf-test-3',
    )
    expect(twice).toBeNull()
  })
})

describe('carry-forward does not break convertObservationToNcr path', () => {
  it('findNcrForObservation still works independently', () => {
    const state = createDemoState()
    const obs = state.companies.jiurun.observations[0]
    expect(findNcrForObservation(state.companies.jiurun.ncrs, obs)).toBeUndefined()
  })
})
