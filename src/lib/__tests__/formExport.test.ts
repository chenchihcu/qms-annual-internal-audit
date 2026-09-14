import { describe, expect, it, vi, afterEach } from 'vitest'
import { createDemoState } from '../../data/demoData'
import {
  buildAnnualPlanSheetAoa,
  buildChecklistSheetAoa,
  buildFormExportFilename,
  downloadFormExcel,
  downloadFormPdf,
  exportAnnualPlanExcel,
  exportAnnualPlanPdf,
  exportChecklistExcel,
  exportChecklistPdf,
  exportNcrExcel,
  exportNcrPdf,
  formatPlanFilterCount,
  isPdfBytes,
  isXlsxBytes,
  planFilterPrintSubtitle,
  triggerBlobDownload,
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

  it('produces pdf bytes for annual plan, checklist, and ncr', async () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const planPdf = await exportAnnualPlanPdf({
      settings: state.settings,
      company,
      rows: company.planRows,
      filterTag: null,
      visibleCount: company.planRows.length,
      totalCount: company.planRows.length,
      getProcedureTitle,
    })
    expect(isPdfBytes(planPdf)).toBe(true)

    const audit = company.audits[0]
    const checklistPdf = await exportChecklistPdf({
      settings: state.settings,
      company,
      audit,
      getProcedureTitle,
    })
    expect(isPdfBytes(checklistPdf)).toBe(true)

    const ncrPdf = await exportNcrPdf({
      settings: state.settings,
      company,
      ncrs: company.ncrs,
    })
    expect(isPdfBytes(ncrPdf)).toBe(true)
  })

  it('includes 計畫月份 and attachment filenames in checklist export', () => {
    const state = createDemoState()
    const company = state.companies.jiurun
    const audit = {
      ...company.audits[0],
      plannedMonth: 2,
    }
    const aoa = buildChecklistSheetAoa({
      settings: state.settings,
      company,
      audit,
      getProcedureTitle,
    })
    const flat = aoa.flat().map(String)
    expect(flat.some((cell) => cell.includes('計畫月份：2 月'))).toBe(true)
    expect(flat.some((cell) => cell.includes('附件檔名'))).toBe(true)
  })

  it('produces xlsx and pdf for zhenglongxing company', async () => {
    const state = createDemoState()
    const company = state.companies.zhenglongxing
    const ctx = {
      settings: state.settings,
      company,
      rows: company.planRows,
      filterTag: null,
      visibleCount: company.planRows.length,
      totalCount: company.planRows.length,
      getProcedureTitle,
    }
    expect(isXlsxBytes(exportAnnualPlanExcel(ctx))).toBe(true)
    expect(isPdfBytes(await exportAnnualPlanPdf(ctx))).toBe(true)
    expect(buildFormExportFilename(company.name, 'QR-28-01')).toContain('正隆興精密')
  })
})

describe('triggerBlobDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('creates blob URL and clicks download anchor', () => {
    vi.useFakeTimers()
    const click = vi.fn()
    const anchor = document.createElement('a')
    anchor.click = click
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const appendChild = vi.spyOn(document.body, 'appendChild')

    triggerBlobDownload(new Uint8Array([1, 2, 3]), '九潤精密_QR-28-01_2026-09-14.xlsx', 'application/octet-stream')

    expect(createObjectURL).toHaveBeenCalled()
    expect(appendChild).toHaveBeenCalledWith(anchor)
    expect(anchor.download).toBe('九潤精密_QR-28-01_2026-09-14.xlsx')
    expect(click).toHaveBeenCalled()

    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('throws when bytes are empty', () => {
    expect(() => triggerBlobDownload(new Uint8Array(), 'empty.xlsx', 'application/octet-stream')).toThrow(
      '匯出失敗',
    )
  })

  it('downloadFormExcel and downloadFormPdf set correct filenames on anchor', () => {
    vi.useFakeTimers()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchor = document.createElement('a')
    anchor.click = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor)

    const bytes = new Uint8Array([1, 2, 3])
    downloadFormExcel(bytes, 'test_QR-28-01_2026-09-14')
    expect(anchor.download).toBe('test_QR-28-01_2026-09-14.xlsx')

    downloadFormPdf(bytes, 'test_QR-28-02_2026-09-14')
    expect(anchor.download).toBe('test_QR-28-02_2026-09-14.pdf')
  })
})
