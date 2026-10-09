import type {
  AppState,
  AppStateV14Legacy,
  AuditSettings,
  CompanyData,
  WorkspaceMigrationConflict,
  YearArchiveEntry,
} from '../types'
import { WORKSPACE_COMPANY_ID } from './singleWorkspaceMigration'

export const V14_STORAGE_VERSION = 14
export const SINGLE_WORKSPACE_STORAGE_VERSION = 15

export const LEGACY_STORAGE_KEY_V14 = 'qms-annual-internal-audit-v14'

const OTHER_LEGACY_ID = 'zhenglongxing' as const

const SETTINGS_COMPARE_FIELDS = [
  'auditYear',
  'leadAuditor',
  'yearStart',
  'planWindowStart',
  'planWindowEnd',
  'managementReviewDate',
  'externalAuditDate',
  'viewRole',
] as const

const SCORING_COMPARE_FIELDS = ['conform', 'nonConform', 'observation'] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

function nextConflictId(conflicts: WorkspaceMigrationConflict[], prefix: string): string {
  return `${prefix}-${conflicts.length + 1}`
}

function addSettingsConflict(
  conflicts: WorkspaceMigrationConflict[],
  field: string,
  left: unknown,
  right: unknown,
): void {
  conflicts.push({
    id: nextConflictId(conflicts, 'review'),
    category: 'settings',
    title: `系統設定：${field}`,
    summary: 'v14 雙公司設定鏡像不一致；請選定後再寫入 v15。',
    target: { kind: 'settings', field },
    candidates: [
      { source: '九潤（jiurun）', label: `九潤（jiurun）：${String(left)}`, value: left },
      { source: '正隆興（zhenglongxing）', label: `正隆興（zhenglongxing）：${String(right)}`, value: right },
    ],
  })
}

function detectSettingsMirrorConflicts(
  left: AuditSettings,
  right: AuditSettings,
  conflicts: WorkspaceMigrationConflict[],
): void {
  for (const field of SETTINGS_COMPARE_FIELDS) {
    const a = left[field]
    const b = right[field]
    if (!hasValue(a) || !hasValue(b) || a === b) continue
    addSettingsConflict(conflicts, field, a, b)
  }
  for (const field of SCORING_COMPARE_FIELDS) {
    const a = left.scoringRules[field]
    const b = right.scoringRules[field]
    if (a !== b) addSettingsConflict(conflicts, `scoringRules.${field}`, a, b)
  }
}

function migrateYearArchiveEntry(
  entry: AppStateV14Legacy['yearArchives'][string] | YearArchiveEntry,
): YearArchiveEntry | null {
  if ('workspace' in entry && entry.workspace && entry.settings) {
    return {
      workspace: structuredClone(entry.workspace),
      settings: structuredClone(entry.settings),
    }
  }
  const legacy = entry as AppStateV14Legacy['yearArchives'][string]
  const workspace = legacy.companies?.[WORKSPACE_COMPANY_ID]
    ?? legacy.companies?.[OTHER_LEGACY_ID]
  const settings = legacy.companySettings?.[WORKSPACE_COMPANY_ID]
    ?? legacy.companySettings?.[OTHER_LEGACY_ID]
  if (!workspace || !settings) return null
  return { workspace: structuredClone(workspace), settings: structuredClone(settings) }
}

export function isAppStateV14Legacy(value: unknown): value is AppStateV14Legacy {
  if (!isObject(value)) return false
  if (!isObject(value.companies) || !isObject(value.companySettings)) return false
  return isObject(value.companies[WORKSPACE_COMPANY_ID])
}

