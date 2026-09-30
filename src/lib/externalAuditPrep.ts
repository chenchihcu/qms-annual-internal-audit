import prepSeed from '../data/externalAuditPrep.seed.json'
import relationshipSeed from '../data/companyRelationships.seed.json'
import { buildMergedCertificateCoverage, evaluateDateSequence } from './coverage'
import type {
  CompanyData,
  CompanyId,
  CompanyRelationship,
  AuditSettings,
  ExternalAuditPrepItemState,
  ExternalAuditPrepState,
  YearArchiveEntry,
} from '../types'
import { COMPANY_IDS } from '../types'

export type PrepScopeMode = 'both_separate' | 'merged' | 'site_scope'

export interface PrepTemplateItem {
  id?: string
  no: number
  sub?: string
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

function normalizeSequenceFlag(
  value: boolean | Record<CompanyId, boolean> | undefined,
): boolean {
  if (typeof value === 'boolean') return value
  if (value && typeof value === 'object') {
    return COMPANY_IDS.every((id) => Boolean(value[id]))
  }
  return false
}

export function createDefaultPrepState(year: number): ExternalAuditPrepState {
  return {
    year,
    externalAuditDate: undefined,
    internalAuditComplete: false,
    managementReviewComplete: false,
    relationshipChecks: {},
    items: EXTERNAL_AUDIT_PREP_SEED.items.map((item) => ({
      id: item.id ?? `prep-${item.no}`,
      no: item.no,
      completed: false,
      remark: '',
    })),
    onsiteSlots: [],
  }
}

export function migratePrepState(
  old: Partial<ExternalAuditPrepState> & {
    internalAuditComplete?: boolean | Record<CompanyId, boolean>
    managementReviewComplete?: boolean | Record<CompanyId, boolean>
  },
  externalAuditDateFromSettings?: string,
): ExternalAuditPrepState {
  const year = old.year ?? new Date().getFullYear()
  return {
    year,
    externalAuditDate: old.externalAuditDate ?? externalAuditDateFromSettings,
    internalAuditComplete: normalizeSequenceFlag(old.internalAuditComplete),
    managementReviewComplete: normalizeSequenceFlag(old.managementReviewComplete),
    relationshipChecks: old.relationshipChecks ?? {},
    items: old.items ?? createDefaultPrepState(year).items,
    onsiteSlots: old.onsiteSlots ?? [],
  }
}

export function getPrepTemplate(no: number): PrepTemplateItem | undefined {
  return EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.no === no)
}

export function getPrepTemplateForState(
  itemState: ExternalAuditPrepItemState,
): PrepTemplateItem | undefined {
  return (
    EXTERNAL_AUDIT_PREP_SEED.items.find((item) => item.id === itemState.id) ??
    getPrepTemplate(itemState.no)
  )
}

export function isItemDone(
  _template: PrepTemplateItem,
  itemState: ExternalAuditPrepItemState,
): boolean {
  return Boolean(itemState.completed)
}

export const DEFAULT_COMPANY_RELATIONSHIPS = relationshipSeed as CompanyRelationship[]

export function workspacePrepText(value: string): string {
  return value
    .replace(/同一天評、同一供應商，評鑑表仍須兩份抬頭。?/g, '')
    .replace(/（[^）]*(?:九潤|正隆興|兩家|兩公司|兩張證書|兩證|合併)[^）]*）/g, '')
    .replace(/\([^)]*(?:九潤|正隆興|兩家|兩公司|兩張證書|兩證|合併)[^)]*\)/g, '')
    .replace(/九潤精密科技|九潤精密|九潤|正隆興精密|正隆興/g, '')
    .replace(/兩家公司各自|兩家公司|兩家各自|兩家|兩公司|兩張證書|兩證|合併抬頭|合併共用|合併/g, '')
    .replace(/（\s*）|\(\s*\)/g, '')
    .replace(/[＋+]/g, '')
    .replace(/\s*[/／]\s*/g, '／')
    .replace(/[／]{2,}/g, '／')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isLegacyCompanySpecificPrepText(value: string): boolean {
  return /(九潤|正隆興|法人|兩家公司|兩家|兩公司|兩類|兩張證書|兩證|合併|抬頭規則|適用公司)/.test(value)
}

export function workspacePrepNotes(value: string): string {
  const segments = value.split(/([。；])/)
  const visibleSentences: string[] = []

  for (let index = 0; index < segments.length; index += 2) {
    const sentence = segments[index] ?? ''
    const punctuation = segments[index + 1] ?? ''
    if (isLegacyCompanySpecificPrepText(sentence)) continue

    const cleaned = workspacePrepText(sentence)
    if (cleaned) visibleSentences.push(`${cleaned}${punctuation}`)
  }

  return visibleSentences.join('').trim()
}

