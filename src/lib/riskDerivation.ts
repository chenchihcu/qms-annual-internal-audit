import type {
  AppState,
  RiskLevel,
  ChecklistItem,
  NCR,
  Observation,
  ProcedureAudit,
  ProcedureRiskFactorKey,
  RiskCoverageKind,
  RiskSourceCoverage,
  RiskSourceEvent,
  RiskSourceKind,
} from '../types'
import { localIsoDate } from './localDate'
import { countToScale, monthsToScale, seedInherentScale, scaleToInherentLabel } from './risk'
import { effectiveLinkStatus, isCoverageCurrent } from './riskSources'

/**
 * 方案風險因子建議值：只讀既有紀錄，不寫入 procedureRisks。
 * 評估期間：前一年度封存 + 本年度工作區；未結 NCR 涵蓋所有早於本年度的封存。
 */

export type DerivedFactorStatus = 'derived' | 'no_events' | 'no_data'

export interface DerivedSource {
  kind: 'ncr' | 'audit' | 'event'
  id: string
  year: number
  label: string
}

export interface DerivedFactor {
  status: DerivedFactorStatus
  suggested?: number
  count?: number
  sources: DerivedSource[]
  note: string
}

export type DerivedRiskFactors = Record<ProcedureRiskFactorKey, DerivedFactor>

interface Located<T> {
  record: T
  year: number
}

interface LocatedItem {
  item: ChecklistItem
  audit: ProcedureAudit
  year: number
}

export interface RiskDerivationPool {
  auditYear: number
  previousYear: number
  hasPreviousArchive: boolean
  ncrs: Located<NCR>[]
  audits: Located<ProcedureAudit>[]
  observations: Located<Observation>[]
  ncrById: Map<string, Located<NCR>>
  itemById: Map<string, LocatedItem>
  observationById: Map<string, Located<Observation>>
  windowStart: string
  /** 評估日（本地日期）；「已全部登錄」須涵蓋到此日才有效。 */
  today: string
  /** 事件日期落在期間內（前一年度 1/1 起）且未作廢的外部來源登錄。 */
  sourceEvents: Located<RiskSourceEvent>[]
  /** 只採本年度工作區的盤點聲明。 */
  sourceCoverage: Partial<Record<RiskCoverageKind, RiskSourceCoverage>>
}

type PoolSource = Pick<AppState, 'workspace' | 'yearArchives' | 'settings'>

/** 本年度一律讀工作區；封存中同年度的鍵是切換年度時留下的舊副本，略過。 */
export function buildRiskDerivationPool(state: PoolSource, today: string = localIsoDate()): RiskDerivationPool {
  const auditYear = state.settings.auditYear
  const periodStart = `${auditYear - 1}-01-01`
  const sources: Array<{ year: number; workspace: PoolSource['workspace'] }> = [
    { year: auditYear, workspace: state.workspace },
  ]
  for (const [key, archive] of Object.entries(state.yearArchives ?? {})) {
    const year = Number(key)
    if (!Number.isInteger(year) || year >= auditYear || !archive?.workspace) continue
    sources.push({ year, workspace: archive.workspace })
  }

  const ncrs: Located<NCR>[] = []
  const audits: Located<ProcedureAudit>[] = []
  const observations: Located<Observation>[] = []
  const ncrById = new Map<string, Located<NCR>>()
  const itemById = new Map<string, LocatedItem>()
  const observationById = new Map<string, Located<Observation>>()
  const sourceEvents: Located<RiskSourceEvent>[] = []
  const seenEvents = new Set<string>()

  for (const { year, workspace } of sources) {
    for (const event of workspace.riskSourceEvents ?? []) {
      if (event.voidedAt || seenEvents.has(event.id) || !event.date || event.date < periodStart) continue
      seenEvents.add(event.id)
      sourceEvents.push({ record: event, year })
    }
    for (const ncr of workspace.ncrs ?? []) {
      if (ncrById.has(ncr.id)) continue
      const located = { record: ncr, year }
      ncrs.push(located)
      ncrById.set(ncr.id, located)
    }
    for (const audit of workspace.audits ?? []) {
      audits.push({ record: audit, year })
      for (const item of audit.items ?? []) {
        if (!itemById.has(item.id)) itemById.set(item.id, { item, audit, year })
      }
    }
    for (const observation of workspace.observations ?? []) {
      if (observationById.has(observation.id)) continue
      const located = { record: observation, year }
      observations.push(located)
      observationById.set(observation.id, located)
    }
  }

  const previousYear = auditYear - 1
  return {
    auditYear,
    previousYear,
    hasPreviousArchive: sources.some((source) => source.year === previousYear),
    ncrs,
    audits,
    observations,
    ncrById,
    itemById,
    observationById,
    windowStart: state.settings.planWindowStart || `${auditYear}-01-01`,
    today,
    sourceEvents,
    sourceCoverage: state.workspace.riskSourceCoverage ?? {},
  }
}

