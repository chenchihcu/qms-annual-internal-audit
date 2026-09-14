import type { AuditSettings, CompanyData, ProcedureAudit, StakeholderTag } from '../types'

const PRINT_BODY_CLASS = 'printing-qr-form'

export interface PrintHeaderMeta {
  subtitle: string
  detailLines: string[]
}

/** QR-28-01 列印標頭（與 Excel/PDF 匯出標頭一致） */
export function buildQr2801PrintHeaderMeta(
  settings: AuditSettings,
  company: CompanyData,
  filter?: { tag: StakeholderTag; visible: number; total: number } | null,
): PrintHeaderMeta {
  const detailLines: string[] = []
  if (company.keyCustomerName?.trim()) {
    detailLines.push(`主要客戶：${company.keyCustomerName.trim()}`)
  }
  detailLines.push(`計畫窗口：${settings.planWindowStart} ～ ${settings.planWindowEnd}`)
  if (filter) {
    detailLines.push(`篩選：${filter.tag} · 顯示 ${filter.visible}／${filter.total} 列`)
  }
  return {
    subtitle: `主任稽核員：${settings.leadAuditor}`,
    detailLines,
  }
}

/** QR-28-02 列印標頭；計畫月份必須反映月格點擊帶入的值 */
export function buildQr2802PrintHeaderMeta(
  audit: ProcedureAudit,
  company: CompanyData,
  getProcedureTitle: (qpCode: string, department: string) => string,
): PrintHeaderMeta {
  const detailLines: string[] = []
  if (company.keyCustomerName?.trim()) {
    detailLines.push(`主要客戶：${company.keyCustomerName.trim()}`)
  }
  if (audit.plannedMonth && audit.plannedMonth >= 1 && audit.plannedMonth <= 12) {
    detailLines.push(`計畫月份：${audit.plannedMonth} 月`)
  }
  return {
    subtitle: `${audit.qpCode} ${getProcedureTitle(audit.qpCode, audit.department)} · ${audit.auditCategory}`,
    detailLines,
  }
}

/** 觸發 QR 表單列印（僅 .print-area 內容可見） */
export function triggerFormPrint(): void {
  document.body.classList.add(PRINT_BODY_CLASS)
  const cleanup = () => {
    document.body.classList.remove(PRINT_BODY_CLASS)
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}
