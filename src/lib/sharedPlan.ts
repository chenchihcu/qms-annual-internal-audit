import type { AppState, CompanyId, MonthStatus, PlanRow, SharedPlanRow } from '../types'

export const COMPANY_IDS: CompanyId[] = ['jiurun', 'zhenglongxing']

type SharedField = Exclude<keyof PlanRow, 'id' | 'months' | 'manualOverride'>

const SHARED_FIELDS: Array<{ key: SharedField; label: string }> = [
  { key: 'qpCode', label: '程序代碼' },
  { key: 'departmentId', label: '部門代碼' },
  { key: 'sequence', label: '項次' },
  { key: 'riskLevel', label: '計畫風險' },
  { key: 'department', label: '被稽核部門' },
  { key: 'process', label: '流程' },
  { key: 'documents', label: '程序文件' },
  { key: 'auditUnit', label: '稽核單位' },
  { key: 'owner', label: '受稽核負責人' },
  { key: 'auditors', label: '稽核人員' },
  { key: 'auditCategory', label: '稽核類型' },
]

export interface PlanConflictField {
  label: string
  jiurun: string
  zhenglongxing: string
}

export interface PlanConflict {
  id: string
  qpCode: string
  department: string
  fields: PlanConflictField[]
}

function monthValue(row: PlanRow | SharedPlanRow, index: number): MonthStatus {
  return Array.isArray(row.months) ? row.months[index] ?? null : null
}

/** 舊月格可能已是結果；共用計畫只取「是否排在該月」。 */
export function scheduledMonths(row: PlanRow | SharedPlanRow): MonthStatus[] {
  return Array.from({ length: 12 }, (_, index) => monthValue(row, index) ? '擬定' : null)
}

function monthPositions(row: PlanRow): string {
  return scheduledMonths(row).map((status) => status ? '1' : '0').join('')
}

function candidates(state: AppState): Map<string, Partial<Record<CompanyId, PlanRow>>> {
  const rows = new Map<string, Partial<Record<CompanyId, PlanRow>>>()
  for (const companyId of COMPANY_IDS) {
    for (const row of state.companies[companyId].planRows) {
      rows.set(row.id, { ...rows.get(row.id), [companyId]: row })
    }
  }
  return rows
}

export function getLegacyPlanConflicts(state: AppState): PlanConflict[] {
  if (state.sharedPlanRows) return []
  const conflicts: PlanConflict[] = []
  for (const [id, pair] of candidates(state)) {
    const jiurun = pair.jiurun
    const zhenglongxing = pair.zhenglongxing
    if (!jiurun || !zhenglongxing) continue
    const fields: PlanConflictField[] = []
    for (const { key, label } of SHARED_FIELDS) {
      if (jiurun[key] !== zhenglongxing[key]) {
        fields.push({ label, jiurun: String(jiurun[key]), zhenglongxing: String(zhenglongxing[key]) })
      }
    }
    if (monthPositions(jiurun) !== monthPositions(zhenglongxing)) {
      fields.push({
        label: '排程月份',
        jiurun: scheduledMonths(jiurun).flatMap((status, i) => status ? [String(i + 1)] : []).join('、') || '無',
        zhenglongxing: scheduledMonths(zhenglongxing).flatMap((status, i) => status ? [String(i + 1)] : []).join('、') || '無',
      })
    }
    if (fields.length) conflicts.push({ id, qpCode: jiurun.qpCode, department: jiurun.department, fields })
  }
  return conflicts
}

function mergeMonthResults(previous: PlanRow | undefined, plan: SharedPlanRow): MonthStatus[] {
  return Array.from({ length: 12 }, (_, index) => {
    const previousStatus = previous ? monthValue(previous, index) : null
    if (monthValue(plan, index)) return previousStatus ?? '擬定'
    // 排程移除後只清除沒有執行意義的「擬定」；歷史結果仍保留。
    return previousStatus === '擬定' ? null : previousStatus
  })
}

/** 將唯一計畫投影給舊版公司別 consumer，保留各公司月格結果。 */
export function projectSharedPlan(state: AppState, sharedPlanRows: SharedPlanRow[]): AppState {
  const companies = { ...state.companies }
  for (const companyId of COMPANY_IDS) {
    const company = state.companies[companyId]
    const previous = new Map(company.planRows.map((row) => [row.id, row]))
    const planRows: PlanRow[] = sharedPlanRows
      .filter((row) => row.applicableCompanies.includes(companyId))
      .map((row) => {
        const old = previous.get(row.id)
        const { applicableCompanies: _scope, ...fields } = row
        void _scope
        return {
          ...fields,
          months: mergeMonthResults(old, row),
          manualOverride: row.manualOverride || old?.manualOverride || false,
        }
      })
    companies[companyId] = { ...company, planRows }
  }
  return { ...state, sharedPlanRows, companies }
}

function buildRows(
  state: AppState,
  choices: Record<string, CompanyId> = {},
): SharedPlanRow[] {
  const rows: SharedPlanRow[] = []
  for (const [id, pair] of candidates(state)) {
    const sourceId = choices[id] ?? (pair.jiurun ? 'jiurun' : 'zhenglongxing')
    const source = pair[sourceId]
    if (!source) throw new Error(`計畫列 ${id} 未選擇有效的來源公司`)
    rows.push({
      ...source,
      months: scheduledMonths(source),
      applicableCompanies: COMPANY_IDS.filter((companyId) => Boolean(pair[companyId])),
    })
  }
  return rows.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))
}

/** 相同的舊計畫可自動提升；有差異時原封保留，等待逐列選擇。 */
export function hydrateSharedPlan(state: AppState): AppState {
  if (state.sharedPlanRows) return state
  if (getLegacyPlanConflicts(state).length) return state
  return projectSharedPlan(state, buildRows(state))
}

export function resolveLegacyPlanConflicts(
  state: AppState,
  choices: Record<string, CompanyId>,
): AppState {
  const conflicts = getLegacyPlanConflicts(state)
  if (conflicts.some((conflict) => !choices[conflict.id])) {
    throw new Error('每一筆不同的舊計畫列都必須先選擇來源公司')
  }
  const legacyCompanyPlanBackup = state.legacyCompanyPlanBackup ?? {
    jiurun: structuredClone(state.companies.jiurun.planRows),
    zhenglongxing: structuredClone(state.companies.zhenglongxing.planRows),
  }
  return projectSharedPlan(
    { ...state, legacyCompanyPlanBackup },
    buildRows(state, choices),
  )
}

export function canRemoveCompanyFromPlanRow(
  state: AppState,
  rowId: string,
  companyId: CompanyId,
): boolean {
  const company = state.companies[companyId]
  const row = company.planRows.find((candidate) => candidate.id === rowId)
  if (!row) return true
  if (row.months.some((status) => status !== null && status !== '擬定')) return false
  if (company.audits.some((audit) => audit.qpCode === row.qpCode && audit.departmentId === row.departmentId)) return false
  if (company.ncrs.some((ncr) => ncr.qpCode === row.qpCode && ncr.departmentId === row.departmentId)) return false
  if (company.observations.some((observation) => observation.qpCode === row.qpCode && observation.departmentId === row.departmentId)) return false
  if (company.suggestions.some((suggestion) => suggestion.procedure === row.qpCode)) return false
  return true
}