function itemRoot(pool: RiskDerivationPool, itemId: string, seen: Set<string>): string {
  const key = `item:${itemId}`
  if (seen.has(key)) return key
  seen.add(key)
  const item = pool.itemById.get(itemId)?.item
  if (item?.sourceNcrId) {
    const source = pool.ncrById.get(item.sourceNcrId)?.record
    return source ? ncrRoot(pool, source, seen) : `ncr:${item.sourceNcrId}`
  }
  if (item?.carriedFromId) return observationRoot(pool, item.carriedFromId, seen)
  return key
}

function observationRoot(pool: RiskDerivationPool, observationId: string, seen: Set<string>): string {
  const key = `obs:${observationId}`
  if (seen.has(key)) return key
  seen.add(key)
  const observation = pool.observationById.get(observationId)?.record
  if (observation?.sourceChecklistItemId) return itemRoot(pool, observation.sourceChecklistItemId, seen)
  return key
}

/**
 * 同一品質事件的根：跨年追蹤題（sourceNcrId／carriedFromId）、觀察轉 NCR（observationId）、
 * 同一查檢題的觀察與不符兩張 NCR（checklistItemId）都回溯到最早紀錄。
 */
export function ncrEventRoot(pool: RiskDerivationPool, ncr: NCR, seen: Set<string> = new Set()): string {
  return ncrRoot(pool, ncr, seen)
}

function ncrRoot(pool: RiskDerivationPool, ncr: NCR, seen: Set<string>): string {
  const key = `ncr:${ncr.id}`
  if (seen.has(key)) return key
  seen.add(key)
  if (ncr.checklistItemId) return itemRoot(pool, ncr.checklistItemId, seen)
  if (ncr.observationId) return observationRoot(pool, ncr.observationId, seen)
  return key
}

function isThirdPartyNcr(pool: RiskDerivationPool, ncr: NCR): boolean {
  if (!ncr.observationId) return false
  return pool.observationById.get(ncr.observationId)?.record.sourceType === 'third_party_audit'
}

interface NcrEvent {
  root: string
  members: Located<NCR>[]
  thirdParty: boolean
  open: boolean
  overdue: boolean
}

function groupEvents(pool: RiskDerivationPool, ncrs: Located<NCR>[], today: string): NcrEvent[] {
  const byRoot = new Map<string, NcrEvent>()
  for (const located of ncrs) {
    const root = ncrEventRoot(pool, located.record)
    const open = located.record.status !== '結案'
    const overdue = open && Boolean(located.record.dueDate) && located.record.dueDate! < today
    const existing = byRoot.get(root)
    if (existing) {
      existing.members.push(located)
      existing.thirdParty ||= isThirdPartyNcr(pool, located.record)
      existing.open ||= open
      existing.overdue ||= overdue
    } else {
      byRoot.set(root, {
        root,
        members: [located],
        thirdParty: isThirdPartyNcr(pool, located.record),
        open,
        overdue,
      })
    }
  }
  return [...byRoot.values()]
}

