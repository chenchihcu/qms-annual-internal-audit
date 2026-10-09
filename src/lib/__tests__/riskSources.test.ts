import { describe, expect, it } from 'vitest'
import {
  applyAddRiskSource,
  applyRiskSourceLinkStatus,
  applyVoidRiskSource,
  validateCoverageDraft,
  validateRiskSourceDraft,
} from '../riskSources'

const draft = {
  kind: 'major_change' as const,
  externalReference: ' ECN-2026-01 ',
  date: '2026-02-01',
  summary: '產線搬遷',
  targets: [{ qpCode: 'QP-04', departmentId: 'dept-prod' }],
}

describe('risk source register', () => {
  it('requires reference, date and at least one target; summary is optional', () => {
    expect(validateRiskSourceDraft(draft)).toEqual({})
    expect(Object.keys(validateRiskSourceDraft({ ...draft, externalReference: ' ', date: '', summary: '', targets: [] })).sort())
      .toEqual(['date', 'externalReference', 'targets'])
  })

  it('guards date range, duplicate references and targets outside the plan', () => {
    const context = {
      existing: applyAddRiskSource([], draft, 'e0', 't'),
      auditYear: 2026,
      today: '2026-03-10',
      planKeys: ['QP-04|dept-prod'],
    }
    expect(validateRiskSourceDraft(draft, context).externalReference).toContain('相同外部編號')
    const fresh = { ...draft, externalReference: 'ECN-2026-02' }
    expect(validateRiskSourceDraft(fresh, context)).toEqual({})
    expect(validateRiskSourceDraft({ ...fresh, date: '2026-03-11' }, context).date).toBe('日期不可晚於今天。')
    expect(validateRiskSourceDraft({ ...fresh, date: '2024-12-31' }, context).date).toContain('早於評估期間')
    expect(validateRiskSourceDraft({ ...fresh, targets: [{ qpCode: 'QP-99', departmentId: 'x' }] }, context).targets).toContain('不在本年度計畫列')
    const voided = { ...context, existing: applyVoidRiskSource(context.existing, 'e0', '更正', 't1') }
    expect(validateRiskSourceDraft(draft, voided)).toEqual({})
  })

  it('a clicked link counts by default; only 不適用 needs a selected reason', () => {
    const [event] = applyAddRiskSource([], draft, 'e1', 't0')
    expect(event.targets[0]).toMatchObject({ linkType: 'primary', linkStatus: 'confirmed' })
    const pendingEvent = applyAddRiskSource([], { ...draft, targets: [{ ...draft.targets[0], linkStatus: 'pending' }] }, 'e2', 't0')
    const counted = applyRiskSourceLinkStatus(pendingEvent, 'e2', 'QP-04|dept-prod', 'confirmed', '', 't1')
    expect(counted[0].targets[0]).toMatchObject({ linkStatus: 'confirmed', linkUpdatedAt: 't1' })
    expect(applyRiskSourceLinkStatus(counted, 'e2', 'QP-04|dept-prod', 'not_applicable', '其他：', 't2')).toBe(counted)
    const rejected = applyRiskSourceLinkStatus(counted, 'e2', 'QP-04|dept-prod', 'not_applicable', '調查確認非此程序責任', 't2')
    expect(rejected[0].targets[0]).toMatchObject({ linkStatus: 'not_applicable', linkReason: '調查確認非此程序責任' })
    expect(validateRiskSourceDraft({ ...draft, targets: [{ qpCode: 'QP-04', departmentId: 'dept-prod', linkStatus: 'not_applicable' }] }).targets)
      .toBe('判定不適用的關聯須選理由。')
  })

  it('guards coverage declarations', () => {
    expect(validateCoverageDraft('', '2026-03-10')).toBe('請選擇日期。')
    expect(validateCoverageDraft('2026-03-11', '2026-03-10')).toBe('日期不可晚於今天。')
    expect(validateCoverageDraft('2026-03-01', '2026-03-10')).toBeNull()
  })

  it('adds trimmed records and voids with a reason instead of deleting', () => {
    const added = applyAddRiskSource([], draft, 'e1', 't0')
    expect(added[0]).toMatchObject({ id: 'e1', externalReference: 'ECN-2026-01', createdAt: 't0' })
    expect(applyVoidRiskSource(added, 'e1', '  ', 't1')).toBe(added)
    const voided = applyVoidRiskSource(added, 'e1', '重複登錄', 't1')
    expect(voided).toHaveLength(1)
    expect(voided[0]).toMatchObject({ voidedAt: 't1', voidReason: '重複登錄' })
    expect(applyVoidRiskSource(voided, 'e1', '再次', 't2')[0].voidReason).toBe('重複登錄')
  })
})
