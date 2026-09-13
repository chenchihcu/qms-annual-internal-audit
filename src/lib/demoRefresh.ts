import type { AppState, CompanyData } from '../types'

function auditSignature(company: CompanyData): string {
  return company.audits
    .map((a) => `${a.qpCode}|${a.departmentId}`)
    .sort()
    .join(';')
}

/** 舊版示範：兩公司複製同一套稽核／NCR，切換後 KPI 相同 */
export function isOldClonedDemo(state: AppState): boolean {
  const { jiurun, zhenglongxing } = state.companies
  if (!jiurun || !zhenglongxing) return false

  if (auditSignature(jiurun) === auditSignature(zhenglongxing)) return true

  if (zhenglongxing.ncrs.length > 0) {
    const duplicatedJiurunNcr = zhenglongxing.ncrs.some(
      (n) => n.qpCode === 'QP-16' && n.description.includes('隔離區標示'),
    )
    if (duplicatedJiurunNcr) return true
  }

  return false
}

/**
 * 是否應以最新 createDemoState() 取代（僅在載入 version < 7 時呼叫）。
 * - user 且非舊克隆：保留
 * - demo、缺 dataSource、或舊克隆：刷新
 */
export function shouldRefreshToCurrentDemo(state: AppState): boolean {
  if (state.dataSource === 'user' && !isOldClonedDemo(state)) return false
  if (state.dataSource === 'demo') return true
  if (state.dataSource == null) return true
  if (isOldClonedDemo(state)) return true
  return false
}

export function companiesAreDifferentiated(state: AppState): boolean {
  return !isOldClonedDemo(state)
}
