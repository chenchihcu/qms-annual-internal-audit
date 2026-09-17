import prepSeed from '../data/externalAuditPrep.seed.json'
import relationshipSeed from '../data/companyRelationships.seed.json'
import type {
  CompanyData,
  CompanyId,
  CompanyRelationship,
  ExternalAuditPrepItemState,
  ExternalAuditPrepState,
  YearArchiveEntry,
} from '../types'
import { COMPANY_IDS, COMPANY_LABELS, relationshipCheckKey } from '../types'

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

export const DEFAULT_COMPANY_RELATIONSHIPS = relationshipSeed as CompanyRelationship[]

function emptyCompanyFlags(): Record<CompanyId, boolean> {
  return { jiurun: false, zhenglongxing: false }
}

export function createDefaultPrepState(year: number): ExternalAuditPrepState {
  return {
    year,
    externalAuditDate: undefined,
    internalAuditComplete: emptyCompanyFlags(),
    managementReviewComplete: emptyCompanyFlags(),
    relationshipChecks: {},
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

export function migratePrepState(
  old: Partial<ExternalAuditPrepState> & {
    internalAuditComplete?: boolean | Record<CompanyId, boolean>
    managementReviewComplete?: boolean | Record<CompanyId, boolean>
  },
  externalAuditDateFromSettings?: string,
): ExternalAuditPrepState {
  if (
    old.internalAuditComplete
    && typeof old.internalAuditComplete === 'object'
    && old.relationshipChecks
  ) {
    return {
      year: old.year ?? new Date().getFullYear(),
      externalAuditDate: old.externalAuditDate ?? externalAuditDateFromSettings,
      internalAuditComplete: old.internalAuditComplete,
      managementReviewComplete: old.managementReviewComplete ?? emptyCompanyFlags(),
      relationshipChecks: old.relationshipChecks,
      items: old.items ?? createDefaultPrepState(old.year ?? new Date().getFullYear()).items,
    }
  }

  const internalLegacy = old.internalAuditComplete
  const managementLegacy = old.managementReviewComplete
  const internalAuditComplete = typeof internalLegacy === 'boolean'
    ? { jiurun: internalLegacy, zhenglongxing: internalLegacy }
    : emptyCompanyFlags()
  const managementReviewComplete = typeof managementLegacy === 'boolean'
    ? { jiurun: managementLegacy, zhenglongxing: managementLegacy }
    : emptyCompanyFlags()

  return {
    year: old.year ?? new Date().getFullYear(),
    externalAuditDate: old.externalAuditDate ?? externalAuditDateFromSettings,
    internalAuditComplete,
    managementReviewComplete,
    relationshipChecks: old.relationshipChecks ?? {},
    items: old.items ?? createDefaultPrepState(old.year ?? new Date().getFullYear()).items,
  }
}

export function getPrepTemplate(no: number): PrepTemplateItem | undefined {
  return EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.no === no)
}

function relationshipGatesSatisfied(
  prepItemNo: number,
  prep: ExternalAuditPrepState,
  relationships: CompanyRelationship[],
): boolean {
  const gates = relationships.filter((rel) => rel.prepItemNo === prepItemNo)
  return gates.every((gate) => prep.relationshipChecks[relationshipCheckKey(gate.from, gate.to, gate.relation)])
}

export function isItemDone(
  template: PrepTemplateItem,
  itemState: ExternalAuditPrepItemState,
  prep: ExternalAuditPrepState,
  relationships: CompanyRelationship[] = DEFAULT_COMPANY_RELATIONSHIPS,
): boolean {
  let base = false
  switch (template.scope.mode) {
    case 'both_separate':
      base = itemState.jiurunDone && itemState.zhenglongxingDone
      break
    case 'merged':
      base = itemState.mergedDone
      break
    case 'site_scope':
      base = itemState.completed
      break
    default:
      return false
  }
  if (!base) return false
  return relationshipGatesSatisfied(template.no, prep, relationships)
}

export function countPrepProgress(
  prep: ExternalAuditPrepState,
  relationships: CompanyRelationship[] = DEFAULT_COMPANY_RELATIONSHIPS,
): {
  done: number
  total: number
} {
  let done = 0
  for (const itemState of prep.items) {
    const template = getPrepTemplate(itemState.no)
    if (template && isItemDone(template, itemState, prep, relationships)) done++
  }
  return { done, total: prep.items.length }
}

export interface PrepSequenceContext {
  prep: ExternalAuditPrepState
  companies: Record<CompanyId, CompanyData>
  companySettings: Record<CompanyId, import('../types').AuditSettings>
  yearArchives: Record<string, YearArchiveEntry>
}

function companyDataForPrepYear(
  companyId: CompanyId,
  prepYear: number,
  companies: Record<CompanyId, CompanyData>,
  companySettings: Record<CompanyId, import('../types').AuditSettings>,
  yearArchives: Record<string, YearArchiveEntry>,
): CompanyData {
  const liveYear = companySettings[companyId]?.auditYear
  if (liveYear === prepYear) return companies[companyId]
  const archived = yearArchives[String(prepYear)]?.companies[companyId]
  return archived ?? companies[companyId]
}

export interface PrepSequenceWarnings {
  openNcrCount: number
  openNcrByCompany: Record<CompanyId, number>
  ncrWarning: boolean
  sequenceWarning: boolean
  messages: string[]
}

export function evaluatePrepSequence(context: PrepSequenceContext): PrepSequenceWarnings {
  const { prep, companies, companySettings, yearArchives } = context
  const messages: string[] = []
  const openNcrByCompany: Record<CompanyId, number> = { jiurun: 0, zhenglongxing: 0 }

  for (const companyId of COMPANY_IDS) {
    const co = companyDataForPrepYear(companyId, prep.year, companies, companySettings, yearArchives)
    openNcrByCompany[companyId] = co.ncrs.filter((n) => n.status !== '結案').length
  }

  const openNcrCount = openNcrByCompany.jiurun + openNcrByCompany.zhenglongxing
  const ncrWarning = openNcrCount > 0
  if (ncrWarning) {
    messages.push(
      `未結內部 NCR：九潤 ${openNcrByCompany.jiurun}、正隆興 ${openNcrByCompany.zhenglongxing}（對齊外稽準備 ${prep.year} 年）。`,
    )
  }

  const sequenceWarning = COMPANY_IDS.some(
    (id) => prep.managementReviewComplete[id] && !prep.internalAuditComplete[id],
  )
  if (sequenceWarning) {
    messages.push('管理審查已標記完成，但內部稽核尚未完成 — 違反時間順序要求（請依公司分別確認）。')
  }

  return { openNcrCount, openNcrByCompany, ncrWarning, sequenceWarning, messages }
}

export function itemHasCallout(no: number): 'quality-objectives' | 'risk-climate' | 'satisfaction' | null {
  if (no === 3) return 'quality-objectives'
  if (no === 5) return 'risk-climate'
  if (no === 15) return 'satisfaction'
  return null
}

export function relationshipsForPrepItem(
  prepItemNo: number,
  relationships: CompanyRelationship[] = DEFAULT_COMPANY_RELATIONSHIPS,
): CompanyRelationship[] {
  return relationships.filter((rel) => rel.prepItemNo === prepItemNo)
}

export function prepYearMismatchCompanies(
  prepYear: number,
  companySettings: Record<CompanyId, import('../types').AuditSettings>,
): CompanyId[] {
  return COMPANY_IDS.filter((id) => companySettings[id].auditYear !== prepYear)
}

export function formatPrepYearMismatch(
  prepYear: number,
  companySettings: Record<CompanyId, import('../types').AuditSettings>,
): string | null {
  const mismatched = prepYearMismatchCompanies(prepYear, companySettings)
  if (mismatched.length === 0) return null
  return `外稽準備年度為 ${prepYear}，但 ${mismatched.map((id) => COMPANY_LABELS[id]).join('、')} 內稽年度不同 — 請確認台帳與準備表對齊。`
}
