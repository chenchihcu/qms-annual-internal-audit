import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDemoState, STORAGE_KEY } from '../data/demoData'
import { getCompanyManagementReviewDate } from '../types'
import { projectSharedPlan } from '../lib/sharedPlan'
import { getPlannedAuditors, useAuditStore } from './useAuditStore'

beforeEach(() => localStorage.clear())

describe('雙公司稽核資料邊界', () => {
  it('同一證據引用可分別保存不同判定及 NCR', () => {
    const demo = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    const auditId = 'audit-QP-28-dept-qa'
    const itemId = demo.companies.jiurun.audits.find((audit) => audit.id === auditId)!.items[0].id

    act(() => result.current.updateChecklistItem(auditId, itemId, {
      evidenceReference: '受控紀錄/共同紀錄-01', judgment: '不符',
    }))
    expect(result.current.state.companies.jiurun.audits.find((audit) => audit.id === auditId)!.items[0])
      .toMatchObject({ evidenceReference: '受控紀錄/共同紀錄-01', judgment: '不符' })
    expect(result.current.state.companies.zhenglongxing.audits.find((audit) => audit.id === auditId)!.items[0].judgment)
      .toBe('符合')

    act(() => result.current.switchCompany('zhenglongxing'))
    const otherItemId = result.current.state.companies.zhenglongxing.audits.find((audit) => audit.id === auditId)!.items[0].id
    act(() => result.current.updateChecklistItem(auditId, otherItemId, {
      evidenceReference: '受控紀錄/共同紀錄-01', judgment: '觀察',
    }))
    const exported = JSON.parse(result.current.exportJSON())
    expect(exported.companies.jiurun.audits.find((audit: { id: string }) => audit.id === auditId).items[0])
      .toMatchObject({ evidenceReference: '受控紀錄/共同紀錄-01', judgment: '不符' })
    expect(exported.companies.zhenglongxing.audits.find((audit: { id: string }) => audit.id === auditId).items[0])
      .toMatchObject({ evidenceReference: '受控紀錄/共同紀錄-01', judgment: '觀察' })
  })

  it('同一查檢題目可各自記錄不同公司文件並經 JSON 匯出保留', () => {
    const demo = createDemoState()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    const auditId = 'audit-QP-28-dept-qa'
    const jiurunItem = demo.companies.jiurun.audits.find((audit) => audit.id === auditId)!.items[0]
    const zhenglongxingItem = demo.companies.zhenglongxing.audits.find((audit) => audit.id === auditId)!.items[0]
    act(() => result.current.updateChecklistItem(auditId, jiurunItem.id, { evidenceReference: '九潤/校正紀錄-01' }))
    act(() => result.current.switchCompany('zhenglongxing'))
    act(() => result.current.updateChecklistItem(auditId, zhenglongxingItem.id, { evidenceReference: '正隆興/校正紀錄-02' }))

    const exported = JSON.parse(result.current.exportJSON())
    expect(exported.companies.jiurun.audits.find((audit: { id: string }) => audit.id === auditId).items[0].evidenceReference)
      .toBe('九潤/校正紀錄-01')
    expect(exported.companies.zhenglongxing.audits.find((audit: { id: string }) => audit.id === auditId).items[0].evidenceReference)
      .toBe('正隆興/校正紀錄-02')
  })

  it('共用計畫指派同時供兩家公司新稽核建立快照', () => {
    const demo = createDemoState()
    const row = demo.companies.jiurun.planRows.find((plan) =>
      !demo.companies.jiurun.audits.some((audit) =>
        audit.qpCode === plan.qpCode && audit.departmentId === plan.departmentId,
      ),
    )!
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    act(() => result.current.updatePlanRow(row.id, {
      auditors: '甲、乙稽核員', owner: '共同受稽核主管', documents: '共用程序文件 QP-TEST Rev.B',
    }))
    expect(getPlannedAuditors(result.current.state.companies.jiurun, row.qpCode, row.departmentId))
      .toBe('甲、乙稽核員')
    expect(getPlannedAuditors(result.current.state.companies.zhenglongxing, row.qpCode, row.departmentId))
      .toBe('甲、乙稽核員')
    const audit = result.current.getOrCreateAudit(row.qpCode, row.departmentId)
    expect(audit.auditors).toBe('甲、乙稽核員')
    expect(audit.departmentManager).toBe('共同受稽核主管')
    expect(audit.documents).toBe('共用程序文件 QP-TEST Rev.B')
    act(() => result.current.updateAudit(audit))
    act(() => result.current.switchCompany('zhenglongxing'))
    const otherAudit = result.current.getOrCreateAudit(row.qpCode, row.departmentId)
    expect(otherAudit.auditors).toBe('甲、乙稽核員')
    expect(otherAudit.departmentManager).toBe('共同受稽核主管')
    expect(otherAudit.documents).toBe('共用程序文件 QP-TEST Rev.B')
    act(() => result.current.updatePlanRow(row.id, {
      auditors: '新團隊', documents: '共用程序文件 QP-TEST Rev.C',
    }))
    expect(result.current.state.companies.jiurun.audits.find((item) => item.id === audit.id)?.auditors)
      .toBe('甲、乙稽核員')
    expect(result.current.state.companies.jiurun.audits.find((item) => item.id === audit.id)?.documents)
      .toBe('共用程序文件 QP-TEST Rev.B')
    expect(result.current.state.companies.zhenglongxing.planRows.find((plan) => plan.id === row.id)?.documents)
      .toBe('共用程序文件 QP-TEST Rev.C')
  })

  it('跨年觀察事項帶入新表單時也只從共用計畫建立表頭', () => {
    const demo = createDemoState()
    const observation = demo.companies.jiurun.observations[0]
    const row = demo.sharedPlanRows!.find((plan) =>
      !demo.companies.jiurun.audits.some((audit) =>
        audit.qpCode === plan.qpCode && audit.departmentId === plan.departmentId,
      ),
    )!
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    act(() => result.current.updatePlanRow(row.id, {
      documents: '共用文件 QP-01 Rev.D', auditors: '共同稽核組', owner: '共同受稽核人',
    }))
    act(() => result.current.carryForwardObservation(observation.id, row.qpCode, row.departmentId))
    const audit = result.current.state.companies.jiurun.audits.find((item) =>
      item.qpCode === row.qpCode && item.departmentId === row.departmentId,
    )!
    expect(audit).toMatchObject({
      documents: '共用文件 QP-01 Rev.D', auditors: '共同稽核組', departmentManager: '共同受稽核人',
    })
    expect(audit.items.some((item) => item.carriedFromId === observation.id)).toBe(true)
    act(() => result.current.switchCompany('zhenglongxing'))
    expect(result.current.getOrCreateAudit(row.qpCode, row.departmentId).documents).toBe('共用文件 QP-01 Rev.D')
  })

  it('公司別手動 NCR 與觀察事項沿用共用計畫的程序名稱', () => {
    const demo = createDemoState()
    const row = demo.sharedPlanRows!.find((plan) => plan.qpCode === 'QP-05' && plan.departmentId === 'dept-qa')!
    const changed = projectSharedPlan(demo, demo.sharedPlanRows!.map((plan) =>
      plan.id === row.id ? { ...plan, process: '共同稽核流程修訂版' } : plan,
    ))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(changed))
    const { result } = renderHook(() => useAuditStore())
    act(() => result.current.addManualNCR({ qpCode: row.qpCode, departmentId: row.departmentId, description: '手動不符合' }))
    act(() => result.current.addObservation({ qpCode: row.qpCode, departmentId: row.departmentId, content: '手動觀察' }))
    expect(result.current.state.companies.jiurun.ncrs.at(-1)?.process).toBe('共同稽核流程修訂版')
    expect(result.current.state.companies.jiurun.observations.at(-1)?.process).toBe('共同稽核流程修訂版')
  })

  it('共用題目變更供未來兩公司使用，既有表單保留題目快照', () => {
    const demo = createDemoState()
    const row = demo.sharedPlanRows!.find((plan) =>
      !demo.companies.jiurun.audits.some((audit) => audit.qpCode === plan.qpCode && audit.departmentId === plan.departmentId),
    )!
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    const first = result.current.getOrCreateAudit(row.qpCode, row.departmentId)
    const originalContent = first.items[0].content
    act(() => result.current.updateAudit(first))
    act(() => result.current.updateSharedChecklistTemplate(row.qpCode, row.departmentId, [
      { category: first.items[0].category, no: first.items[0].no, content: '修訂後共用題目' },
      ...first.items.slice(1).map((item) => ({ category: item.category, no: item.no, content: item.content })),
    ]))
    expect(result.current.state.companies.jiurun.audits.find((audit) => audit.id === first.id)?.items[0].content)
      .toBe(originalContent)
    act(() => result.current.switchCompany('zhenglongxing'))
    const second = result.current.getOrCreateAudit(row.qpCode, row.departmentId)
    expect(second.items[0].content).toBe('修訂後共用題目')
    expect(result.current.state.sharedChecklistTemplates?.[`${row.qpCode}|${row.departmentId}`][0].content)
      .toBe('修訂後共用題目')
  })

  it('自動編排單公司適用列只取該公司風險，兩公司適用列取較高風險', () => {
    const demo = createDemoState()
    const row = demo.sharedPlanRows!.find((plan) => plan.qpCode === 'QP-05' && plan.departmentId === 'dept-qa')!
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    act(() => result.current.updatePlanScope(row.id, ['jiurun']))
    act(() => result.current.switchCompany('zhenglongxing'))
    act(() => result.current.updateDepartment('dept-qa', { riskOccurrence: 5, riskSeverity: 5 }))
    act(() => result.current.regeneratePlan())
    expect(result.current.state.sharedPlanRows?.find((plan) => plan.id === row.id)?.riskLevel).toBe('中')
    act(() => result.current.updatePlanScope(row.id, ['jiurun', 'zhenglongxing']))
    act(() => result.current.regeneratePlan())
    expect(result.current.state.sharedPlanRows?.find((plan) => plan.id === row.id)?.riskLevel).toBe('高')
  })

  it('單公司計畫列只受該公司管理審查日期限制', () => {
    const demo = createDemoState()
    const row = demo.sharedPlanRows!.find((plan) => plan.qpCode === 'QP-05' && plan.departmentId === 'dept-qa')!
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    act(() => result.current.updateSettings({
      managementReviewDates: { jiurun: '2026-04-01', zhenglongxing: '2026-12-01' },
    }))
    act(() => result.current.updatePlanScope(row.id, ['jiurun']))
    act(() => result.current.regeneratePlan())
    const early = result.current.state.sharedPlanRows!.find((plan) => plan.id === row.id)!
    expect(early.months.some(Boolean)).toBe(true)
    expect(early.months.every((status, index) => !status || index < 3)).toBe(true)

    act(() => result.current.updatePlanScope(row.id, ['zhenglongxing']))
    act(() => result.current.regeneratePlan())
    const later = result.current.state.sharedPlanRows!.find((plan) => plan.id === row.id)!
    expect(later.months.some((status, index) => Boolean(status) && index >= 3)).toBe(true)
    expect(later.months.every((status, index) => !status || index < 11)).toBe(true)
  })

  it('修改共用文件及人員不會意外鎖住排程重算', () => {
    const demo = createDemoState()
    const row = demo.sharedPlanRows!.find((plan) => plan.qpCode === 'QP-05' && plan.departmentId === 'dept-qa')!
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demo))
    const { result } = renderHook(() => useAuditStore())
    act(() => result.current.updatePlanRow(row.id, {
      documents: '修訂共用程序文件', auditors: '同一組稽核員', owner: '同一位受稽核人',
    }))
    expect(result.current.state.sharedPlanRows!.find((plan) => plan.id === row.id)?.manualOverride).toBe(false)
    act(() => result.current.updateSettings({
      managementReviewDates: { jiurun: '2026-04-01', zhenglongxing: '2026-04-01' },
    }))
    act(() => result.current.regeneratePlan())
    const updated = result.current.state.sharedPlanRows!.find((plan) => plan.id === row.id)!
    expect(updated.documents).toBe('修訂共用程序文件')
    expect(updated.auditors).toBe('同一組稽核員')
    expect(updated.owner).toBe('同一位受稽核人')
    expect(updated.months.some(Boolean)).toBe(true)
    expect(updated.months.every((status, index) => !status || index < 3)).toBe(true)
  })

  it('舊版共用管理審查日期可回退，新增公司別日期互不覆寫', () => {
    const demo = createDemoState()
    expect(getCompanyManagementReviewDate(demo.settings, 'jiurun')).toBe('2026-12-10')
    const settings = {
      ...demo.settings,
      managementReviewDates: { jiurun: '2026-10-01', zhenglongxing: '2026-11-01' },
    }
    expect(getCompanyManagementReviewDate(settings, 'jiurun')).toBe('2026-10-01')
    expect(getCompanyManagementReviewDate(settings, 'zhenglongxing')).toBe('2026-11-01')
  })
})
