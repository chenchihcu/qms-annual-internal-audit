import { createDemoState } from '../data/demoData'
import { migrateChecklistItem } from './checklistEvidence'
import { carryPlanDatesToAudit } from './auditDates'
import { normalizeNCR } from './ncr'
import type { AppState, CompanyData, MonthStatus, NCR, PlanRow } from '../types'

export const CURRENT_STORAGE_VERSION = 9

const DERIVED_STATUSES: MonthStatus[] = ['滿意', '不滿意', '矯正中', '矯正圓滿']

function migratePlanRow(row: PlanRow): PlanRow {
  const manualMonthOverrides = [...(row.manualMonthOverrides ?? Array(12).fill(null))] as (
    | MonthStatus
    | null
  )[]

  row.months.forEach((status, index) => {
    if (status && DERIVED_STATUSES.includes(status)) {
      manualMonthOverrides[index] = status
    }
  })

  const months = row.months.map((status) => (status ? ('擬定' as MonthStatus) : null))

  return {
    ...row,
    months,
    manualMonthOverrides: row.manualOverride || manualMonthOverrides.some(Boolean)
      ? manualMonthOverrides
      : row.manualMonthOverrides,
  }
}

function migrateNcr(ncr: NCR): NCR {
  const legacyVerification = (ncr as NCR & { verification?: string }).verification
  const normalized = normalizeNCR({
    ...ncr,
    verificationEvidence: ncr.verificationEvidence ?? legacyVerification ?? '',
  })
  return {
    ...normalized,
    responsiblePerson: ncr.responsiblePerson ?? '',
    dueDate: ncr.dueDate ?? '',
    containment: ncr.containment ?? '',
    classification: ncr.classification,
  }
}

function migrateCompany(company: CompanyData, auditYear: number): CompanyData {
  const planRows = company.planRows.map(migratePlanRow)
  const planById = new Map(planRows.map((row) => [row.id, row]))

  const audits = company.audits.map((audit) => {
    const row = planById.get(`plan-${audit.qpCode}-${audit.departmentId}`)
    const withItems = {
      ...audit,
      items: audit.items.map(migrateChecklistItem),
    }
    return row ? carryPlanDatesToAudit(row, withItems, auditYear) : withItems
  })

  return {
    ...company,
    planRows,
    audits,
    ncrs: company.ncrs.map(migrateNcr),
  }
}

function refreshDemoCompanies(): AppState['companies'] {
  const fresh = createDemoState()
  return {
    jiurun: fresh.companies.jiurun,
    zhenglongxing: fresh.companies.zhenglongxing,
  }
}

export function migrateState(raw: AppState): AppState {
  if (raw.version >= CURRENT_STORAGE_VERSION) return raw

  const fromVersion = raw.version ?? 0
  let next: AppState = {
    ...raw,
    version: CURRENT_STORAGE_VERSION,
    companies: { ...raw.companies },
  }

  for (const companyId of Object.keys(next.companies) as Array<keyof typeof next.companies>) {
    next.companies[companyId] = migrateCompany(next.companies[companyId], next.settings.auditYear)
  }

  if (fromVersion < 9 && next.dataSource === 'demo') {
    next = {
      ...next,
      companies: refreshDemoCompanies(),
    }
  }

  return next
}
