import prepSeed from '../data/externalAuditPrep.seed.json'
import type { CompanyData, ExternalAuditPrepItemState, ExternalAuditPrepState } from '../types'

export type PrepScopeMode = 'both_separate' | 'merged' | 'site_scope'

export interface PrepTemplateItem {
  no: number
  title: string
  owner: string
  scope: { mode: PrepScopeMode; companyChecks?: boolean }
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
      siteScope: '',
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
      return state.mergedDone && (!template.scope.companyChecks ||
        (state.jiurunDone && state.zhenglongxingDone))
    case 'site_scope':
      return state.completed && Boolean(state.siteScope?.trim())
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
  sequenceMessages: string[]
}

export function evaluatePrepSequence(
  prep: ExternalAuditPrepState,
  companies: Record<string, CompanyData>,
): PrepSequenceWarnings {
  const messages: string[] = []
  const sequenceMessages: string[] = []
  let openNcrCount = 0
  for (const co of Object.values(companies)) {
    openNcrCount += co.ncrs.filter((n) => n.status !== '結案').length
  }

  const ncrWarning = openNcrCount > 0
  if (ncrWarning) {
    messages.push(`尚有 ${openNcrCount} 件內部 NCR 未結案；請於外稽前結案。`)
  }

  const internal = prep.items.find((item) => item.no === 2)
  const review = prep.items.find((item) => item.no === 4)
  const companyChecks = [
    { label: '九潤精密', doneKey: 'jiurunDone' },
    { label: '正隆興精密', doneKey: 'zhenglongxingDone' },
  ] as const
  for (const company of companyChecks) {
    if (review?.[company.doneKey] && !internal?.[company.doneKey]) {
      const message = `${company.label}管理審查已標記完成，但該公司內部稽核來源尚未確認；請核對日期與受控紀錄。`
      sequenceMessages.push(message)
      messages.push(message)
    }
  }
  if (prep.internalAuditComplete &&
    (!internal?.jiurunDone || !internal.zhenglongxingDone)) {
    messages.push('保留舊版「內部稽核完成」標記；請在第 2 項逐公司核對來源。')
  }
  if (prep.managementReviewComplete &&
    (!review?.jiurunDone || !review.zhenglongxingDone)) {
    messages.push('保留舊版「管理審查完成」標記；請在第 4 項逐公司核對紀錄。')
  }

  return { openNcrCount, ncrWarning, sequenceWarning: sequenceMessages.length > 0, messages, sequenceMessages }
}

export function itemHasCallout(no: number): 'quality-objectives' | 'risk-climate' | 'satisfaction' | null {
  if (no === 3) return 'quality-objectives'
  if (no === 5) return 'risk-climate'
  if (no === 15) return 'satisfaction'
  return null
}
