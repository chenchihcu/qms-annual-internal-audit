import type { AppState, CompanyData, CompanyId, TabId } from '../types'
import { companySettingsFor } from '../types'
import { ncrNumberLabels } from './ncr'

export type FollowupKind = 'ncr' | 'observation' | 'suggestion'
export type FollowupFilter = 'all' | FollowupKind

export interface FollowupQueueRow {
  id: string
  kind: FollowupKind
  tab: TabId
  label: string
  department: string
  qpCode: string
  status: string
  dueDate?: string
  year: number
  sortKey: string
}

export interface CarryForwardSummary {
  importableObservations: number
  importableNcrs: number
  total: number
}

export function buildFollowupQueue(company: CompanyData): FollowupQueueRow[] {
  const ncrLabels = ncrNumberLabels(company.ncrs)
  const ncrRows: FollowupQueueRow[] = company.ncrs
    .filter((item) => item.status !== '結案')
    .map((item) => ({
      id: item.id,
      kind: 'ncr',
      tab: 'ncr',
      label: ncrLabels.get(item.id) ?? (item.ncrNumber || item.id),
      department: item.department,
      qpCode: item.qpCode,
      status: item.status,
      dueDate: item.dueDate,
      year: item.sourceYear ?? (Number(item.date.slice(0, 4)) || new Date().getFullYear()),
      sortKey: item.dueDate ?? item.date,
    }))

  const observationRows: FollowupQueueRow[] = company.observations
    .filter((item) => item.status === 'open')
    .map((item) => ({
      id: item.id,
      kind: 'observation',
      tab: 'observations',
      label: item.content.slice(0, 48) || item.id,
      department: item.department,
      qpCode: item.qpCode,
      status: '待追蹤',
      dueDate: item.dueDate,
      year: item.year,
      sortKey: item.dueDate ?? item.occurrenceDate ?? `${item.year}`,
    }))

  const suggestionRows: FollowupQueueRow[] = company.suggestions
    .filter((item) => item.status === 'open')
    .map((item) => ({
      id: item.id,
      kind: 'suggestion',
      tab: 'suggestions',
      label: item.issue.slice(0, 48) || item.id,
      department: item.responsibleUnit,
      qpCode: item.procedure,
      status: '待追蹤',
      year: item.year,
      sortKey: `${item.year}`,
    }))

  return [...ncrRows, ...observationRows, ...suggestionRows].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
}

export function filterFollowupRows(rows: FollowupQueueRow[], filter: FollowupFilter): FollowupQueueRow[] {
  if (filter === 'all') return rows
  return rows.filter((row) => row.kind === filter)
}

export function isFollowupOverdue(dueDate: string | undefined, today: string): boolean {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false
  const parsed = new Date(`${dueDate}T00:00:00`)
  const normalized = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  return !Number.isNaN(parsed.getTime()) && normalized === dueDate && dueDate < today
}

export function countOpenFollowups(company: CompanyData): number {
  return buildFollowupQueue(company).length
}

export function buildCarryForwardSummary(state: AppState, companyId: CompanyId = state.activeCompanyId): CarryForwardSummary {
  const company = state.companies[companyId]
  const currentYear = companySettingsFor(state, companyId).auditYear

  const priorObs = [
    ...company.observations,
    ...Object.entries(state.yearArchives)
      .filter(([year]) => year !== String(currentYear))
      .flatMap(([, archive]) => archive.companies[companyId]?.observations ?? []),
  ].filter((item) => item.year < currentYear && item.status === 'open')

  const openPriorNcr = Object.entries(state.yearArchives)
    .filter(([year]) => year !== String(currentYear))
    .flatMap(([, archive]) => archive.companies[companyId]?.ncrs ?? [])
    .filter((item) => item.status !== '結案')

  const importableObservations = priorObs.filter(
    (item) => item.carriedToYear !== currentYear
      && !item.carryForwards?.some((entry) => entry.year === currentYear),
  ).length

  const importableNcrs = openPriorNcr.filter(
    (ncr) => !company.audits.some((audit) => audit.items.some((checklistItem) => checklistItem.sourceNcrId === ncr.id)),
  ).length

  return {
    importableObservations,
    importableNcrs,
    total: importableObservations + importableNcrs,
  }
}

export const FOLLOWUP_FILTER_LABELS: Record<FollowupFilter, string> = {
  all: '全部',
  ncr: 'NCR',
  observation: '觀察',
  suggestion: '建議',
}

export const FOLLOWUP_KIND_LABELS: Record<FollowupKind, string> = {
  ncr: 'NCR',
  observation: '觀察',
  suggestion: '建議',
}
