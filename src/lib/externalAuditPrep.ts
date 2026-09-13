import prepSeed from '../data/externalAuditPrep.seed.json'
import type {
  CompanyData,
  CompanyId,
  ExternalAuditPrepItemState,
  ExternalAuditPrepState,
  ProcedureAudit,
} from '../types'

export type PrepScopeMode = 'both_separate' | 'merged' | 'site_scope'

export interface PrepTemplateItem {
  no: number
  title: string
  owner: string
  scope: { mode: PrepScopeMode }
  notes: string
  forms: string[]
}

export const EXTERNAL_AUDIT_PREP_SEED = prepSeed as {
  source: string
  title: string
  certificateModel: string
  companies: string[]
  sequenceRules: string[]
  items: PrepTemplateItem[]
  otherNotes: string[]
}

export function createDefaultPrepState(year: number): ExternalAuditPrepState {
  return {
    year,
    managementReviewComplete: false,
    items: EXTERNAL_AUDIT_PREP_SEED.items.map((item) => ({
      id: `prep-${item.no}`,
      no: item.no,
      jiurunDone: false,
      zhenglongxingDone: false,
      mergedDone: false,
      completed: false,
      remark: '',
    })),
  }
}

export function getPrepTemplate(no: number): PrepTemplateItem | undefined {
  return EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.no === no)
}

export function isItemDone(
  template: PrepTemplateItem,
  state: ExternalAuditPrepItemState,
): boolean {
  switch (template.scope.mode) {
    case 'both_separate':
      return state.jiurunDone && state.zhenglongxingDone
    case 'merged':
      return state.mergedDone
    case 'site_scope':
      return state.completed
    default:
      return false
  }
}

export function countPrepProgress(state: ExternalAuditPrepState): {
  done: number
  total: number
} {
  let done = 0
  for (const itemState of state.items) {
    const template = getPrepTemplate(itemState.no)
    if (template && isItemDone(template, itemState)) done++
  }
  return { done, total: state.items.length }
}

export interface InternalAuditCompleteDetail {
  companyId: string
  companyName: string
  plannedCount: number
  completedCount: number
  complete: boolean
}

export interface InternalAuditCompleteSummary {
  complete: boolean
  details: InternalAuditCompleteDetail[]
  incompletePlanKeys: string[]
}

const DUAL_COMPANY_IDS: CompanyId[] = ['jiurun', 'zhenglongxing']

/** 單一程序稽核是否已足夠完成（有實施日期，或查檢項皆已判定） */
export function isProcedureAuditCompleteEnough(audit: ProcedureAudit | undefined): boolean {
  if (!audit) return false
  if (audit.auditDate.trim() !== '') return true
  if (audit.items.length === 0) return false
  return audit.items.every((item) => item.judgment !== null)
}

export function computeCompanyInternalAuditComplete(
  companyId: string,
  company: CompanyData,
): InternalAuditCompleteDetail {
  let completedCount = 0

  for (const row of company.planRows) {
    const audit = company.audits.find(
      (a) => a.qpCode === row.qpCode && a.departmentId === row.departmentId,
    )
    if (isProcedureAuditCompleteEnough(audit)) {
      completedCount++
    }
  }

  return {
    companyId,
    companyName: company.name || companyId,
    plannedCount: company.planRows.length,
    completedCount,
    complete: company.planRows.length === 0 || completedCount === company.planRows.length,
  }
}

export function computeInternalAuditComplete(
  companies: Record<string, CompanyData>,
  companyIds: CompanyId[] = DUAL_COMPANY_IDS,
): InternalAuditCompleteSummary {
  const details = companyIds.map((id) =>
    computeCompanyInternalAuditComplete(id, companies[id] ?? emptyCompany()),
  )
  const incompletePlanKeys = details.flatMap((d) =>
    d.complete ? [] : [`${d.companyId}:${d.plannedCount - d.completedCount}`],
  )
  return {
    complete: details.every((d) => d.complete),
    details,
    incompletePlanKeys,
  }
}

function emptyCompany(): CompanyData {
  return {
    name: '',
    departments: [],
    planRows: [],
    audits: [],
    ncrs: [],
    observations: [],
    suggestions: [],
  }
}

export function getInternalAuditCompleteOverride(prep: ExternalAuditPrepState): boolean | undefined {
  if (prep.internalAuditCompleteOverride !== undefined) {
    return prep.internalAuditCompleteOverride
  }
  if (prep.internalAuditComplete !== undefined) {
    return prep.internalAuditComplete
  }
  return undefined
}

export function getEffectiveInternalAuditComplete(
  prep: ExternalAuditPrepState,
  companies: Record<string, CompanyData>,
): boolean {
  const override = getInternalAuditCompleteOverride(prep)
  if (override !== undefined) return override
  return computeInternalAuditComplete(companies).complete
}

export interface PrepSequenceWarnings {
  openNcrCount: number
  ncrWarning: boolean
  sequenceWarning: boolean
  internalAuditComputed: boolean
  internalAuditOverridden: boolean
  messages: string[]
}

export function evaluatePrepSequence(
  prep: ExternalAuditPrepState,
  companies: Record<string, CompanyData>,
): PrepSequenceWarnings {
  const messages: string[] = []
  let openNcrCount = 0
  for (const co of Object.values(companies)) {
    openNcrCount += co.ncrs.filter((n) => n.status !== '結案').length
  }

  const ncrWarning = openNcrCount > 0
  if (ncrWarning) {
    messages.push(`尚有 ${openNcrCount} 件未結案內部 NCR，建議於外部稽核前關閉。`)
  }

  const internalAuditComputed = computeInternalAuditComplete(companies).complete
  const internalAuditOverridden = getInternalAuditCompleteOverride(prep) !== undefined
  const effectiveInternalComplete = getEffectiveInternalAuditComplete(prep, companies)

  const sequenceWarning = prep.managementReviewComplete && !effectiveInternalComplete
  if (sequenceWarning) {
    messages.push('管理審查已標記完成，但內部稽核尚未完成 — 違反時間順序要求。')
  }

  if (internalAuditOverridden && prep.managementReviewComplete && !internalAuditComputed) {
    messages.push('內部稽核已手動標記完成，但程序稽核資料顯示尚有未完成項目。')
  }

  return {
    openNcrCount,
    ncrWarning,
    sequenceWarning,
    internalAuditComputed,
    internalAuditOverridden,
    messages,
  }
}

export function itemHasCallout(no: number): 'quality-objectives' | 'risk-climate' | 'satisfaction' | null {
  if (no === 3) return 'quality-objectives'
  if (no === 5) return 'risk-climate'
  if (no === 15) return 'satisfaction'
  return null
}