export function migrateV14ToV15(raw: AppStateV14Legacy): AppState {
  const conflicts: WorkspaceMigrationConflict[] = [...(raw.workspaceMigrationConflicts ?? [])]
  const leftSettings = raw.companySettings[WORKSPACE_COMPANY_ID]
  const rightSettings = raw.companySettings[OTHER_LEGACY_ID]
  detectSettingsMirrorConflicts(leftSettings, rightSettings, conflicts)

  const yearArchives: Record<string, YearArchiveEntry> = {}
  for (const [year, entry] of Object.entries(raw.yearArchives ?? {})) {
    const migrated = migrateYearArchiveEntry(entry)
    if (migrated) yearArchives[year] = migrated
  }

  const {
    activeCompanyId: _active,
    companies: _companies,
    companySettings: _companySettings,
    companyAuditProfiles: _profiles,
    settings: _legacySettings,
    ...rest
  } = raw

  return {
    ...rest,
    version: SINGLE_WORKSPACE_STORAGE_VERSION,
    workspace: structuredClone(raw.companies[WORKSPACE_COMPANY_ID]),
    settings: structuredClone(leftSettings),
    auditProfile: structuredClone(raw.companyAuditProfiles[WORKSPACE_COMPANY_ID]),
    yearArchives,
    trash: raw.trash ?? [],
    permanentlyDeletedGeneratedRecords: raw.permanentlyDeletedGeneratedRecords ?? [],
    workspaceMigrationConflicts: conflicts,
  }
}

export function validateV15State(value: unknown): value is AppState {
  if (!isObject(value) || value.version !== SINGLE_WORKSPACE_STORAGE_VERSION) return false
  if ('companies' in value) return false
  const workspace = value.workspace
  const settings = value.settings
  const auditProfile = value.auditProfile
  const prep = value.externalAuditPrep
  if (!isObject(workspace) || !Array.isArray(workspace.planRows) || !Array.isArray(workspace.audits)) return false
  if (!isObject(settings) || typeof settings.auditYear !== 'number') return false
  if (!isObject(auditProfile) || !Array.isArray(auditProfile.applicableStandards)) return false
  if (!isObject(prep) || !Array.isArray(prep.items) || !Array.isArray(value.people)) return false
  if (!Array.isArray(value.workspaceMigrationConflicts)) return false
  if (!isObject(value.yearArchives)) return false
  for (const entry of Object.values(value.yearArchives)) {
    if (!isObject(entry) || !isObject(entry.workspace) || !isObject(entry.settings)) return false
    if ('companies' in entry) return false
  }
  return true
}

function replaceYearInDate(value?: string, year?: number): string | undefined {
  if (!value || year == null) return value
  return value.replace(/^\d{4}/, String(year))
}

function emptyYearWorkspace(company: CompanyData): CompanyData {
  return {
    ...company,
    planRows: company.planRows.map((row) => ({
      ...row,
      months: Array.from({ length: 12 }, () => null),
      manualOverride: false,
    })),
    audits: [],
    ncrs: [],
    observations: [],
    suggestions: [],
    riskSourceEvents: [],
    riskSourceCoverage: undefined,
  }
}

export function switchWorkspaceYear(state: AppState, year: number): AppState {
  const currentSettings = state.settings
  if (!Number.isInteger(year) || year < 2000 || year > 2200 || year === currentSettings.auditYear) return state

  const archiveYear = String(currentSettings.auditYear)
  const yearArchives = {
    ...state.yearArchives,
    [archiveYear]: {
      workspace: structuredClone(state.workspace),
      settings: structuredClone(currentSettings),
    },
  }

  const restored = yearArchives[String(year)]
  if (restored?.workspace && restored.settings) {
    return {
      ...state,
      workspace: structuredClone(restored.workspace),
      settings: { ...restored.settings, auditYear: year },
      yearArchives,
    }
  }

  const nextSettings: AuditSettings = {
    ...currentSettings,
    auditYear: year,
    yearStart: replaceYearInDate(currentSettings.yearStart, year)!,
    planWindowStart: replaceYearInDate(currentSettings.planWindowStart, year)!,
    planWindowEnd: replaceYearInDate(currentSettings.planWindowEnd, year)!,
    managementReviewDate: replaceYearInDate(currentSettings.managementReviewDate, year),
    planApprovedAt: undefined,
    planApprovedBy: undefined,
  }

  return {
    ...state,
    workspace: emptyYearWorkspace(state.workspace),
    settings: nextSettings,
    yearArchives,
  }
}
