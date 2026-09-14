import { describe, expect, it, vi } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  buildAnnualPlanSheetAoa,
  buildChecklistSheetAoa,
  buildFormExportFilename,
  exportAnnualPlanExcel,
  exportChecklistExcel,
  exportNcrExcel,
  formatPlanFilterCount,
  isPdfBytes,
  isXlsxBytes,
  planFilterPrintSubtitle,
} from '../formExport'
import { filterPlanRowsByStakeholder } from '../stakeholderSchedule'
import { carryPlanDatesToAudit } from '../auditDates'
import { getDisplayMonthStatus } from '../planStatus'
import { getProcedureTitle } from '../../data/checklistLoader'

vi.mock('../pdfFont', () => ({
  ensurePdfChineseFont: vi.fn(async (doc: { setFont: () => void }) => {
    doc.setFont()
  }),
}))

describe('formatPlanFilterCount', () => {
  it('shows n／total for every filter state', () => {
    expect(formatPlanFilterCount(12, 31)).toBe('12／31')
    expect(formatPlanFilterCount(31, 31)).toBe('31／31')
    expect(formatPlanFilterCount(0, 31)).toBe('0／31')
  })
})

describe('filterPlanRowsByStakeholder row count', () => {
  it('matches visible count for each tag and zero-match case', () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const total = company.planRows.length

    expect(filterPlanRowsByStakeholder(company.planRows, null, company.departments)).toHaveLength(
      total,
    )
    expect(formatPlanFilterCount(total, total)).toBe(`${total}／${total}`)

    for (const tag of ['客戶', '法規/認證', '員工', '供應商', '經營層'] as const) {
      const filtered = filterPlanRowsByStakeholder(company.planRows, tag, company.departments)
      expect(formatPlanFilterCount(filtered.length, total)).toBe(`${filtered.length}／${total}`)
    }
  })

  it('returns print subtitle only when filter is active', () => {
    expect(planFilterPrintSubtitle(null, 31, 31)).toBeUndefined()
    expect(planFilterPrintSubtitle('客戶', 5, 31)).toContain('客戶')
    expect(planFilterPrintSubtitle('客戶', 5, 31)).toContain('5／31')
  })
})

describe('plan month navigation sync', () => {
  it('carryPlanDatesToAudit uses clicked month N without changing plan row status', () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const baseRow = company.planRows.find((r) => r.qpCode === 'QP-05' && r.departmentId === 'dept-qa')
    expect(baseRow).toBeTruthy()
    const row = {
      ...baseRow!,
      months: Array(12)
        .fill(null)
        .map((_, i) => (i <= 1 ? ('擬定' as const) : null)),
    }
    expect(row.months[0]).toBeTruthy()
    expect(row.months[1]).toBeTruthy()

    const beforeMonth1 = getDisplayMonthStatus(
      row,
      0,
      company.audits,
      company.ncrs,
      state.settings.auditYear,
    )
    const beforeMonth2 = getDisplayMonthStatus(
      row,
      1,
      company.audits,
      company.ncrs,
      state.settings.auditYear,
    )

    const audit = company.audits.find((a) => a.qpCode === 'QP-05' && a.departmentId === 'dept-qa')!
    const carried = carryPlanDatesToAudit(row, audit, state.settings.auditYear, 2)

    expect(carried.plannedMonth).toBe(2)
    expect(carried.notifyDate).toBe('2026-02-01')
    expect(carried.auditDate).toBe('2026-02-15')

    expect(
      getDisplayMonthStatus(row, 0, company.audits, company.ncrs, state.settings.auditYear),
    ).toBe(beforeMonth1)
    expect(
      getDisplayMonthStatus(row, 1, company.audits, company.ncrs, state.settings.auditYear),
    ).toBe(beforeMonth2)
  })

  it('works for zhenglongxing QP-05 month 2', () => {
    const state = createDemoState()
    const company = state.companies.zhenglongxing
    const row = company.planRows.find((r) => r.qpCode === 'QP-05' && r.departmentId === 'dept-qa')
    const audit = company.audits.find((a) => a.qpCode === 'QP-05' && a.departmentId === 'dept-qa')
    expect(row).toBeTruthy()
    expect(audit).toBeTruthy()
    const carried = carryPlanDatesToAudit(row!, audit!, state.settings.auditYear, 2)
    expect(carried.plannedMonth).toBe(2)
  })
})

describe('form export bytes', () => {
  it('builds filename with company, form id, and date', () => {
    expect(buildFormExportFilename('九潤精密', 'QR-28-01', '2026-09-14')).toBe(
      '九潤精密_QR-28-01_2026-09-14',
    )
  })

  it('produces xlsx bytes for annual plan, checklist, and ncr', () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const planRows = filterPlanRowsByStakeholder(company.planRows, '客戶', company.departments)
    const planXlsx = exportAnnualPlanExcel({
      settings: state.settings,
      company,
      rows: planRows,
      filterTag: '客戶',
      visibleCount: planRows.length,
      totalCount: company.planRows.length,
      getProcedureTitle,
    })
    expect(isXlsxBytes(planXlsx)).toBe(true)
    expect(buildAnnualPlanSheetAoa({
      settings: state.settings,
      company,
      rows: planRows,
      filterTag: '客戶',
      visibleCount: planRows.length,
      totalCount: company.planRows.length,
      getProcedureTitle,
    }).some((row) => row[0]?.includes('篩選'))).toBe(true)

    const audit = company.audits[0]
    const checklistXlsx = exportChecklistExcel({
      settings: state.settings,
      company,
      audit,
      getProcedureTitle,
    })
    expect(isXlsxBytes(checklistXlsx)).toBe(true)
    expect(
      buildChecklistSheetAoa({
        settings: state.settings,
        company,
        audit,
        getProcedureTitle,
      }).flat().some((cell) => String(cell).includes('QR-28-02')),
    ).toBe(true)

    const ncrXlsx = exportNcrExcel({
      settings: state.settings,
      company,
      ncrs: company.ncrs,
    })
    expect(isXlsxBytes(ncrXlsx)).toBe(true)
  })

  it('produces pdf bytes for annual plan export', async () => {
    const { exportAnnualPlanPdf } = await import('../formExport')
    const state = createDemoState()
    const company = state.companies.jiurun
    const pdf = await exportAnnualPlanPdf({
      settings: state.settings,
      company,
      rows: company.planRows,
      filterTag: null,
      visibleCount: company.planRows.length,
      totalCount: company.planRows.length,
      getProcedureTitle,
    })
    expect(isPdfBytes(pdf)).toBe(true)
  })
})
