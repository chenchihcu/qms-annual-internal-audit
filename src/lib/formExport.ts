import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatAttachmentNamesForPrint } from './attachments'
import { buildQr2801PrintHeaderMeta } from './printForm'
import { ensurePdfChineseFont } from './pdfFont'
import { getDisplayMonthStatus } from './planStatus'
import type {
  AuditSettings,
  CompanyData,
  NCR,
  PlanRow,
  ProcedureAudit,
  StakeholderTag,
} from '../types'

export type FormExportId = 'QR-28-01' | 'QR-28-02' | 'QR-28-03'

export interface AnnualPlanExportContext {
  settings: AuditSettings
  company: CompanyData
  rows: PlanRow[]
  filterTag: StakeholderTag | null
  visibleCount: number
  totalCount: number
  getProcedureTitle: (qpCode: string, department: string) => string
}

export interface ChecklistExportContext {
  settings: AuditSettings
  company: CompanyData
  audit: ProcedureAudit
  getProcedureTitle: (qpCode: string, department: string) => string
}

export interface NcrExportContext {
  settings: AuditSettings
  company: CompanyData
  ncrs: NCR[]
}

function todayExportDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 檔名：公司 + 表單代號 + 日期 */
export function buildFormExportFilename(
  companyName: string,
  formId: FormExportId,
  date = todayExportDate(),
): string {
  const slug = companyName.replace(/\s+/g, '')
  return `${slug}_${formId}_${date}`
}

function triggerDownload(data: Uint8Array | ArrayBuffer, filename: string, mime: string): void {
  const bytes = data instanceof Uint8Array ? Uint8Array.from(data) : new Uint8Array(data)
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function monthStatusLabel(
  row: PlanRow,
  monthIndex: number,
  company: CompanyData,
  auditYear: number,
): string {
  const scheduled = row.months[monthIndex]
  if (!scheduled) return ''
  const status = getDisplayMonthStatus(row, monthIndex, company.audits, company.ncrs, auditYear)
  return status ?? scheduled
}

function planHeaderRows(ctx: AnnualPlanExportContext): string[][] {
  const { settings, company } = ctx
  const printMeta = buildQr2801PrintHeaderMeta(
    settings,
    company,
    ctx.filterTag
      ? { tag: ctx.filterTag, visible: ctx.visibleCount, total: ctx.totalCount }
      : null,
  )
  const rows: string[][] = [
    [company.name],
    [`${settings.auditYear} 年 · 年度內部稽核計畫 ${'QR-28-01'}`],
    [printMeta.subtitle],
    ...printMeta.detailLines.map((line) => [line]),
    [
      `外部稽核：${settings.externalAuditDate ?? '—'} · 管理審查：${settings.managementReviewDate ?? '—'}`,
    ],
  ]
  rows.push([])
  return rows
}

function planTableRows(ctx: AnnualPlanExportContext): string[][] {
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const header = [
    '項次',
    '風險',
    'QP',
    '被稽核部門',
    '稽核流程/文件',
    '負責人',
    '類型',
    '稽核人員',
    ...months,
  ]
  const body = ctx.rows.map((row) => [
    String(row.sequence),
    row.riskLevel,
    row.qpCode,
    row.department,
    `${row.process} / ${row.documents}`,
    row.owner,
    row.auditCategory,
    row.auditors,
    ...Array.from({ length: 12 }, (_, i) =>
      monthStatusLabel(row, i, ctx.company, ctx.settings.auditYear),
    ),
  ])
  return [header, ...body]
}

export function buildAnnualPlanSheetAoa(ctx: AnnualPlanExportContext): string[][] {
  return [...planHeaderRows(ctx), ...planTableRows(ctx)]
}

export function exportAnnualPlanExcel(ctx: AnnualPlanExportContext): Uint8Array {
  const aoa = buildAnnualPlanSheetAoa(ctx)
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '年度計畫')
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
}

export async function exportAnnualPlanPdf(ctx: AnnualPlanExportContext): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await ensurePdfChineseFont(doc)

  let y = 14
  for (const line of planHeaderRows(ctx)) {
    if (line.length === 0) {
      y += 4
      continue
    }
    doc.setFontSize(line === planHeaderRows(ctx)[0] ? 14 : 10)
    doc.text(line[0], 14, y)
    y += line === planHeaderRows(ctx)[0] ? 8 : 6
  }

  const table = planTableRows(ctx)
  autoTable(doc, {
    head: [table[0]],
    body: table.slice(1),
    startY: y,
    styles: { font: 'NotoSansTC', fontSize: 7 },
    headStyles: { font: 'NotoSansTC', fillColor: [241, 245, 249] },
  })

  return new Uint8Array(doc.output('arraybuffer'))
}

function checklistHeaderRows(ctx: ChecklistExportContext): string[][] {
  const { audit, company, settings } = ctx
  const title = ctx.getProcedureTitle(audit.qpCode, audit.department)
  const rows: string[][] = [
    [company.name],
    [`${settings.auditYear} 年 · 內部稽核查檢表 QR-28-02`],
    [`${audit.qpCode} ${title} · ${audit.auditCategory}`],
  ]
  if (company.keyCustomerName?.trim()) {
    rows.push([`主要客戶：${company.keyCustomerName}`])
  }
  rows.push(
    [`被稽核部門：${audit.department}`],
    [`通知日期：${audit.notifyDate} · 實施日期：${audit.auditDate}`],
    [`稽核人員：${audit.auditors}`],
  )
  if (audit.plannedMonth) {
    rows.push([`計畫月份：${audit.plannedMonth} 月`])
  }
  rows.push([])
  return rows
}

