import { AS9100_CLAUSE_SEED, findClauseEntry } from '../data/as9100Clauses'
import type { AppState, ChecklistItem, CompanyId, NCR } from '../types'

export interface ClauseChecklistRef {
  companyId: CompanyId
  companyName: string
  qpCode: string
  department: string
  itemNo: number
  content: string
  judgment: ChecklistItem['judgment']
  as9100Clause: string
}

export interface ClauseNcrRef {
  companyId: CompanyId
  companyName: string
  ncrNumber: string
  qpCode: string
  description: string
  status: NCR['status']
  as9100Clause?: string
}

export interface ClauseMappingResult {
  clause: string
  title: string
  category: string
  checklistRefs: ClauseChecklistRef[]
  ncrRefs: ClauseNcrRef[]
}

function clauseMatches(itemClause: string | undefined, filterClause: string): boolean {
  if (!itemClause?.trim()) return false
  const normalized = itemClause.trim()
  const filter = filterClause.trim()
  if (!filter) return false
  return normalized === filter || normalized.startsWith(`${filter}.`)
}

export function buildClauseIndex(state: AppState): ClauseMappingResult[] {
  const byClause = new Map<string, ClauseMappingResult>()

  for (const entry of AS9100_CLAUSE_SEED) {
    byClause.set(entry.clause, {
      clause: entry.clause,
      title: entry.title,
      category: entry.category,
      checklistRefs: [],
      ncrRefs: [],
    })
  }

  for (const companyId of Object.keys(state.companies) as CompanyId[]) {
    const company = state.companies[companyId]
    for (const audit of company.audits) {
      for (const item of audit.items) {
        if (!item.as9100Clause?.trim()) continue
        const entry = findClauseEntry(item.as9100Clause) ?? {
          clause: item.as9100Clause,
          title: '（自訂條款）',
          category: '其他',
        }
        let bucket = byClause.get(entry.clause)
        if (!bucket) {
          bucket = {
            clause: entry.clause,
            title: entry.title,
            category: entry.category,
            checklistRefs: [],
            ncrRefs: [],
          }
          byClause.set(entry.clause, bucket)
        }
        bucket.checklistRefs.push({
          companyId,
          companyName: company.name,
          qpCode: audit.qpCode,
          department: audit.department,
          itemNo: item.no,
          content: item.content,
          judgment: item.judgment,
          as9100Clause: item.as9100Clause,
        })
      }
    }

    for (const ncr of company.ncrs) {
      const linkedItem = ncr.checklistItemId
        ? company.audits.flatMap((a) => a.items).find((i) => i.id === ncr.checklistItemId)
        : undefined
      const clause = linkedItem?.as9100Clause
      if (!clause?.trim()) continue
      const entry = findClauseEntry(clause) ?? {
        clause,
        title: '（自訂條款）',
        category: '其他',
      }
      let bucket = byClause.get(entry.clause)
      if (!bucket) {
        bucket = {
          clause: entry.clause,
          title: entry.title,
          category: entry.category,
          checklistRefs: [],
          ncrRefs: [],
        }
        byClause.set(entry.clause, bucket)
      }
      bucket.ncrRefs.push({
        companyId,
        companyName: company.name,
        ncrNumber: ncr.ncrNumber,
        qpCode: ncr.qpCode,
        description: ncr.description,
        status: ncr.status,
        as9100Clause: clause,
      })
    }
  }

  return [...byClause.values()].sort((a, b) => a.clause.localeCompare(b.clause, undefined, { numeric: true }))
}

export function filterClauseMappings(
  index: ClauseMappingResult[],
  filterClause: string,
): ClauseMappingResult[] {
  const trimmed = filterClause.trim()
  if (!trimmed) return index.filter((r) => r.checklistRefs.length > 0 || r.ncrRefs.length > 0)

  return index
    .filter((r) => clauseMatches(r.clause, trimmed))
    .map((r) => ({
      ...r,
      checklistRefs: r.checklistRefs.filter((ref) => clauseMatches(ref.as9100Clause, trimmed)),
      ncrRefs: r.ncrRefs.filter((ref) => clauseMatches(ref.as9100Clause ?? '', trimmed)),
    }))
}

export function listClausesWithData(index: ClauseMappingResult[]): string[] {
  return index
    .filter((r) => r.checklistRefs.length > 0 || r.ncrRefs.length > 0)
    .map((r) => r.clause)
}
