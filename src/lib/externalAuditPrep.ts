import prepSeed from '../data/externalAuditPrep.seed.json'
import type { CompanyData, ExternalAuditPrepItemState, ExternalAuditPrepState } from '../types'

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
    internalAuditComplete: false,
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

export interface PrepSequenceWarnings {
  openNcrCount: number
  ncrWarning: boolean
  sequenceWarning: boolean
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

  const sequenceWarning =
    prep.managementReviewComplete && !prep.internalAuditComplete
  if (sequenceWarning) {
    messages.push('管理審查已標記完成，但內部稽核尚未完成 — 違反時間順序要求。')
  }

  return { openNcrCount, ncrWarning, sequenceWarning, messages }
}

export function itemHasCallout(no: number): 'quality-objectives' | 'risk-climate' | 'satisfaction' | null {
  if (no === 3) return 'quality-objectives'
  if (no === 5) return 'risk-climate'
  if (no === 15) return 'satisfaction'
  return null
}