function ncrSource(located: Located<NCR>): DerivedSource {
  return {
    kind: 'ncr',
    id: located.record.id,
    year: located.year,
    label: `${located.year} ${located.record.ncrNumber}`,
  }
}

function representative(event: NcrEvent): Located<NCR> {
  return [...event.members].sort((a, b) => a.year - b.year || (a.record.date || '').localeCompare(b.record.date || ''))[0]
}

function matchesKey(record: { qpCode: string; departmentId: string }, qpCode: string, departmentId: string): boolean {
  return record.qpCode === qpCode && record.departmentId === departmentId
}

function isExecutedAudit(audit: ProcedureAudit): boolean {
  if (!audit.auditDate) return false
  return audit.status == null || audit.status === '已回報'
}

function countFactor(events: NcrEvent[], periodCovered: boolean, noDataNote: string, periodNote: string): DerivedFactor {
  if (events.length > 0) {
    return {
      status: 'derived',
      count: events.length,
      suggested: countToScale(events.length),
      sources: events.map((event) => ncrSource(representative(event))),
      note: `${periodNote} ${events.length} 件（同一事件只計一次）`,
    }
  }
  if (!periodCovered) return { status: 'no_data', sources: [], note: noDataNote }
  return { status: 'no_events', count: 0, suggested: countToScale(0), sources: [], note: `${periodNote}查無紀錄` }
}

function monthsBetween(from: string, to: string): number | null {
  const a = new Date(from)
  const b = new Date(to)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()))
}

function sourceEventFactor(
  pool: RiskDerivationPool,
  kind: RiskSourceKind,
  qpCode: string,
  departmentId: string,
  periodNote: string,
): DerivedFactor {
  const linked = (status: 'pending' | 'confirmed') => pool.sourceEvents.filter((located) =>
    located.record.kind === kind
    && located.record.targets.some((target) => matchesKey(target, qpCode, departmentId) && effectiveLinkStatus(target) === status))
  const events = linked('confirmed')
  const pendingCount = linked('pending').length
  const pendingNote = pendingCount > 0 ? `；另有 ${pendingCount} 件關聯待確認，未計入` : ''
  if (events.length > 0) {
    const references = new Map<string, Located<RiskSourceEvent>>()
    for (const located of events) {
      const key = located.record.externalReference.trim().toLowerCase()
      if (!references.has(key)) references.set(key, located)
    }
    const unique = [...references.values()]
    return {
      status: 'derived',
      count: unique.length,
      suggested: countToScale(unique.length),
      sources: unique.map((located) => ({
        kind: 'event',
        id: located.record.id,
        year: located.year,
        label: located.record.externalReference,
      })),
      note: `${periodNote} 已確認關聯 ${unique.length} 件（同一外部編號只計一次）${pendingNote}`,
    }
  }
  if (pendingCount > 0) {
    return { status: 'no_data', sources: [], note: `${pendingCount} 件關聯待確認，確認前不判定為無事件` }
  }
  // 未登錄視為 0 件（2026-10-10 使用者核准）；「已全部登錄」只影響說明，不再擋計數。
  const coverage = pool.sourceCoverage[kind]
  const note = isCoverageCurrent(coverage, pool.today)
    ? `已全部登錄至 ${coverage!.checkedThrough}，期間內無關聯此程序的紀錄`
    : `${periodNote} 無已確認登錄，視為 0 件`
  return { status: 'no_events', count: 0, suggested: countToScale(0), sources: [], note }
}

