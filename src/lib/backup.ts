import {
  createDemoState,
  migrateToV6,
  migrateToV7,
  migrateToV8,
  migrateV1State,
  STORAGE_KEY,
} from '../data/demoData'
import type { AppState } from '../types'
import { COMPANY_IDS, companySettingsFor } from '../types'
import { migrateState } from './migrate'
import {
  migrateToSingleWorkspace,
  SINGLE_WORKSPACE_STORAGE_VERSION,
  validateSingleWorkspaceState,
  WORKSPACE_COMPANY_ID,
} from './singleWorkspaceMigration'

export const BACKUP_FORMAT = 'qms-annual-internal-audit-backup' as const
export const MIN_BACKUP_VERSION = 1

export interface BackupEnvelope {
  _format: typeof BACKUP_FORMAT
  exportedAt: string
  storageKey: typeof STORAGE_KEY
  state: AppState
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** Structural validation before restore (no throw on invalid — returns false). */
export function validateAppState(raw: unknown): raw is AppState {
  if (!isObject(raw)) return false
  if (typeof raw.version !== 'number' || raw.version < MIN_BACKUP_VERSION) return false
  if (raw.version > SINGLE_WORKSPACE_STORAGE_VERSION) return false
  if (raw.version === SINGLE_WORKSPACE_STORAGE_VERSION) return validateSingleWorkspaceState(raw)
  if (!isObject(raw.companies)) return false
  for (const id of COMPANY_IDS) {
    const co = raw.companies[id]
    if (!isObject(co)) return false
    if (!Array.isArray(co.departments) || !Array.isArray(co.planRows)) return false
    if (!Array.isArray(co.audits) || !Array.isArray(co.ncrs)) return false
  }
  if (raw.activeCompanyId !== 'jiurun' && raw.activeCompanyId !== 'zhenglongxing') return false
  if (raw.version >= 7) {
    if (!isObject(raw.companySettings)) return false
    for (const id of COMPANY_IDS) {
      const settings = raw.companySettings[id]
      if (!isObject(settings) || typeof settings.auditYear !== 'number') return false
    }
    if (raw.version >= 8 && !Array.isArray(raw.trash)) return false
    return true
  }
  if (!isObject(raw.settings) || typeof raw.settings.auditYear !== 'number') return false
  return true
}

export function migrateImportedState(raw: AppState): AppState {
  if (raw.version > SINGLE_WORKSPACE_STORAGE_VERSION) throw new Error(`備份版本 v${raw.version} 較目前系統新，已拒絕降版還原`)
  if (raw.version === SINGLE_WORKSPACE_STORAGE_VERSION) {
    if (!validateSingleWorkspaceState(raw)) throw new Error('單一工作區備份結構不完整')
    return raw
  }
  let v8: AppState
  if (raw.version >= 8 && raw.companySettings) {
    v8 = migrateToV8(raw)
  } else if (raw.version >= 7 && raw.companySettings) {
    v8 = migrateToV8(migrateToV7(raw))
  } else if (raw.version >= 6 && raw.externalAuditPrep) {
    v8 = migrateToV8(migrateToV7(migrateToV6(raw)))
  } else if (raw.version === 1) {
    const migrated = migrateV1State(raw)
    if (!migrated) throw new Error('備份內容不完整或版本不支援')
    v8 = migrateToV8(migrateToV7(migrateToV6(migrated)))
  } else {
    v8 = migrateToV8(migrateToV7(migrateToV6(raw)))
  }
  return migrateToSingleWorkspace(migrateState(v8))
}

export function parseBackupJson(json: string): AppState {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('JSON 格式錯誤')
  }

  const stateRaw =
    isObject(parsed) && parsed._format === BACKUP_FORMAT
      ? (parsed as unknown as BackupEnvelope).state
      : parsed

  if (
    isObject(stateRaw) &&
    typeof stateRaw.version === 'number' &&
    stateRaw.version > SINGLE_WORKSPACE_STORAGE_VERSION
  ) {
    throw new Error(`備份版本 v${stateRaw.version} 較目前系統新，已拒絕降版還原`)
  }

  if (isObject(stateRaw) && stateRaw.version === 1) {
    const migrated = migrateV1State(stateRaw)
    if (!migrated) throw new Error('備份內容不完整或版本不支援')
    return migrateToSingleWorkspace(migrateState(migrateToV8(migrateToV7(migrateToV6(migrated)))))
  }

  if (!validateAppState(stateRaw)) {
    throw new Error('備份內容不完整或版本不支援')
  }

  return migrateImportedState(stateRaw)
}

export function serializeBackup(state: AppState): string {
  const { settings: _legacy, ...persisted } = state
  const envelope: BackupEnvelope = {
    _format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    state: persisted as AppState,
  }
  return JSON.stringify(envelope, null, 2)
}

export function backupFilename(state: AppState): string {
  const year = companySettingsFor(state).auditYear
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `QMS備份_${year}_${timestamp}.json`
}

/** Round-trip helper for tests — returns normalized migrated state. */
export function backupRoundTrip(state: AppState): AppState {
  return parseBackupJson(serializeBackup(state))
}

export function describeBackup(state: AppState): string {
  const workspace = state.companies[WORKSPACE_COMPANY_ID]
  const year = companySettingsFor(state).auditYear
  const unresolved = state.workspaceMigrationConflicts?.length ?? 0
  return `${year} 年度 · ${workspace.audits.length} 筆查檢 · ${unresolved} 項待覆核 · v${state.version}`
}

/** Demo fallback must remain valid after failed parse in loadState. */
export { createDemoState }
