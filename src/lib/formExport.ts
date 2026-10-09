import { EXTERNAL_AUDIT_PREP_SEED, prepItemCompleted, workspacePrepText } from './externalAuditPrep'
import { prepLinkedAudits } from './prepLinks'
import { downloadBlob, safeFilename } from './download'
import { appendSheet, createSheet, createWorkbook, writeWorkbook as encodeWorkbook, type SpreadsheetSheet, type SpreadsheetWorkbook } from './simpleXlsx'
import { calculateProcedurePriority, inherentScaleFromSeed } from './risk'
import { formatQualificationScopeSummary, PERSONNEL_ROLE_LABELS, personRoles, qualificationState } from './personnel'
import type {
  AppState,
  AuditSettings,
  CompanyAuditProfile,
  CompanyData,
  CompanyId,
  ExternalAuditPrepItemState,
  ProcedureAudit,
} from '../types'
import { COMPANY_LABELS, companySettingsFor } from '../types'
import { ncrCompanyScopeLabel } from './certificateScope'
import { ncrNumberLabels } from './ncr'

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']

function monthLabel(status: string | null | undefined): string {
  if (!status || typeof status !== 'string') return ''
  return status
}

function companyLabel(state: AppState, companyId: CompanyId): string {
  return state.workspace.name || COMPANY_LABELS[companyId]
}

