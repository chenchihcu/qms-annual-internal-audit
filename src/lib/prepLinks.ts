import type { AppState, PlanRow } from '../types'
import { buildMergedCertificateCoverage } from './coverage'
import {
  EXTERNAL_AUDIT_PREP_SEED,
  MANAGEMENT_REVIEW_PREP_ITEM_ID,
  effectiveExternalAuditDate,
  evaluatePrepSequence,
  getManagementReviewCompletionBlockers,
  type PrepTemplateItem,
} from './externalAuditPrep'
import { WORKSPACE_COMPANY_ID } from './singleWorkspaceMigration'

/** 準備事項 → 年度計畫列（查檢表 `QP|部門`）的讀取關聯；不寫入任何一方。 */
export interface PrepAuditLink {
  qpCode: string
  /** 計畫中找到的列；找不到時為 undefined（計畫列可能被使用者移除）。 */
  departmentId?: string
  department: string
  auditKey?: string
}

function normalizeDepartment(name: string): string {
  return name.trim().replace(/部$/, '')
}

export function prepLinkedAudits(template: PrepTemplateItem, planRows: PlanRow[]): PrepAuditLink[] {
  const links: PrepAuditLink[] = []
  for (const link of template.linkedQp ?? []) {
    const rows = planRows.filter((row) => (
      row.qpCode === link.qpCode
      && (!link.department || normalizeDepartment(row.department) === normalizeDepartment(link.department))
    ))
    if (rows.length === 0) {
      links.push({ qpCode: link.qpCode, department: link.department ?? '' })
      continue
    }
    for (const row of rows) {
      links.push({
        qpCode: row.qpCode,
        departmentId: row.departmentId,
        department: row.department,
        auditKey: `${row.qpCode}|${row.departmentId}`,
      })
    }
  }
  return links
}

/** 某張查檢表（`QP|部門`）關聯的準備事項模板，依種子順序。 */
export function prepTemplatesForAudit(
  qpCode: string,
  departmentId: string,
  planRows: PlanRow[],
): PrepTemplateItem[] {
  const key = `${qpCode}|${departmentId}`
  return EXTERNAL_AUDIT_PREP_SEED.items.filter((template) => (
    prepLinkedAudits(template, planRows).some((link) => link.auditKey === key)
  ))
}

export type PrepHintTone = 'ok' | 'warn'

export interface PrepSystemHint {
  text: string
  tone: PrepHintTone
  /** 可前往的引用來源（例：NCR 台帳）。 */
  target?: 'ncr' | 'personnel'
}

/**
 * 系統自動檢核提示：只讀推導，不寫入準備完成狀態，也不影響查檢判定。
 * 2-a 內稽覆蓋、2-b／2-c 未結 NCR、第 4 項管審前置、第 7 項管代任命。
 */
export function prepSystemHints(state: AppState): Record<string, PrepSystemHint> {
  const { settings, externalAuditPrep: prep, workspace } = state
  const hints: Record<string, PrepSystemHint> = {}
  const rules = settings.scoringRules
  const coverage = buildMergedCertificateCoverage(workspace, settings.auditYear, rules)
  const gapCount = coverage.gaps.length + coverage.dualPendingItems.length
  const reported = workspace.audits.filter((audit) => audit.status === '已回報').length
  hints['prep-2-a'] = coverage.allInternalAuditComplete
    ? { text: `內稽已覆蓋；已回報 ${reported}/${workspace.audits.length}`, tone: 'ok' }
    : { text: `內稽缺口 ${gapCount}；已回報 ${reported}/${workspace.audits.length}`, tone: 'warn' }

  const sequence = evaluatePrepSequence({ prep, workspace, settings, yearArchives: state.yearArchives })
  for (const template of EXTERNAL_AUDIT_PREP_SEED.items) {
    if (template.ncrGate !== 'open_any' || !template.id) continue
    hints[template.id] = sequence.openNcrCount > 0
      ? { text: `${prep.year} 年未結 NCR ${sequence.openNcrCount} 筆`, tone: 'warn', target: 'ncr' }
      : { text: `${prep.year} 年無未結 NCR`, tone: 'ok', target: 'ncr' }
  }

  const blockers = getManagementReviewCompletionBlockers({
    internalAuditComplete: sequence.internalAuditComplete,
    managementReviewDate: settings.managementReviewDate,
    externalAuditDate: effectiveExternalAuditDate(prep, settings),
  })
  hints[MANAGEMENT_REVIEW_PREP_ITEM_ID] = blockers.length > 0
    ? { text: `管審前置尚缺：${blockers.join('；')}`, tone: 'warn' }
    : { text: `管審前置已齊（管審日期 ${settings.managementReviewDate}）`, tone: 'ok' }

  const onDate = effectiveExternalAuditDate(prep, settings) || `${prep.year}-12-31`
  const isActiveMrAppointment = (appointment: AppState['people'][number]['appointments'][number]) => (
    appointment.role === 'management_representative'
    && appointment.companyId === WORKSPACE_COMPANY_ID
    && Boolean(appointment.effectiveFrom)
    && appointment.effectiveFrom <= onDate
    && (!appointment.effectiveTo || appointment.effectiveTo >= onDate)
    && (!appointment.supersededAt || appointment.supersededAt > onDate)
  )
  const appointed = state.people.find((person) => person.active && person.appointments.some(isActiveMrAppointment))
  const annual = state.annualPersonnelAssignments.find((assignment) => (
    assignment.year === prep.year && assignment.role === 'management_representative'
  ))
  const annualPerson = annual ? state.people.find((person) => person.id === annual.personId) : undefined
  if (appointed) {
    const reference = appointed.appointments.find(isActiveMrAppointment)?.documentReference
    hints['prep-7'] = {
      text: `人員頁管代任命：${appointed.name}${reference ? `（${reference}）` : ''}`,
      tone: 'ok',
      target: 'personnel',
    }
  } else if (annualPerson) {
    hints['prep-7'] = { text: `人員頁年度管代：${annualPerson.name}（無任命文件）`, tone: 'warn', target: 'personnel' }
  } else {
    hints['prep-7'] = { text: '人員頁尚無管代任命', tone: 'warn', target: 'personnel' }
  }
  return hints
}
