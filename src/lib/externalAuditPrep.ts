import prepSeed from '../data/externalAuditPrep.seed.json'

import { deriveInternalAuditComplete } from './coverage'

import { isAuditComplete } from './scoring'

import type {

  AuditSettings,

  CompanyData,

  CompanyId,

  ExternalAuditPrepItemState,

  ExternalAuditPrepState,

  PlanRow,

  ScoringRules,

} from '../types'



export type PrepScopeMode = 'both_separate' | 'merged' | 'site_scope'



export type PrepHeaderRule = 'two_letterheads' | 'shared_dual_header' | 'site_trace'



export type PrepNcrGate = 'none' | 'linked_qp' | 'open_any'



export interface PrepLinkedQp {

  qpCode: string

  department?: string

}



export interface PrepTemplateItem {

  id: string

  no: number

  sub?: string

  groupTitle?: string

  title: string

  owner: string

  scope: { mode: PrepScopeMode }

  headerRule: PrepHeaderRule

  doneWhen: string

  notes: string

  forms: string[]

  linkedQp?: PrepLinkedQp[]

  ncrGate?: PrepNcrGate

}



const HEADER_RULE_BY_SCOPE: Record<PrepScopeMode, PrepHeaderRule> = {

  both_separate: 'two_letterheads',

  merged: 'shared_dual_header',

  site_scope: 'site_trace',

}



const LEGACY_PREP_ID_MAP: Record<string, string> = {

  'prep-2': 'prep-2-a',

  'prep-18': 'prep-18-a',

}



