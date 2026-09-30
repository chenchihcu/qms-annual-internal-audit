import { buildDemoLegacySeed, migrateToV8 } from '../data/demoData'
import { migrateChecklistItem } from './checklistEvidence'
import { carryPlanDatesToAudit } from './auditDates'
import { normalizeAuditNotice } from './auditNotice'
import { normalizeAttachments } from './attachments'
import { isOldClonedDemo } from './demoRefresh'
import { normalizeExternalAuditSchedule } from './externalAuditSchedule'
import { normalizeNCR } from './ncr'
import type { AppStateV14Legacy, CompanyData, CompanyId, MonthStatus, NCR, PlanRow } from '../types'
import { COMPANY_IDS, DEFAULT_VIEW_ROLE } from '../types'

function resolveDataSource(
  state: AppStateV14Legacy,
  incomingDataSource?: AppStateV14Legacy['dataSource'],
): AppStateV14Legacy['dataSource'] {
  const source = incomingDataSource ?? state.dataSource
  if (source === 'user' && !isOldClonedDemo(state)) return 'user'
  return 'demo'
}

export const CURRENT_STORAGE_VERSION = 13

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
    const withItems = normalizeAuditNotice({
      ...audit,
      items: audit.items.map((item) => ({
        ...migrateChecklistItem(item),
        attachments: normalizeAttachments(item.attachments),
      })),
    })
    return row ? carryPlanDatesToAudit(row, withItems, auditYear) : withItems
  })

  return {
    ...company,
    keyCustomerName: company.keyCustomerName ?? '',
    planRows,
    audits,
    ncrs: company.ncrs.map((ncr) => ({
      ...migrateNcr(ncr),
      attachments: normalizeAttachments(ncr.attachments),
    })),
  }
}

function refreshDemoCompanies(): AppStateV14Legacy['companies'] {
  const seed = migrateToV8(buildDemoLegacySeed())
  const companies = { ...seed.companies }
  for (const companyId of COMPANY_IDS) {
    const settings = seed.companySettings[companyId]
    companies[companyId] = migrateCompany(companies[companyId], settings.auditYear)
  }
  return companies
}

export function migrateState(raw: AppStateV14Legacy): AppStateV14Legacy {
  if (raw.version >= CURRENT_STORAGE_VERSION) {
    return {
      ...raw,
      dataSource: resolveDataSource(raw, raw.dataSource),
    }
  }

  const fromVersion = raw.version ?? 0
  const incomingDataSource = raw.dataSource
  let next: AppStateV14Legacy = {
    ...raw,
    version: CURRENT_STORAGE_VERSION,
    companies: { ...raw.companies },
    companySettings: { ...raw.companySettings },
  }

  for (const companyId of COMPANY_IDS) {
    const settings = next.companySettings[companyId]
    next.companies[companyId] = migrateCompany(next.companies[companyId], settings.auditYear)
  }

  if (fromVersion < 9 && next.dataSource === 'demo') {
    next = {
      ...next,
      companies: refreshDemoCompanies(),
    }
  }

  if (fromVersion < 12 && next.dataSource === 'demo') {
    next = {
      ...next,
      companies: refreshDemoCompanies(),
    }
  }

  const activeSettings = next.companySettings[next.activeCompanyId]
  const companySettings = COMPANY_IDS.reduce(
    (acc, companyId) => {
      const settings = next.companySettings[companyId]
      acc[companyId] = {
        ...settings,
        viewRole: settings.viewRole ?? DEFAULT_VIEW_ROLE,
      }
      return acc
    },
    {} as Record<CompanyId, AppStateV14Legacy['companySettings'][CompanyId]>,
  )

  next = {
    ...next,
    companySettings,
    externalAuditSchedule: normalizeExternalAuditSchedule(
      next.externalAuditSchedule,
      activeSettings.auditYear,
      activeSettings.externalAuditDate ?? `${activeSettings.auditYear}-09-15`,
    ),
  }

  if (fromVersion < 13 && next.dataSource === 'demo') {
    next = {
      ...next,
      companies: refreshDemoCompanies(),
      externalAuditSchedule: normalizeExternalAuditSchedule(
        undefined,
        activeSettings.auditYear,
        activeSettings.externalAuditDate ?? `${activeSettings.auditYear}-09-15`,
      ),
    }
  }

  return {
    ...next,
    dataSource: resolveDataSource(next, incomingDataSource),
  }
}