function writeWorkbook(wb: SpreadsheetWorkbook, filename: string): void {
  const buf = encodeWorkbook(wb)
  downloadBlob(
    new Blob([buf.buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  )
}

function sheetName(base: string): string {
  return base.slice(0, 31)
}

function uniqueSheetName(wb: SpreadsheetWorkbook, base: string): string {
  const clean = sheetName(base)
  if (!wb.SheetNames.includes(clean)) return clean
  let index = 2
  while (wb.SheetNames.includes(sheetName(`${clean.slice(0, 27)}_${index}`))) index++
  return sheetName(`${clean.slice(0, 27)}_${index}`)
}

/** QR-28-01 年度計畫 */
export function buildAnnualPlanSheet(co: CompanyData, settings: AuditSettings): SpreadsheetSheet {
  const header = [
    '項次',
    '風險',
    'QP',
    '被稽核部門',
    '稽核流程',
    '對應文件',
    '負責人',
    '類型',
    '稽核人員',
    ...MONTHS,
  ]
  const title = [[`${settings.auditYear} 年度內部稽核計畫 QR-28-01 · 主任稽核員：${settings.leadAuditor}`]]
  const rows = co.planRows.map((row) => [
    row.sequence,
    row.riskLevel,
    row.qpCode,
    row.department,
    row.process,
    row.documents,
    row.owner,
    row.auditCategory,
    row.auditors,
    ...row.months.map((m) => monthLabel(m)),
  ])
  return createSheet([...title, [], header, ...rows])
}

export function exportAnnualPlanExcel(state: AppState, companyId: CompanyId): void {
  const co = state.workspace
  const wb = createWorkbook()
  appendSheet(wb, buildAnnualPlanSheet(co, companySettingsFor(state, companyId)), sheetName('QR-28-01'))
  const fn = safeFilename([
    'QR-28-01_年度計畫',
    companyLabel(state, companyId),
    String(companySettingsFor(state, companyId).auditYear),
  ]) + '.xlsx'
  writeWorkbook(wb, fn)
}

/** QR-28-02 程序查檢表 — single audit */
export function buildAuditSheet(audit: ProcedureAudit, companyName: string): SpreadsheetSheet {
  const teamRows = audit.teamSnapshot?.members.map((member) => [
    member.role === 'lead' ? '主任稽核員' : member.role === 'auditor' ? '稽核員' : '陪稽／協調',
    member.name,
    member.affiliation,
    member.qualificationReference,
    member.qualificationScope ?? '',
    member.appointmentReference ?? '',
  ]) ?? []
  const meta = [
    [`${companyName} · 內部稽核查檢表 QR-28-02`],
    [`${audit.qpCode} · ${audit.process} · ${audit.auditCategory}`],
    ['事件 ID', audit.id, '年度／狀態', `${audit.year ?? ''}／${audit.status ?? '規劃中'}`],
    ['適用標準快照', audit.standardSnapshot?.join('、') ?? '', '程序代碼／版本快照', [audit.procedureCodeSnapshot, audit.procedureVersion].filter(Boolean).join('／')],
    ['正式紀錄保存位置快照', audit.formalRecordLocationSnapshot ?? '', '快照狀態', audit.status === '規劃中' ? '尚未開始稽核' : '稽核開始時已固定'],
    ['團隊快照時間', audit.teamSnapshot?.capturedAt ?? '', '正式回報編號', audit.reportReference ?? ''],
    [],
    ['被稽核部門', audit.department, '稽核流程 (QP)', `${audit.qpCode} ${audit.process}`],
    ['對應文件', audit.documents, '通知日期', audit.notifyDate],
    ['實施日期', audit.auditDate, '被稽核部門主管', audit.departmentManager],
    ['稽核人員', audit.auditors, '', ''],
    [],
    ['團隊角色', '姓名', '所屬', '資格依據', '資格範圍', '任命依據'],
    ...teamRows,
    [],
    ['項目', 'NO', '稽核內容', '判定', '內容說明'],
    ...audit.items.map((item) => [
      item.category,
      item.no,
      item.content,
      item.judgment ?? '',
      item.description,
    ]),
  ]
  return createSheet(meta)
}

export function exportAuditExcel(
  state: AppState,
  companyId: CompanyId,
  audit: ProcedureAudit,
): void {
  const wb = createWorkbook()
  const name = sheetName(`${audit.qpCode}_${audit.department}`)
  appendSheet(
    wb,
    buildAuditSheet(audit, companyLabel(state, companyId)),
    name,
  )
  const fn = safeFilename([
    'QR-28-02_程序查檢表',
    companyLabel(state, companyId),
    audit.qpCode,
    audit.department,
  ]) + '.xlsx'
  writeWorkbook(wb, fn)
}

export function exportAllAuditsExcel(state: AppState, companyId: CompanyId): void {
  const co = state.workspace
  const wb = createWorkbook()
  const label = companyLabel(state, companyId)
  for (const audit of co.audits) {
    appendSheet(
      wb,
      buildAuditSheet(audit, label),
      uniqueSheetName(wb, `${audit.qpCode}_${audit.department}_${audit.auditDate || audit.plannedDate || audit.id.slice(-6)}`),
    )
  }
  if (co.audits.length === 0) {
    appendSheet(wb, createSheet([['（無程序查檢表資料）']]), '空白')
  }
  const fn = safeFilename([
    'QR-28-02_全部程序查檢表',
    label,
    String(companySettingsFor(state, companyId).auditYear),
  ]) + '.xlsx'
  writeWorkbook(wb, fn)
}

/** QR-28-03 不符合事項 */
export function buildNcrSheet(co: CompanyData, settings: AuditSettings): SpreadsheetSheet {
  const title = [[`${co.name} · ${settings.auditYear} 不符合事項清單 QR-28-03`]]
  const header = ['NCR#', '來源事件', 'QP', '部門', '公司', '流程', '要求快照', '證據快照', '發現快照', '日期', '狀態', '矯正措施', '效果確認', '確認人', '確認日']
  const ncrLabels = ncrNumberLabels(co.ncrs)
  const rows = co.ncrs.map((ncr) => [
    ncrLabels.get(ncr.id) ?? ncr.ncrNumber,
    ncr.sourceAuditId ?? '',
    ncr.qpCode,
    ncr.department,
    ncrCompanyScopeLabel(ncr.companyScope),
    ncr.process,
    ncr.requirementSnapshot ?? '',
    ncr.evidenceSnapshot ?? '',
    ncr.findingSnapshot ?? ncr.description,
    ncr.date,
    ncr.status,
    ncr.correctiveActionReference ?? '',
    ncr.effectivenessReference ?? '',
    ncr.effectivenessVerifiedBy ?? '',
    ncr.effectivenessVerifiedAt ?? '',
  ])
  return createSheet([...title, [], header, ...rows])
}

export function exportNcrExcel(state: AppState, companyId: CompanyId): void {
  const co = state.workspace
  const wb = createWorkbook()
  appendSheet(wb, buildNcrSheet(co, companySettingsFor(state, companyId)), sheetName('QR-28-03'))
  const fn = safeFilename([
    'QR-28-03_不符合事項',
    companyLabel(state, companyId),
    String(companySettingsFor(state, companyId).auditYear),
  ]) + '.xlsx'
  writeWorkbook(wb, fn)
}

/** 建議追蹤（optional sheet） */
export function buildSuggestionsSheet(co: CompanyData): SpreadsheetSheet {
  const header = ['年度', '程序', '問題描述', '進度', '負責單位', '狀態']
  const rows = co.suggestions.map((s) => [
    s.year,
    s.procedure,
    s.issue,
    s.progress,
    s.responsibleUnit,
    s.status === 'open' ? '待追蹤' : '已結案',
  ])
  return createSheet([['第三方稽核建議事項一覽表'], [], header, ...rows])
}

export function buildRiskSheet(co: CompanyData): SpreadsheetSheet {
  const legend = [
    '對照：NCR 0/1/2/3/≥4件→1–5；客訴／變更 無／中／高→1/3/5；距上次 ＜6/6–11/12–17/18–23/≥24月→1–5；固有 低／中／高→1/3/5；空白暫估3',
  ]
  const header = ['QP', '部門', '固有風險', '上次內稽NCR', '上次第三方NCR', '未結NCR', '客戶抱怨', '重大變更', '距上次稽核', '優先分數', '等級', '暫定', '證據']
  const rows = co.planRows.map((plan) => {
    const saved = co.procedureRisks?.find((item) => item.qpCode === plan.qpCode && item.departmentId === plan.departmentId)
    const values = {
      inherentRisk: saved?.inherentRisk ?? inherentScaleFromSeed(plan.riskLevel),
      previousInternalNcrCount: saved?.previousInternalNcrCount,
      previousThirdPartyNcrCount: saved?.previousThirdPartyNcrCount,
      overdueOpenNcrCount: saved?.overdueOpenNcrCount,
      customerComplaintLevel: saved?.customerComplaintLevel,
      changeImpact: saved?.changeImpact,
      monthsSinceLastAudit: saved?.monthsSinceLastAudit,
    }
    const result = calculateProcedurePriority(values)
    return [
      plan.qpCode,
      plan.department,
      values.inherentRisk,
      values.previousInternalNcrCount ?? '',
      values.previousThirdPartyNcrCount ?? '',
      values.overdueOpenNcrCount ?? '',
      values.customerComplaintLevel ?? '',
      values.changeImpact ?? '',
      values.monthsSinceLastAudit ?? '',
      result.score,
      result.level,
      result.provisional ? '是' : '否',
      saved?.evidenceReference ?? '',
    ]
  })
  return createSheet([['方案風險與優先順序 QR-02-01'], legend, [], header, ...rows])
}

export function buildPersonnelSheet(state: AppState, companyId: CompanyId): SpreadsheetSheet {
  const headers = ['姓名', '編號', '類型', '所屬單位', '責任單位', '角色', '狀態', '適用範圍', '有效日期']
  const today = new Date().toISOString().slice(0, 10)
  const auditYear = companySettingsFor(state, companyId).auditYear
  const rows = state.people.filter((person) => person.active).map((person) => {
    const roles = personRoles(person, auditYear, state.annualPersonnelAssignments)
    const qualStates = person.qualifications.map((item) => qualificationState(item, today))
    const status = qualStates.includes('effective') ? '有效' : qualStates[0] ?? '待確認'
    return [
      person.name,
      person.employeeNumber,
      person.type === 'internal' ? '內部' : '外部',
      person.affiliations.map((a) => a.externalOrganization || (person.type === 'internal' ? '公司內部' : '')).filter(Boolean).join('、'),
      person.affiliations.map((a) => a.departmentId).filter(Boolean).join('、'),
      roles.map((role) => PERSONNEL_ROLE_LABELS[role]).join('、'),
      status,
      person.qualifications.map((q) => formatQualificationScopeSummary(q)).join('；'),
      person.qualifications.map((q) => `${q.effectiveFrom || '待確認'}～${q.validityMode === 'no_expiry' ? '正式依據未訂期限' : q.effectiveTo || '待確認'}`).join('；'),
    ]
  })
  return createSheet([[`${auditYear} 年人員合格名單`], [], headers, ...rows])
}

export function buildStandardSheet(profile: CompanyAuditProfile, companyName: string): SpreadsheetSheet {
  const header = ['標準', '版本', '適用性', '適用依據引用']
  const rows = profile.applicableStandards.map((standard) => [
    standard.name,
    standard.version,
    standard.confirmationStatus === 'confirmed' ? '已確認' : '待確認',
    standard.evidenceReference,
  ])
  return createSheet([
    [`${companyName} · 適用標準與證書`],
    [],
    header,
    ...rows,
    [],
    ['共用管理系統認證證書'],
    ['證書範圍', profile.certificateScope, '證書編號／引用', profile.certificateReference],
  ])
}

export function exportPersonnelExcel(state: AppState, companyId: CompanyId): void {
  const wb = createWorkbook()
  appendSheet(wb, buildPersonnelSheet(state, companyId), sheetName('人員合格名單'))
  writeWorkbook(
    wb,
    safeFilename(['人員合格名單', companyLabel(state, companyId), String(companySettingsFor(state, companyId).auditYear)]) + '.xlsx',
  )
}

export function exportRiskExcel(state: AppState, companyId: CompanyId): void {
  const co = state.workspace
  const wb = createWorkbook()
  appendSheet(wb, buildRiskSheet(co), sheetName('QR-02-01'))
  writeWorkbook(wb, safeFilename(['QR-02-01_方案風險', companyLabel(state, companyId), String(companySettingsFor(state, companyId).auditYear)]) + '.xlsx')
}

export function exportObservationsExcel(state: AppState, companyId: CompanyId): void {
  const co = state.workspace
  const wb = createWorkbook()
  appendSheet(wb, buildObservationsSheet(co), sheetName('觀察事項'))
  writeWorkbook(wb, safeFilename(['觀察事項台帳', companyLabel(state, companyId), String(companySettingsFor(state, companyId).auditYear)]) + '.xlsx')
}

export function exportSuggestionsExcel(state: AppState, companyId: CompanyId): void {
  const co = state.workspace
  const wb = createWorkbook()
  appendSheet(wb, buildSuggestionsSheet(co), sheetName('建議追蹤'))
  writeWorkbook(wb, safeFilename(['建議追蹤', companyLabel(state, companyId), String(companySettingsFor(state, companyId).auditYear)]) + '.xlsx')
}

export function exportPrepExcel(state: AppState): void {
  const wb = createWorkbook()
  appendSheet(wb, buildPrepSheet(state), sheetName('稽核前準備'))
  writeWorkbook(wb, safeFilename(['稽核前準備', String(state.externalAuditPrep.year)]) + '.xlsx')
}

export function exportStandardExcel(state: AppState, companyId: CompanyId): void {
  const profile = state.auditProfile
  const wb = createWorkbook()
  appendSheet(wb, buildStandardSheet(profile, companyLabel(state, companyId)), sheetName('適用標準'))
  writeWorkbook(wb, safeFilename(['適用標準', companyLabel(state, companyId), String(companySettingsFor(state, companyId).auditYear)]) + '.xlsx')
}

export function buildObservationsSheet(co: CompanyData): SpreadsheetSheet {
  const header = ['ID', '年度', '來源', '來源事件／報告', '發生日', 'QP', '部門', '觀察事項', '說明', '責任人', '到期日', '狀態', '結案日', '結案證據', '追蹤時間軸']
  const rows = co.observations.map((item) => [item.id, item.year, item.sourceType === 'third_party_audit' ? '第三方稽核' : '內部稽核', item.sourceReference ?? item.sourceAuditId ?? '', item.occurrenceDate ?? '', item.qpCode, item.department, item.content, item.description, item.owner ?? '', item.dueDate ?? '', item.status, item.closedAt ?? '', item.closeEvidence ?? '', (item.followUps ?? []).map((entry) => `${entry.date}:${entry.note}`).join('；')])
  return createSheet([['觀察事項紀錄台帳'], [], header, ...rows])
}

/** 稽核前準備（optional sheet） */
export function buildPrepSheet(state: AppState): SpreadsheetSheet {
  const header = ['項次', '稽核前準備事項', '負責人', '關聯查檢', '完成', '備註']
  const statesById = new Map(state.externalAuditPrep.items.map((item) => [item.id, item]))
  const statesByNo = new Map<number, ExternalAuditPrepItemState[]>()
  for (const item of state.externalAuditPrep.items) {
    const matches = statesByNo.get(item.no) ?? []
    matches.push(item)
    statesByNo.set(item.no, matches)
  }
  const templateCountsByNo = new Map<number, number>()
  for (const template of EXTERNAL_AUDIT_PREP_SEED.items) {
    templateCountsByNo.set(template.no, (templateCountsByNo.get(template.no) ?? 0) + 1)
  }

  const rows = EXTERNAL_AUDIT_PREP_SEED.items.map((tpl, index) => {
    let item = tpl.id ? statesById.get(tpl.id) : undefined
    if (!item && templateCountsByNo.get(tpl.no) === 1) {
      const numberMatches = statesByNo.get(tpl.no) ?? []
      if (numberMatches.length === 1) item = numberMatches[0]
    }
    return [
      index + 1,
      workspacePrepText(tpl.title),
      tpl.owner,
      prepLinkedAudits(tpl, state.workspace.planRows)
        .map((link) => `${link.qpCode} ${link.department}`.trim())
        .join('、'),
      item && prepItemCompleted(state.externalAuditPrep, item) ? '是' : '',
      item?.remark ?? '',
    ]
  })
  return createSheet([
    [workspacePrepText(EXTERNAL_AUDIT_PREP_SEED.title)],
    [`年度：${state.externalAuditPrep.year}`],
    [],
    header,
    ...rows,
  ])
}

/** Combined workbook — all QR forms for the active audit workspace */
export function exportAllFormsExcel(state: AppState, companyId: CompanyId): void {
  const wb = buildAllFormsWorkbook(state, companyId)
  const fn = safeFilename([
    'QMS表單匯出',
    companyLabel(state, companyId),
    String(companySettingsFor(state, companyId).auditYear),
  ]) + '.xlsx'
  writeWorkbook(wb, fn)
}

export function buildAllFormsWorkbook(state: AppState, companyId: CompanyId): SpreadsheetWorkbook {
  const co = state.workspace
  const wb = createWorkbook()
  appendSheet(wb, buildAnnualPlanSheet(co, companySettingsFor(state, companyId)), sheetName('QR-28-01'))
  for (const audit of co.audits) {
    appendSheet(
      wb,
      buildAuditSheet(audit, companyLabel(state, companyId)),
      uniqueSheetName(wb, `02_${audit.qpCode}_${audit.auditDate || audit.plannedDate || audit.id.slice(-6)}`),
    )
  }
  appendSheet(wb, buildNcrSheet(co, companySettingsFor(state, companyId)), sheetName('QR-28-03'))
  appendSheet(wb, buildRiskSheet(co), sheetName('QR-02-01'))
  appendSheet(wb, buildStandardSheet(state.auditProfile, companyLabel(state, companyId)), sheetName('適用標準'))
  appendSheet(wb, buildPersonnelSheet(state, companyId), sheetName('人員合格名單'))
  appendSheet(wb, buildObservationsSheet(co), sheetName('觀察事項'))
  appendSheet(wb, buildSuggestionsSheet(co), sheetName('建議追蹤'))
  appendSheet(wb, buildPrepSheet(state), sheetName('稽核前準備'))
  return wb
}

/** Word-friendly HTML for a single audit (opens in Word) */
export function exportAuditHtml(
  state: AppState,
  companyId: CompanyId,
  audit: ProcedureAudit,
): void {
  const companyName = companyLabel(state, companyId)
  const rows = audit.items
    .map(
      (item) =>
        `<tr><td>${esc(item.category)}</td><td>${item.no}</td><td>${esc(item.content)}</td><td>${esc(item.judgment ?? '')}</td><td>${esc(item.description)}</td></tr>`,
    )
    .join('')
  const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><title>QR-28-02 ${esc(audit.qpCode)}</title>
<style>table{border-collapse:collapse;width:100%}td,th{border:1px solid #000;padding:4px 8px;font-size:12pt}</style></head><body>
<h2 style="text-align:center">${esc(companyName)}</h2>
<h3 style="text-align:center">內部稽核查檢表 QR-28-02</h3>
<p><b>被稽核部門：</b>${esc(audit.department)} &nbsp; <b>QP：</b>${esc(audit.qpCode)} ${esc(audit.process)}</p>
<p><b>程序來源快照：</b>${esc([audit.procedureCodeSnapshot, audit.procedureVersion].filter(Boolean).join('／'))} &nbsp; <b>正式紀錄保存位置：</b>${esc(audit.formalRecordLocationSnapshot ?? '')}</p>
<p><b>對應文件：</b>${esc(audit.documents)} &nbsp; <b>通知日期：</b>${esc(audit.notifyDate)} &nbsp; <b>實施日期：</b>${esc(audit.auditDate)}</p>
<p><b>主管：</b>${esc(audit.departmentManager)} &nbsp; <b>稽核人員：</b>${esc(audit.auditors)}</p>
<table><thead><tr><th>項目</th><th>NO</th><th>稽核內容</th><th>判定</th><th>內容說明</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`
  const fn = safeFilename([
    'QR-28-02_程序查檢表',
    companyName,
    audit.qpCode,
    audit.department,
  ]) + '.html'
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), fn)
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Print-ready HTML for annual plan */
export function exportAnnualPlanHtml(state: AppState, companyId: CompanyId): void {
  const co = state.workspace
  const settings = companySettingsFor(state, companyId)
  const monthHeaders = MONTHS.map((m) => `<th>${m}</th>`).join('')
  const body = co.planRows
    .map(
      (row) =>
        `<tr><td>${row.sequence}</td><td>${row.riskLevel}</td><td>${row.qpCode}</td><td>${esc(row.department)}</td><td>${esc(row.process)}</td><td>${esc(row.documents)}</td><td>${esc(row.owner)}</td><td>${esc(row.auditCategory)}</td><td>${esc(row.auditors)}</td>${row.months.map((m) => `<td>${monthLabel(m)}</td>`).join('')}</tr>`,
    )
    .join('')
  const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><title>QR-28-01</title>
<style>table{border-collapse:collapse;font-size:10pt}td,th{border:1px solid #000;padding:2px 4px}</style></head><body>
<h2 style="text-align:center">${esc(companyLabel(state, companyId))}</h2>
<h3 style="text-align:center">${settings.auditYear} 年度內部稽核計畫 QR-28-01</h3>
<p style="text-align:center">主任稽核員：${esc(settings.leadAuditor)}</p>
<table><thead><tr><th>項次</th><th>風險</th><th>QP</th><th>被稽核部門</th><th>稽核流程</th><th>對應文件</th><th>負責人</th><th>類型</th><th>稽核人員</th>${monthHeaders}</tr></thead><tbody>${body}</tbody></table>
</body></html>`
  const fn = safeFilename([
    'QR-28-01_年度計畫',
    companyLabel(state, companyId),
    String(settings.auditYear),
  ]) + '.html'
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), fn)
}

/** Smoke helper — build workbook in memory without download */
export function buildExportWorkbookSmoke(state: AppState, companyId: CompanyId): SpreadsheetWorkbook {
  const co = state.workspace
  const wb = createWorkbook()
  appendSheet(wb, buildAnnualPlanSheet(co, companySettingsFor(state, companyId)), 'QR-28-01')
  appendSheet(wb, buildNcrSheet(co, companySettingsFor(state, companyId)), 'QR-28-03')
  return wb
}