export function countPrepProgress(prep: ExternalAuditPrepState): {
  done: number
  total: number
} {
  let done = 0
  for (const itemState of prep.items) {
    const template = getPrepTemplateForState(itemState)
    if (template && isItemDone(template, itemState)) done++
  }
  return { done, total: prep.items.length }
}

export interface PrepSequenceContext {
  prep: ExternalAuditPrepState
  workspace: CompanyData
  settings: AuditSettings
  yearArchives: Record<string, YearArchiveEntry>
}

function workspaceDataForPrepYear(
  prepYear: number,
  workspace: CompanyData,
  settings: AuditSettings,
  yearArchives: Record<string, YearArchiveEntry>,
): CompanyData {
  if (settings.auditYear === prepYear) return workspace
  // v14 still stores archived workspaces behind the legacy jiurun compatibility key.
  return yearArchives[String(prepYear)]?.workspace ?? workspace
}

export interface PrepSequenceWarnings {
  openNcrCount: number
  ncrWarning: boolean
  internalAuditComplete: boolean
  sequenceWarning: boolean
  sequenceMessages: string[]
  messages: string[]
}

export interface ManagementReviewCompletionContext {
  internalAuditComplete: boolean
  managementReviewDate?: string | null
  externalAuditDate?: string | null
}

export function getManagementReviewCompletionBlockers(
  context: ManagementReviewCompletionContext,
): string[] {
  const blockers: string[] = []
  const managementReviewDate = context.managementReviewDate?.trim()
  const managementReviewTime = managementReviewDate ? Date.parse(managementReviewDate) : Number.NaN
  if (!context.internalAuditComplete) blockers.push('完成當年度內部稽核')
  if (!Number.isFinite(managementReviewTime)) blockers.push('填寫有效的管審日期')

  const externalAuditDate = context.externalAuditDate?.trim()
  if (externalAuditDate) {
    const externalAuditTime = Date.parse(externalAuditDate)
    if (!Number.isFinite(externalAuditTime)) {
      blockers.push('填寫有效的外稽日期')
    } else if (Number.isFinite(managementReviewTime) && managementReviewTime >= externalAuditTime) {
      blockers.push('將管審日期調整至外稽日期前')
    }
  }
  return blockers
}

export function evaluatePrepSequence(context: PrepSequenceContext): PrepSequenceWarnings {
  const { prep, workspace: currentWorkspace, settings, yearArchives } = context
  const messages: string[] = []
  const workspace = workspaceDataForPrepYear(prep.year, currentWorkspace, settings, yearArchives)
  const openNcrCount = workspace.ncrs.filter((ncr) => ncr.status !== '結案').length
  const ncrWarning = openNcrCount > 0
  if (ncrWarning) {
    messages.push(`外稽準備 ${prep.year} 年仍有 ${openNcrCount} 筆未結 NCR。`)
  }

  const rules = settings.scoringRules ?? { conform: 100, nonConform: 0, observation: 50 }
  const internalComplete = buildMergedCertificateCoverage(workspace, settings.auditYear, rules).allInternalAuditComplete
  const completionSequenceWarning = prep.managementReviewComplete && !internalComplete
  const effectiveExternalAuditDate = prep.externalAuditDate?.trim() || settings.externalAuditDate
  const dateSequenceMessages = evaluateDateSequence({
    ...settings,
    externalAuditDate: effectiveExternalAuditDate,
  })
  const sequenceMessages = [...dateSequenceMessages]
  if (completionSequenceWarning) {
    sequenceMessages.unshift('管理審查已標記完成，但內部稽核尚未完成 — 違反時間順序要求。')
  }
  const sequenceWarning = completionSequenceWarning || dateSequenceMessages.length > 0
  messages.push(...sequenceMessages)

  return {
    openNcrCount,
    ncrWarning,
    internalAuditComplete: internalComplete,
    sequenceWarning,
    sequenceMessages,
    messages,
  }
}

export function itemHasCallout(no: number): 'quality-objectives' | 'risk-climate' | 'satisfaction' | null {
  if (no === 3) return 'quality-objectives'
  if (no === 5) return 'risk-climate'
  if (no === 15) return 'satisfaction'
  return null
}

export function formatPrepYearMismatch(prepYear: number, auditYear: number): string | null {
  if (prepYear === auditYear) return null
  return `外稽準備年度為 ${prepYear}，目前稽核台帳年度為 ${auditYear}，請確認年度。`
}
