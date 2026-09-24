import prepSeed from '../data/externalAuditPrep.seed.json'
import relationshipSeed from '../data/companyRelationships.seed.json'
import { buildMergedCertificateCoverage } from './coverage'
import type {
  CompanyData,
  CompanyId,
  CompanyRelationship,
  ExternalAuditPrepItemState,
  ExternalAuditPrepState,
  ScoringRules,
  YearArchiveEntry,
} from '../types'
import { COMPANY_IDS, COMPANY_LABELS, relationshipCheckKey } from '../types'

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

export const DEFAULT_COMPANY_RELATIONSHIPS = relationshipSeed as CompanyRelationship[]

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
      jiurunDone: false,
      zhenglongxingDone: false,
      mergedDone: false,
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
    const template = getPrepTemplateForState(itemState)
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

  const internalComplete = COMPANY_IDS.every((companyId) => {
    const co = companyDataForPrepYear(companyId, prep.year, companies, companySettings, yearArchives)
    const settings = companySettings[companyId]
    const auditYear = settings?.auditYear ?? prep.year
    const rules = settings?.scoringRules ?? { conform: 100, nonConform: 0, observation: 50 }
    return buildMergedCertificateCoverage(co, auditYear, rules).allInternalAuditComplete
  })
  const sequenceWarning = prep.managementReviewComplete && !internalComplete
  if (sequenceWarning) {
    messages.push('管理審查已標記完成，但內部稽核尚未完成 — 違反時間順序要求。')
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

export interface PrepDoneContext {
  company: CompanyData
  rules?: ScoringRules
}

export interface PrepSeparateHalfDone {
  id: string
  no: number
  label: string
  title: string
  missing: 'jiurun' | 'zhenglongxing'
}

export interface PrepQpBlocked {
  id: string
  no: number
  label: string
  title: string
  reasons: string[]
}

export interface PrepGapSummaryLine {
  id: string
  no: number
  label: string
  text: string
}

export interface PrepGaps {
  separateHalfDone: PrepSeparateHalfDone[]
  mergedOpen: string[]
  siteOpen: string[]
  separateOpen: string[]
  qpBlocked: PrepQpBlocked[]
}

function prepItemLabel(template: PrepTemplateItem): string {
  return `第${template.no}項`
}

function shortPrepTitle(template: PrepTemplateItem): string {
  const cut = template.title.indexOf('（')
  const base = cut > 0 ? template.title.slice(0, cut) : template.title
  return base.length > 24 ? `${base.slice(0, 24)}…` : base
}

export function listPrepGaps(
  state: ExternalAuditPrepState,
  _context?: PrepDoneContext,
): PrepGaps {
  const separateHalfDone: PrepSeparateHalfDone[] = []
  const mergedOpen: string[] = []
  const siteOpen: string[] = []
  const separateOpen: string[] = []

  for (const itemState of state.items) {
    const template = getPrepTemplateForState(itemState)
    // #region agent log
    if (itemState.no === 2) {
      const byId = EXTERNAL_AUDIT_PREP_SEED.items.find((item) => item.id === itemState.id)
      fetch('http://127.0.0.1:7321/ingest/123e2b23-b370-4bb6-9a82-27ec3a248c96',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f0bcf7'},body:JSON.stringify({sessionId:'f0bcf7',runId:'post-fix',hypothesisId:'A',location:'externalAuditPrep.ts:listPrepGaps',message:'item no 2 template lookup',data:{itemId:itemState.id,itemNo:itemState.no,lookupId:template?.id??null,lookupMode:template?.scope.mode??null,byId:byId?.id??null,byIdMode:byId?.scope.mode??null,mergedDone:itemState.mergedDone},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    if (!template) continue
    const label = prepItemLabel(template)

    switch (template.scope.mode) {
      case 'both_separate': {
        const { jiurunDone, zhenglongxingDone } = itemState
        if (jiurunDone && !zhenglongxingDone) {
          separateHalfDone.push({
            id: itemState.id,
            no: template.no,
            label,
            title: template.title,
            missing: 'zhenglongxing',
          })
        } else if (!jiurunDone && zhenglongxingDone) {
          separateHalfDone.push({
            id: itemState.id,
            no: template.no,
            label,
            title: template.title,
            missing: 'jiurun',
          })
        } else if (!jiurunDone && !zhenglongxingDone) {
          separateOpen.push(itemState.id)
        }
        break
      }
      case 'merged':
        if (!itemState.mergedDone) mergedOpen.push(itemState.id)
        break
      case 'site_scope':
        if (!itemState.completed) siteOpen.push(itemState.id)
        break
    }
  }

  return { separateHalfDone, mergedOpen, siteOpen, separateOpen, qpBlocked: [] }
}

export function summarizePrepGaps(
  state: ExternalAuditPrepState,
  context?: PrepDoneContext,
  limit = 5,
): PrepGapSummaryLine[] {
  const gaps = listPrepGaps(state, context)
  const lines: PrepGapSummaryLine[] = []

  for (const half of gaps.separateHalfDone) {
    const company = half.missing === 'jiurun' ? '九潤' : '正隆興'
    const template = getPrepTemplateForState({ id: half.id, no: half.no } as ExternalAuditPrepItemState)
    lines.push({
      id: half.id,
      no: half.no,
      label: half.label,
      text: `項次 ${half.label} ${template ? shortPrepTitle(template) : half.title} — 缺${company}抬頭`,
    })
  }

  for (const id of gaps.mergedOpen) {
    const itemState = state.items.find((item) => item.id === id)
    const template = itemState ? getPrepTemplateForState(itemState) : undefined
    if (!template) continue
    lines.push({
      id,
      no: template.no,
      label: prepItemLabel(template),
      text: `項次 ${prepItemLabel(template)} ${shortPrepTitle(template)} — 合併抬頭未完成`,
    })
  }

  for (const id of gaps.siteOpen) {
    const itemState = state.items.find((item) => item.id === id)
    const template = itemState ? getPrepTemplateForState(itemState) : undefined
    if (!template) continue
    lines.push({
      id,
      no: template.no,
      label: prepItemLabel(template),
      text: `項次 ${prepItemLabel(template)} ${shortPrepTitle(template)} — 現場範圍未完成`,
    })
  }

  const sliced = lines.slice(0, limit)
  // #region agent log
  const keyCounts: Record<string, number> = {}
  for (const line of sliced) {
    const key = `${line.no}-${line.text}`
    keyCounts[key] = (keyCounts[key] ?? 0) + 1
  }
  fetch('http://127.0.0.1:7321/ingest/123e2b23-b370-4bb6-9a82-27ec3a248c96',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'f0bcf7'},body:JSON.stringify({sessionId:'f0bcf7',runId:'pre-fix',hypothesisId:'B-C',location:'externalAuditPrep.ts:summarizePrepGaps',message:'prep gap summary keys',data:{lineCount:sliced.length,mergedOpen:gaps.mergedOpen,separateOpen:gaps.separateOpen,keys:sliced.map((line)=>`${line.no}-${line.text}`),duplicateKeys:Object.entries(keyCounts).filter(([,count])=>count>1).map(([key,count])=>({key,count}))},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return sliced
}
