import { applyCertificateScopeToItem } from './certificateScope'
import { ensurePrepItems } from './externalAuditPrep'
import type {
  AppState,
  ChecklistItem,
  CompanyData,
  CompanyId,
  Judgment,
  LegacyV5AppState,
  NCR,
  NcrCompanyScope,
  ProcedureAudit,
} from '../types'
import { DUAL_COMPANY_LABEL } from '../types'

export const LEGACY_STORAGE_KEY_V5 = 'qms-annual-internal-audit-v5'
export const PRE_V6_BACKUP_KEY = 'qms-annual-internal-audit-v5-pre-v6'

function itemKey(item: Pick<ChecklistItem, 'category' | 'no'>): string {
  return `${item.category}|${item.no}`
}

function countJudgedItems(company: CompanyData): number {
  let count = 0
  for (const audit of company.audits) {
    for (const item of audit.items) {
      if (item.certificateScope === 'dual' && item.judgmentByCompany) {
        if (item.judgmentByCompany.jiurun) count++
        if (item.judgmentByCompany.zhenglongxing) count++
      } else if (item.judgment) {
        count++
      }
    }
  }
  return count
}

function pickBaseCompanyId(companies: Record<CompanyId, CompanyData>): CompanyId {
  const jr = countJudgedItems(companies.jiurun)
  const zx = countJudgedItems(companies.zhenglongxing)
  return zx > jr ? 'zhenglongxing' : 'jiurun'
}

function judgmentForCompany(item: ChecklistItem, companyId: CompanyId): Judgment | null {
  const scoped = item.certificateScope ?? 'shared'
  if (scoped === 'dual') return item.judgmentByCompany?.[companyId] ?? null
  if (scoped === 'jiurun' && companyId === 'jiurun') return item.judgment
  if (scoped === 'zhenglongxing' && companyId === 'zhenglongxing') return item.judgment
  if (scoped === 'shared') return item.judgment
  return null
}

function mergeChecklistItem(
  jiurunItem: ChecklistItem,
  zhenglongxingItem: ChecklistItem,
  qpCode: string,
  department: string,
): ChecklistItem {
  const scopedJr = applyCertificateScopeToItem(jiurunItem, qpCode, department)
  const scopedZx = applyCertificateScopeToItem(zhenglongxingItem, qpCode, department)

  const jr = judgmentForCompany(scopedJr, 'jiurun')
  const zx = judgmentForCompany(scopedZx, 'zhenglongxing')

  const seedScope =
    scopedJr.certificateScope === 'dual' || scopedZx.certificateScope === 'dual'
      ? 'dual'
      : scopedJr.certificateScope === 'zhenglongxing' || scopedZx.certificateScope === 'zhenglongxing'
        ? 'zhenglongxing'
        : scopedJr.certificateScope === 'jiurun' || scopedZx.certificateScope === 'jiurun'
          ? 'jiurun'
          : jr !== zx
            ? 'dual'
            : scopedJr.certificateScope ?? 'shared'

  if (seedScope === 'dual') {
    return {
      ...scopedJr,
      id: jiurunItem.id,
      certificateScope: 'dual',
      judgment: null,
      judgmentByCompany: { jiurun: jr, zhenglongxing: zx },
      description: jiurunItem.description || zhenglongxingItem.description,
    }
  }

  if (seedScope === 'zhenglongxing') {
    return {
      ...scopedZx,
      id: jiurunItem.id,
      certificateScope: 'zhenglongxing',
      judgment: zx,
      description: jiurunItem.description || zhenglongxingItem.description,
    }
  }

  if (seedScope === 'jiurun') {
    return {
      ...scopedJr,
      id: jiurunItem.id,
      certificateScope: 'jiurun',
      judgment: jr,
      description: jiurunItem.description || zhenglongxingItem.description,
    }
  }

  return {
    ...scopedJr,
    id: jiurunItem.id,
    judgment: jr ?? zx,
    description: jiurunItem.description || zhenglongxingItem.description,
  }
}