export const HEADER_RULE_LABELS: Record<PrepHeaderRule, string> = {

  two_letterheads: '兩份獨立抬頭',

  shared_dual_header: '一份，表頭兩家並列',

  site_trace: '製令追溯到哪張證書',

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



const TEMPLATE_BY_ID = new Map(EXTERNAL_AUDIT_PREP_SEED.items.map((item) => [item.id, item]))



export function listPrepTemplates(): PrepTemplateItem[] {

  return EXTERNAL_AUDIT_PREP_SEED.items

}



export function getPrepTemplateById(id: string): PrepTemplateItem | undefined {

  return TEMPLATE_BY_ID.get(id)

}



/** @deprecated use getPrepTemplateById */

export function getPrepTemplate(no: number): PrepTemplateItem | undefined {

  return EXTERNAL_AUDIT_PREP_SEED.items.find((i) => i.no === no && !i.sub)

}



export function prepItemLabel(template: PrepTemplateItem): string {

  return template.sub ? `${template.no}${template.sub}` : String(template.no)

}



function defaultItemState(template: PrepTemplateItem): ExternalAuditPrepItemState {

  return {

    id: template.id,

    no: template.no,

    sub: template.sub,

    jiurunDone: false,

    zhenglongxingDone: false,

    mergedDone: false,

    completed: false,

    remark: '',

  }

}



export function createDefaultPrepState(year: number): ExternalAuditPrepState {

  return {

    year,

    internalAuditComplete: false,

    managementReviewComplete: false,

    items: EXTERNAL_AUDIT_PREP_SEED.items.map(defaultItemState),

    auditedProducts: [],

  }

}



function migrateLegacyPrepItem(item: ExternalAuditPrepItemState): ExternalAuditPrepItemState {

  const mappedId = LEGACY_PREP_ID_MAP[item.id]

  if (!mappedId) return item

  const template = getPrepTemplateById(mappedId)

  return {

    ...item,

    id: mappedId,

    sub: template?.sub,

  }

}



/** 補齊種子新增項次，保留既有勾選；舊 prep-2 / prep-18 對應至子列 */

export function ensurePrepItems(state: ExternalAuditPrepState): ExternalAuditPrepState {

  const migrated = state.items.map(migrateLegacyPrepItem)

  const byId = new Map<string, ExternalAuditPrepItemState>()

  for (const item of migrated) {

    if (LEGACY_PREP_ID_MAP[item.id]) continue

    byId.set(item.id, item)

  }



  const items = EXTERNAL_AUDIT_PREP_SEED.items.map((template) => {

    const existing = byId.get(template.id)

    return existing

      ? { ...existing, no: template.no, sub: template.sub }

      : defaultItemState(template)

  })



  const auditedProducts = state.auditedProducts ?? []



  if (

    items.length === state.items.length &&

    items.every((item, idx) => item.id === state.items[idx]?.id) &&

    auditedProducts === state.auditedProducts

  ) {

    return state

  }



  return { ...state, items, auditedProducts }

}



export interface PrepDoneContext {

  company: CompanyData

  rules?: ScoringRules

}



function scopeChecked(template: PrepTemplateItem, state: ExternalAuditPrepItemState): boolean {

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



function planRowsForLink(company: CompanyData, link: PrepLinkedQp): PlanRow[] {

  return company.planRows.filter((row) => {

    if (row.qpCode !== link.qpCode) return false

    if (link.department && row.department !== link.department) return false

    return true

  })

}



function isLinkedQpCompleteForCompany(

  company: CompanyData,

  link: PrepLinkedQp,

  rules?: ScoringRules,

): boolean {

  const rows = planRowsForLink(company, link)

  if (rows.length === 0) return false

  return rows.every((row) => {

    const auditId = `audit-${row.qpCode}-${row.departmentId}`

    const audit = company.audits.find((a) => a.id === auditId)

    if (!audit) return false

    return isAuditComplete(audit, rules)

  })

}



export function isLinkedQpComplete(

  company: CompanyData,

  link: PrepLinkedQp,

  rules?: ScoringRules,

): boolean {

  return isLinkedQpCompleteForCompany(company, link, rules)

}



export interface PrepQpBlockReason {

  qpCode: string

  department?: string

  missingCompany?: CompanyId

}



export function getLinkedQpBlockReasons(

  template: PrepTemplateItem,

  context?: PrepDoneContext,

): PrepQpBlockReason[] {

  if (!context?.company || !template.linkedQp?.length) return []

  const reasons: PrepQpBlockReason[] = []

  for (const link of template.linkedQp) {

    if (!isLinkedQpCompleteForCompany(context.company, link, context.rules)) {

      reasons.push({

        qpCode: link.qpCode,

        department: link.department,

      })

    }

  }

  return reasons

}



function countOpenNcrs(company: CompanyData): number {

  return company.ncrs.filter((n) => n.status !== '結案').length

}



function hasLinkedQpOpenNcr(company: CompanyData, template: PrepTemplateItem): boolean {

  if (!template.linkedQp?.length) return false

  const qpCodes = new Set(template.linkedQp.map((l) => l.qpCode))

  return company.ncrs.some((n) => n.status !== '結案' && qpCodes.has(n.qpCode))

}



function ncrGateBlocks(template: PrepTemplateItem, context?: PrepDoneContext): boolean {

  if (!context?.company) return false

  const gate = template.ncrGate ?? (template.linkedQp?.length ? 'linked_qp' : 'none')

  if (gate === 'none') return false

  if (gate === 'open_any') return countOpenNcrs(context.company) > 0

  return hasLinkedQpOpenNcr(context.company, template)

}



export function isItemDone(

  template: PrepTemplateItem,

  state: ExternalAuditPrepItemState,

  context?: PrepDoneContext,

): boolean {

  if (!scopeChecked(template, state)) return false

  if (!context) return true



  if (template.linkedQp?.length) {

    for (const link of template.linkedQp) {

      if (!isLinkedQpComplete(context.company, link, context.rules)) return false

    }

  }



  if (ncrGateBlocks(template, context)) return false

  return true

}



export function describePrepBlockers(

  template: PrepTemplateItem,

  state: ExternalAuditPrepItemState,

  context?: PrepDoneContext,

): string[] {

  const messages: string[] = []

  if (!scopeChecked(template, state)) return messages



  const qpReasons = getLinkedQpBlockReasons(template, context)

  if (qpReasons.length > 0) {

    const codes = [...new Set(qpReasons.map((r) => r.qpCode))].join('、')

    messages.push(`對應 ${codes} 查檢未完成，不計入完成`)

  }



  if (context && ncrGateBlocks(template, context)) {

    const gate = template.ncrGate ?? (template.linkedQp?.length ? 'linked_qp' : 'none')

    if (gate === 'open_any') {

      messages.push('尚有未結案內部 NCR，不計入完成')

    } else {

      messages.push('對應程序尚有未結案 NCR，不計入完成')

    }

  }



  return messages

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



function shortTitle(template: PrepTemplateItem): string {

  const cut = template.title.indexOf('（')

  const base = cut > 0 ? template.title.slice(0, cut) : template.title

  return base.length > 24 ? `${base.slice(0, 24)}…` : base

}



export function listPrepGaps(

  state: ExternalAuditPrepState,

  context?: PrepDoneContext,

): PrepGaps {

  const separateHalfDone: PrepSeparateHalfDone[] = []

  const mergedOpen: string[] = []

  const siteOpen: string[] = []

  const separateOpen: string[] = []

  const qpBlocked: PrepQpBlocked[] = []



  for (const itemState of state.items) {

    const template = getPrepTemplateById(itemState.id)

    if (!template) continue

    const label = prepItemLabel(template)



    switch (template.scope.mode) {

      case 'both_separate': {

        const { jiurunDone, zhenglongxingDone } = itemState

        if (jiurunDone && !zhenglongxingDone) {

          separateHalfDone.push({

            id: template.id,

            no: template.no,

            label,

            title: template.title,

            missing: 'zhenglongxing',

          })

        } else if (!jiurunDone && zhenglongxingDone) {

          separateHalfDone.push({

            id: template.id,

            no: template.no,

            label,

            title: template.title,

            missing: 'jiurun',

          })

        } else if (!jiurunDone && !zhenglongxingDone) {

          separateOpen.push(template.id)

        }

        break

      }

      case 'merged':

        if (!itemState.mergedDone) mergedOpen.push(template.id)

        break

      case 'site_scope':

        if (!itemState.completed) siteOpen.push(template.id)

        break

    }



    const blockers = describePrepBlockers(template, itemState, context)

    if (scopeChecked(template, itemState) && blockers.length > 0) {

      qpBlocked.push({

        id: template.id,

        no: template.no,

        label,

        title: template.title,

        reasons: blockers,

      })

    }

  }



  return { separateHalfDone, mergedOpen, siteOpen, separateOpen, qpBlocked }

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

    lines.push({

      no: half.no,

      label: half.label,

      text: `項次 ${half.label} ${shortTitle(getPrepTemplateById(half.id)!)} — 缺${company}抬頭`,

    })

  }



  for (const id of gaps.separateOpen) {

    const template = getPrepTemplateById(id)!

    lines.push({

      no: template.no,

      label: prepItemLabel(template),

      text: `項次 ${prepItemLabel(template)} ${shortTitle(template)} — 兩家抬頭均未備`,

    })

  }



  for (const id of gaps.mergedOpen) {

    const template = getPrepTemplateById(id)!

    lines.push({

      no: template.no,

      label: prepItemLabel(template),

      text: `項次 ${prepItemLabel(template)} ${shortTitle(template)} — 合併未勾（表頭須兩家）`,

    })

  }



  for (const id of gaps.siteOpen) {

    const template = getPrepTemplateById(id)!

    lines.push({

      no: template.no,

      label: prepItemLabel(template),

      text: `項次 ${prepItemLabel(template)} ${shortTitle(template)} — 廠區追溯未確認`,

    })

  }



  for (const blocked of gaps.qpBlocked) {

    lines.push({

      no: blocked.no,

      label: blocked.label,

      text: `項次 ${blocked.label} — ${blocked.reasons[0] ?? 'QP 未完成'}`,

    })

  }



  return lines.slice(0, limit)

}



export function headerRuleMatchesScope(item: PrepTemplateItem): boolean {

  return item.headerRule === HEADER_RULE_BY_SCOPE[item.scope.mode]

}



export function countPrepProgress(

  state: ExternalAuditPrepState,

  company: CompanyData,

  _auditYear: number,

  rules?: ScoringRules,

): { done: number; total: number } {

  const context: PrepDoneContext = { company, rules }

  let done = 0

  for (const itemState of state.items) {

    const template = getPrepTemplateById(itemState.id)

    if (template && isItemDone(template, itemState, context)) done++

  }

  return { done, total: state.items.length }

}



export interface PrepSequenceWarnings {

  openNcrCount: number

  ncrWarning: boolean

  sequenceWarning: boolean

  internalAuditComplete: boolean

  auditedProductsWarning: boolean

  messages: string[]

}



export function needsAuditedProductsWarning(

  prep: ExternalAuditPrepState,

  settings: AuditSettings,

): boolean {

  return Boolean(settings.externalAuditDate) && (prep.auditedProducts?.length ?? 0) === 0

}



export function evaluatePrepSequence(

  prep: ExternalAuditPrepState,

  company: CompanyData,

  settings: AuditSettings,

  rules?: ScoringRules,

): PrepSequenceWarnings {

  const messages: string[] = []

  const context: PrepDoneContext = { company, rules }

  const openNcrCount = countOpenNcrs(company)



  const internalAuditComplete = deriveInternalAuditComplete(

    company,

    settings.auditYear,

    rules,

  )



  const ncrWarning = openNcrCount > 0

  if (ncrWarning) {

    messages.push(`尚有 ${openNcrCount} 件未結案內部 NCR，建議於外部稽核前關閉。`)

  }



  if (!internalAuditComplete) {

    messages.push('內部稽核尚未完成（兩張證書之計畫／查檢尚有缺口）。')

  }



  const sequenceWarning = Boolean(
    (prep.managementReviewComplete && !internalAuditComplete) ||
      (prep.managementReviewComplete &&
        settings.managementReviewDate &&
        settings.externalAuditDate &&
        new Date(settings.managementReviewDate) >= new Date(settings.externalAuditDate)),
  )



  if (prep.managementReviewComplete && !internalAuditComplete) {

    messages.push('管理審查已標記完成，但內部稽核尚未完成 — 違反時間順序要求。')

  }



  if (

    prep.managementReviewComplete &&

    settings.managementReviewDate &&

    settings.externalAuditDate &&

    new Date(settings.managementReviewDate) >= new Date(settings.externalAuditDate)

  ) {

    messages.push('管理審查日期不應晚於或等於外部稽核日期。')

  }



  const gaps = listPrepGaps(prep, context)

  for (const half of gaps.separateHalfDone) {

    const company = half.missing === 'jiurun' ? '九潤' : '正隆興'

    messages.push(

      `項次 ${half.label} 只完成其中一家，缺 ${company} 抬頭 — 另一張證書會漏準備。`,

    )

  }



  for (const blocked of gaps.qpBlocked) {

    messages.push(`項次 ${blocked.label}：${blocked.reasons.join('；')}`)

  }



  const auditedProductsWarning = needsAuditedProductsWarning(prep, settings)

  if (auditedProductsWarning) {

    messages.push('已設定外部稽核日期，但尚未登錄當日受稽產品／機種。')

  }



  return {

    openNcrCount,

    ncrWarning,

    sequenceWarning,

    internalAuditComplete,

    auditedProductsWarning,

    messages,

  }

}



export function itemHasCallout(no: number): 'quality-objectives' | 'risk-climate' | 'satisfaction' | null {

  if (no === 3) return 'quality-objectives'

  if (no === 5) return 'risk-climate'

  if (no === 15) return 'satisfaction'

  return null

}


