import { describe, expect, it } from 'vitest'
import { createDemoState } from '../../data/demoData'
import { getProcedureTitle } from '../../data/checklistLoader'
import { carryPlanDatesToAudit } from '../auditDates'
import { buildQr2801PrintHeaderMeta, buildQr2802PrintHeaderMeta } from '../printForm'

describe('buildQr2801PrintHeaderMeta', () => {
  it('includes company context, 主要客戶, and 計畫窗口 for both companies', () => {
    const state = createDemoState()
    for (const companyId of ['jiurun', 'zhenglongxing'] as const) {
      const company = {
        ...state.companies[companyId],
        keyCustomerName: companyId === 'jiurun' ? '九潤精密' : state.companies[companyId].keyCustomerName,
      }
      const settings = state.companySettings[companyId]
      const meta = buildQr2801PrintHeaderMeta(settings, company)
      expect(meta.subtitle).toContain('主任稽核員')
      expect(meta.detailLines.some((line) => line.includes('主要客戶'))).toBe(true)
      expect(meta.detailLines.some((line) => line.includes('計畫窗口'))).toBe(true)
      expect(meta.detailLines.some((line) => line.includes(settings.planWindowStart))).toBe(true)
      expect(meta.detailLines.some((line) => line.includes(settings.planWindowEnd))).toBe(true)
    }
  })

  it('adds filter line when stakeholder filter is active', () => {
    const state = createDemoState()
    const company = { ...state.companies.jiurun, keyCustomerName: '九潤精密' }
    const meta = buildQr2801PrintHeaderMeta(state.companySettings.jiurun, company, {
      tag: '客戶',
      visible: 5,
      total: 31,
    })
    expect(meta.detailLines.some((line) => line.includes('篩選：客戶'))).toBe(true)
    expect(meta.detailLines.some((line) => line.includes('5／31'))).toBe(true)
    expect(meta.detailLines.some((line) => line.includes('計畫窗口'))).toBe(true)
  })
})

describe('buildQr2802PrintHeaderMeta', () => {
  it('includes 計畫月份 from clicked plan month in print header', () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const row = company.planRows.find((r) => r.qpCode === 'QP-05' && r.departmentId === 'dept-qa')!
    const audit = company.audits.find((a) => a.qpCode === 'QP-05' && a.departmentId === 'dept-qa')!
    const carried = carryPlanDatesToAudit(
      {
        ...row,
        months: Array(12)
          .fill(null)
          .map((_, i) => (i <= 1 ? ('擬定' as const) : null)),
      },
      audit,
      state.companySettings.jiurun.auditYear,
      2,
    )
    const meta = buildQr2802PrintHeaderMeta(carried, company, getProcedureTitle)
    expect(meta.detailLines).toContain('計畫月份：2 月')
  })
})