function checklistTableRows(audit: ProcedureAudit): string[][] {
  const header = [
    '項目',
    'NO',
    '稽核內容',
    '判定',
    '抽樣',
    '客觀證據',
    'AS9100',
    '內容說明',
    '附件檔名',
  ]
  const body = audit.items.map((item) => [
    item.category,
    String(item.no),
    item.content,
    item.judgment ?? '',
    item.sampleSize ?? '',
    item.objectiveEvidence ?? '',
    item.as9100Clause ?? '',
    item.description,
    formatAttachmentNamesForPrint(item.attachments),
  ])
  return [header, ...body]
}

export function buildChecklistSheetAoa(ctx: ChecklistExportContext): string[][] {
  return [...checklistHeaderRows(ctx), ...checklistTableRows(ctx.audit)]
}

export function exportChecklistExcel(ctx: ChecklistExportContext): Uint8Array {
  const aoa = buildChecklistSheetAoa(ctx)
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '查檢表')
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
}

export async function exportChecklistPdf(ctx: ChecklistExportContext): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await ensurePdfChineseFont(doc)

  let y = 14
  const headers = checklistHeaderRows(ctx)
  for (const line of headers) {
    if (line.length === 0) {
      y += 4
      continue
    }
    doc.setFontSize(line === headers[0] ? 14 : 10)
    doc.text(line[0], 14, y)
    y += line === headers[0] ? 8 : 6
  }

  const table = checklistTableRows(ctx.audit)
  autoTable(doc, {
    head: [table[0]],
    body: table.slice(1),
    startY: y,
    styles: { font: 'NotoSansTC', fontSize: 7 },
    headStyles: { font: 'NotoSansTC', fillColor: [241, 245, 249] },
  })

  return new Uint8Array(doc.output('arraybuffer'))
}

function ncrHeaderRows(ctx: NcrExportContext): string[][] {
  const { company, settings } = ctx
  const rows: string[][] = [
    [company.name],
    [`${settings.auditYear} 年 · 不符合事項清單 QR-28-03`],
  ]
  if (company.keyCustomerName?.trim()) {
    rows.push([`主要客戶：${company.keyCustomerName}`])
  }
  rows.push([])
  return rows
}

function ncrTableRows(ncrs: NCR[]): string[][] {
  const header = [
    'NCR 編號',
    '程序',
    '部門',
    '描述',
    '日期',
    '狀態',
    '分類',
    '根本原因',
    '矯正措施',
    '驗證佐證',
    '附件檔名',
  ]
  const body = ncrs.map((ncr) => [
    ncr.ncrNumber,
    ncr.qpCode,
    ncr.department,
    ncr.description,
    ncr.date,
    ncr.status,
    ncr.classification ?? '',
    ncr.rootCause,
    ncr.correctiveAction,
    ncr.verificationEvidence,
    formatAttachmentNamesForPrint(ncr.attachments),
  ])
  return [header, ...body]
}

export function buildNcrSheetAoa(ctx: NcrExportContext): string[][] {
  return [...ncrHeaderRows(ctx), ...ncrTableRows(ctx.ncrs)]
}

export function exportNcrExcel(ctx: NcrExportContext): Uint8Array {
  const aoa = buildNcrSheetAoa(ctx)
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'NCR')
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
}

export async function exportNcrPdf(ctx: NcrExportContext): Promise<Uint8Array> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await ensurePdfChineseFont(doc)

  let y = 14
  const headers = ncrHeaderRows(ctx)
  for (const line of headers) {
    if (line.length === 0) {
      y += 4
      continue
    }
    doc.setFontSize(line === headers[0] ? 14 : 10)
    doc.text(line[0], 14, y)
    y += line === headers[0] ? 8 : 6
  }

  const table = ncrTableRows(ctx.ncrs)
  autoTable(doc, {
    head: [table[0]],
    body: table.slice(1),
    startY: y,
    styles: { font: 'NotoSansTC', fontSize: 7 },
    headStyles: { font: 'NotoSansTC', fillColor: [241, 245, 249] },
  })

  return new Uint8Array(doc.output('arraybuffer'))
}

export function downloadFormExcel(data: Uint8Array, filenameBase: string): void {
  triggerDownload(data, `${filenameBase}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export function downloadFormPdf(data: Uint8Array, filenameBase: string): void {
  triggerDownload(data, `${filenameBase}.pdf`, 'application/pdf')
}

/** 供測試：xlsx 檔案魔數 */
export function isXlsxBytes(data: Uint8Array): boolean {
  return data.length > 4 && data[0] === 0x50 && data[1] === 0x4b
}

/** 供測試：PDF 檔頭 */
export function isPdfBytes(data: Uint8Array): boolean {
  return data.length > 4 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46
}

export function formatPlanFilterCount(visible: number, total: number): string {
  return `${visible}／${total}`
}

export function planFilterPrintSubtitle(
  filterTag: StakeholderTag | null,
  visible: number,
  total: number,
): string | undefined {
  if (!filterTag) return undefined
  return `篩選：${filterTag} · 顯示 ${formatPlanFilterCount(visible, total)} 列`
}