export function deriveRiskFactors(
  pool: RiskDerivationPool,
  qpCode: string,
  departmentId: string,
  options: { today?: string; seedFallback?: RiskLevel } = {},
): DerivedRiskFactors {
  const today = options.today ?? pool.today
  const keyNcrs = pool.ncrs.filter((located) => matchesKey(located.record, qpCode, departmentId))
  const periodNcrs = keyNcrs.filter((located) => located.year >= pool.previousYear)
  const periodEvents = groupEvents(pool, periodNcrs, today)
  const keyAudits = pool.audits.filter((located) => matchesKey(located.record, qpCode, departmentId))
  const executed = keyAudits.filter((located) => isExecutedAudit(located.record))
  const periodAudited = executed.some((located) => located.year >= pool.previousYear)
  const periodNote = `${pool.previousYear}–${pool.auditYear}`

  const internal = countFactor(
    periodEvents.filter((event) => !event.thirdParty),
    periodAudited,
    `${periodNote} 無此程序的稽核紀錄，無法判定`,
    periodNote,
  )
  // 第三方：此程序在期間內有第三方稽核觀察，或已聲明第三方缺失「已全部登錄」到今天，才可判為 0 件。
  const keyThirdPartyRecords = pool.observations.some((located) =>
    located.record.sourceType === 'third_party_audit'
    && located.year >= pool.previousYear
    && matchesKey(located.record, qpCode, departmentId))
  const thirdParty = countFactor(
    periodEvents.filter((event) => event.thirdParty),
    keyThirdPartyRecords || isCoverageCurrent(pool.sourceCoverage.third_party_audit, pool.today),
    `${periodNote} 此程序無第三方稽核紀錄，且第三方缺失未勾選「已全部登錄」`,
    periodNote,
  )

  const openEvents = groupEvents(pool, keyNcrs, today).filter((event) => event.open)
  const overdueCount = openEvents.filter((event) => event.overdue).length
  const anyRecords = pool.ncrs.length > 0 || pool.audits.some((located) => isExecutedAudit(located.record))
  const overdue: DerivedFactor = openEvents.length > 0
    ? {
        status: 'derived',
        count: openEvents.length,
        suggested: countToScale(openEvents.length),
        sources: openEvents.map((event) => ncrSource(representative(event))),
        note: `未結 ${openEvents.length} 件，其中逾期 ${overdueCount} 件`,
      }
    : anyRecords
      ? { status: 'no_events', count: 0, suggested: countToScale(0), sources: [], note: '目前無未結 NCR' }
      : { status: 'no_data', sources: [], note: '系統內尚無 NCR 或稽核紀錄' }

  const lastAudit = [...executed].sort((a, b) => a.record.auditDate.localeCompare(b.record.auditDate)).at(-1)
  const months = lastAudit ? monthsBetween(lastAudit.record.auditDate, pool.windowStart) : null
  const sinceLast: DerivedFactor = lastAudit && months != null
    ? {
        status: 'derived',
        count: months,
        suggested: monthsToScale(months),
        sources: [{ kind: 'audit', id: lastAudit.record.id, year: lastAudit.year, label: `${lastAudit.year} 稽核 ${lastAudit.record.auditDate}` }],
        note: `最近一次稽核 ${lastAudit.record.auditDate}，至計畫窗口起 ${months} 個月`,
      }
    : { status: 'no_data', sources: [], note: '系統內無此程序已執行的稽核紀錄' }

  const inherent = seedInherentScale(qpCode, departmentId, options.seedFallback)

  return {
    inherentRisk: {
      status: 'derived',
      suggested: inherent,
      sources: [],
      note: `程序種子固有風險：${scaleToInherentLabel(inherent)}`,
    },
    previousInternalNcrCount: internal,
    previousThirdPartyNcrCount: thirdParty,
    overdueOpenNcrCount: overdue,
    customerComplaintLevel: sourceEventFactor(pool, 'customer_complaint', qpCode, departmentId, periodNote),
    changeImpact: sourceEventFactor(pool, 'major_change', qpCode, departmentId, periodNote),
    monthsSinceLastAudit: sinceLast,
  }
}
