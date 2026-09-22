import type { CertificateScope, ChecklistItem, CompanyId } from '../types'

/** qpCode + department + no → 證書判定範圍（種子對照，不修改 checklists.seed.json） */
const DUAL_CERTIFICATE_ITEMS: Array<{
  qpCode: string
  department: string
  no: number
  scope: CertificateScope
}> = [
  { qpCode: 'QP-01', department: '品保部', no: 4, scope: 'dual' },
  { qpCode: 'QP-03', department: '品保部', no: 10, scope: 'dual' },
  { qpCode: 'QP-16', department: '業務部', no: 5, scope: 'dual' },
  { qpCode: 'QP-16', department: '業務部', no: 6, scope: 'zhenglongxing' },
  { qpCode: 'QP-16', department: '品保部', no: 3, scope: 'dual' },
  { qpCode: 'QP-17', department: '管理部', no: 1, scope: 'dual' },
]

function scopeKey(qpCode: string, department: string, no: number): string {
  return `${qpCode}|${department}|${no}`
}

const SCOPE_BY_KEY = new Map(
  DUAL_CERTIFICATE_ITEMS.map((e) => [scopeKey(e.qpCode, e.department, e.no), e.scope]),
)

export function resolveCertificateScope(
  qpCode: string,
  department: string | undefined,
  no: number,
): CertificateScope {
  if (!department) return 'shared'
  return SCOPE_BY_KEY.get(scopeKey(qpCode, department, no)) ?? 'shared'
}

export function applyCertificateScopeToItem(
  item: ChecklistItem,
  qpCode: string,
  department?: string,
): ChecklistItem {
  const scope = item.certificateScope ?? resolveCertificateScope(qpCode, department, item.no)
  if (scope === 'dual') {
    const byCo = item.judgmentByCompany ?? {
      jiurun: item.judgment,
      zhenglongxing: item.judgment,
    }
    return {
      ...item,
      certificateScope: 'dual',
      judgmentByCompany: byCo,
      judgment: null,
    }
  }
  if (scope === 'jiurun' || scope === 'zhenglongxing') {
    return { ...item, certificateScope: scope }
  }
  return { ...item, certificateScope: 'shared' }
}

export function defaultNcrCompanyScopeForItem(item: ChecklistItem): import('../types').NcrCompanyScope {
  const scope = item.certificateScope ?? 'shared'
  if (scope === 'jiurun') return 'jiurun'
  if (scope === 'zhenglongxing') return 'zhenglongxing'
  return 'both'
}

export function ncrCompanyScopeForDualSide(side: CompanyId): import('../types').NcrCompanyScope {
  return side
}

export function listDualCertificateItemKeys(): string[] {
  return DUAL_CERTIFICATE_ITEMS.filter((e) => e.scope === 'dual').map((e) =>
    scopeKey(e.qpCode, e.department, e.no),
  )
}
