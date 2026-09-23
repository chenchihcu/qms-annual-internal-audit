import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { summarizeImportState } from '../importSummary'
import {
  canRemoveCompanyFromPlanRow,
  getLegacyPlanConflicts,
  hydrateSharedPlan,
  projectSharedPlan,
  resolveLegacyPlanConflicts,
} from '../sharedPlan'

describe('共用年度計畫與舊資料', () => {
  it('相同排程但不同執行結果可自動提升，結果分公司保留', () => {
    const old = createDemoState()
    const row = old.companies.jiurun.planRows[0]
    const scheduledMonth = row.months.findIndex(Boolean)
    old.companies.jiurun.planRows[0].months[scheduledMonth] = '不滿意'
    old.companies.zhenglongxing.planRows[0].months[scheduledMonth] = '滿意'
    delete old.sharedPlanRows

    const next = hydrateSharedPlan(old)
    expect(next.sharedPlanRows?.[0].months[scheduledMonth]).toBe('擬定')
    expect(next.companies.jiurun.planRows[0].months[scheduledMonth]).toBe('不滿意')
    expect(next.companies.zhenglongxing.planRows[0].months[scheduledMonth]).toBe('滿意')
  })

  it('舊兩份計畫有不同人員或排程時保留原值，逐列確認後備份兩側', () => {
    const old = createDemoState()
    delete old.sharedPlanRows
    const row = old.companies.jiurun.planRows[0]
    const other = old.companies.zhenglongxing.planRows[0]
    other.auditors = '正隆興舊指派'
    const newMonth = row.months.findIndex((status) => status === null)
    other.months[newMonth] = '擬定'

    const conflicts = getLegacyPlanConflicts(old)
    expect(summarizeImportState(old).planConflictCount).toBe(1)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].fields.map((field) => field.label)).toContain('稽核人員')
    expect(conflicts[0].fields.map((field) => field.label)).toContain('排程月份')
    expect(hydrateSharedPlan(old).sharedPlanRows).toBeUndefined()
    expect(old.companies.zhenglongxing.planRows[0].auditors).toBe('正隆興舊指派')

    const resolved = resolveLegacyPlanConflicts(old, { [row.id]: 'jiurun' })
    expect(resolved.sharedPlanRows?.[0].auditors).toBe(row.auditors)
    expect(resolved.companies.zhenglongxing.planRows[0].auditors).toBe(row.auditors)
    expect(resolved.legacyCompanyPlanBackup?.zhenglongxing[0].auditors).toBe('正隆興舊指派')
    expect(resolved.legacyCompanyPlanBackup?.zhenglongxing[0].months[newMonth]).toBe('擬定')
  })

  it('只在一家公司出現的舊計畫列維持單邊適用', () => {
    const old = createDemoState()
    const onlyJiurun = old.companies.jiurun.planRows[0]
    old.companies.zhenglongxing.planRows = old.companies.zhenglongxing.planRows.filter((row) => row.id !== onlyJiurun.id)
    delete old.sharedPlanRows

    const next = hydrateSharedPlan(old)
    expect(getLegacyPlanConflicts(old)).toHaveLength(0)
    expect(next.sharedPlanRows?.find((row) => row.id === onlyJiurun.id)?.applicableCompanies).toEqual(['jiurun'])
    expect(next.companies.zhenglongxing.planRows.some((row) => row.id === onlyJiurun.id)).toBe(false)
  })

  it('變更共用排程不覆寫公司結果；有稽核紀錄的公司不可從範圍移除', () => {
    const state = createDemoState()
    const audited = state.sharedPlanRows!.find((row) => row.qpCode === 'QP-28' && row.departmentId === 'dept-qa')!
    expect(canRemoveCompanyFromPlanRow(state, audited.id, 'jiurun')).toBe(false)
    const row = state.sharedPlanRows![0]
    const month = row.months.findIndex(Boolean)
    state.companies.jiurun.planRows[0].months[month] = '矯正中'
    const nextRows = state.sharedPlanRows!.map((candidate) =>
      candidate.id === row.id ? { ...candidate, months: candidate.months.map((status, index) => index === month ? null : status) } : candidate,
    )
    const next = projectSharedPlan(state, nextRows)
    expect(next.sharedPlanRows![0].months[month]).toBeNull()
    expect(next.companies.jiurun.planRows[0].months[month]).toBe('矯正中')
  })
})