function mergeAudits(
  base: CompanyData,
  other: CompanyData,
  baseId: CompanyId,
  _otherId: CompanyId,
): ProcedureAudit[] {
  const auditMap = new Map<string, ProcedureAudit>()
  for (const audit of base.audits) {
    auditMap.set(audit.id, { ...audit, items: audit.items.map((i) => ({ ...i })) })
  }
  for (const audit of other.audits) {
    const existing = auditMap.get(audit.id)
    if (!existing) {
      auditMap.set(audit.id, {
        ...audit,
        items: audit.items.map((i) =>
          applyCertificateScopeToItem({ ...i }, audit.qpCode, audit.department),
        ),
      })
      continue
    }
    const jrItems = baseId === 'jiurun' ? existing.items : audit.items
    const zxItems = baseId === 'jiurun' ? audit.items : existing.items
    const zxByKey = new Map(zxItems.map((i) => [itemKey(i), i]))
    const mergedItems = jrItems.map((jrItem) => {
      const zxItem = zxByKey.get(itemKey(jrItem))
      if (!zxItem) return applyCertificateScopeToItem(jrItem, audit.qpCode, audit.department)
      return mergeChecklistItem(jrItem, zxItem, audit.qpCode, audit.department)
    })
    for (const item of zxItems) {
      if (!mergedItems.some((m) => itemKey(m) === itemKey(item))) {
        mergedItems.push(
          applyCertificateScopeToItem({ ...item }, audit.qpCode, audit.department),
        )
      }
    }
    mergedItems.sort((a, b) => a.no - b.no)
    auditMap.set(audit.id, { ...existing, items: mergedItems })
  }
  return [...auditMap.values()]
}

function ncrScopeFromSource(sourceId: CompanyId, ncr: NCR): NcrCompanyScope {
  if (ncr.companyScope) return ncr.companyScope
  return sourceId
}

function mergeNcrs(
  base: CompanyData,
  other: CompanyData,
  baseId: CompanyId,
  otherId: CompanyId,
): NCR[] {
  const seen = new Set<string>()
  const result: NCR[] = []
  const add = (ncr: NCR, sourceId: CompanyId) => {
    let id = ncr.id
    if (seen.has(id)) id = `${id}-${sourceId}`
    if (seen.has(id)) return
    seen.add(id)
    result.push({
      ...ncr,
      id,
      companyScope: ncrScopeFromSource(sourceId, ncr),
    })
  }
  for (const n of base.ncrs) add(n, baseId)
  for (const n of other.ncrs) add(n, otherId)
  return result
}

function mergeUniqueById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of a) map.set(item.id, item)
  for (const item of b) {
    if (!map.has(item.id)) map.set(item.id, item)
    else map.set(`${item.id}-alt`, item)
  }
  return [...map.values()]
}

export function migrateV5ToV6(raw: LegacyV5AppState): AppState {
  const baseId = pickBaseCompanyId(raw.companies)
  const otherId: CompanyId = baseId === 'jiurun' ? 'zhenglongxing' : 'jiurun'
  const base = raw.companies[baseId]
  const other = raw.companies[otherId]

  const company: CompanyData = {
    name: DUAL_COMPANY_LABEL,
    departments: base.departments,
    planRows: base.planRows,
    audits: mergeAudits(base, other, baseId, otherId),
    ncrs: mergeNcrs(base, other, baseId, otherId),
    observations: mergeUniqueById(base.observations, other.observations),
    suggestions: mergeUniqueById(base.suggestions, other.suggestions),
  }

  return {
    settings: raw.settings,
    company,
    externalAuditPrep: ensurePrepItems(raw.externalAuditPrep),
    version: 6,
  }
}

export function isLegacyV5State(raw: unknown): raw is LegacyV5AppState {
  if (!raw || typeof raw !== 'object') return false
  const o = raw as Record<string, unknown>
  return Boolean(o.companies) && !o.company
}

export function normalizeToV6(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('無效的資料格式')
  }
  const o = raw as Record<string, unknown>
  if (typeof o.version === 'number' && o.version >= 6 && o.company) {
    const state = raw as AppState
    return {
      ...state,
      company: {
        ...state.company,
        name: DUAL_COMPANY_LABEL,
        audits: state.company.audits.map((a) => ({
          ...a,
          items: a.items.map((i) =>
            applyCertificateScopeToItem(i, a.qpCode, a.department),
          ),
        })),
      },
      externalAuditPrep: ensurePrepItems(state.externalAuditPrep),
      version: 6,
    }
  }
  if (isLegacyV5State(raw)) {
    return migrateV5ToV6(raw)
  }
  throw new Error('不支援的資料版本')
}
