import {
  buildDemoLegacySeed,
  createDemoState,
  migrateToV6,
  migrateToV7,
  migrateToV8,
  migrateV1State,
  STORAGE_KEY,
} from '../data/demoData'
import type { AppState, AppStateV14Legacy } from '../types'
import { COMPANY_IDS, companySettingsFor } from '../types'
import { migrateState } from './migrate'
import {
  migrateToSingleWorkspace,
  validateSingleWorkspaceState,
} from './singleWorkspaceMigration'
import {
  isAppStateV14Legacy,
  migrateV14ToV15,
  SINGLE_WORKSPACE_STORAGE_VERSION,
  validateV15State,
} from './workspaceSchemaV15'

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
export function validateAppState(raw: unknown): raw is AppState | AppStateV14Legacy {
  if (!isObject(raw)) return false
  if (typeof raw.version !== 'number' || raw.version < MIN_BACKUP_VERSION) return false
  if (raw.version > SINGLE_WORKSPACE_STORAGE_VERSION) return false
  if (raw.version === SINGLE_WORKSPACE_STORAGE_VERSION) return validateV15State(raw)
  if (raw.version === 14 && isAppStateV14Legacy(raw)) return validateSingleWorkspaceState(raw)
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

function toV15(raw: AppState | AppStateV14Legacy): AppState {
  if (raw.version === SINGLE_WORKSPACE_STORAGE_VERSION && validateV15State(raw)) return raw
  if (isAppStateV14Legacy(raw)) return migrateV14ToV15(raw)
  let v8: AppStateV14Legacy
  const legacy = raw as unknown as AppStateV14Legacy
  if (legacy.version >= 8 && legacy.companySettings) {
    v8 = migrateToV8(legacy) as AppStateV14Legacy
  } else if (legacy.version >= 7 && legacy.companySettings) {
    v8 = migrateToV8(migrateToV7(legacy)) as AppStateV14Legacy
  } else if (legacy.version >= 6 && legacy.externalAuditPrep) {
    v8 = migrateToV8(migrateToV7(migrateToV6(legacy))) as AppStateV14Legacy
  } else {
    v8 = migrateToV8(migrateToV7(migrateToV6(legacy))) as AppStateV14Legacy
  }
  return migrateV14ToV15(migrateToSingleWorkspace(migrateState(v8)))
}

export function migrateImportedState(raw: AppState | AppStateV14Legacy): AppState {
  if (raw.version > SINGLE_WORKSPACE_STORAGE_VERSION) {
    throw new Error(`備份版本 v${raw.version} 較目前系統新，已拒絕降版還原`)
  }
  const migrated = toV15(raw)
  if (!validateV15State(migrated)) throw new Error('單一工作區備份結構不完整')
  return migrated
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
    return migrateV14ToV15(
      migrateToSingleWorkspace(migrateState(migrateToV8(migrateToV7(migrateToV6(migrated)) as AppStateV14Legacy))),
    )
  }

  if (!validateAppState(stateRaw)) {
    throw new Error('備份內容不完整或版本不支援')
  }

  return migrateImportedState(stateRaw)
}

export function serializeBackup(state: AppState): string {
  const envelope: BackupEnvelope = {
    _format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    storageKey: STORAGE_KEY,
    state,
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
  const workspace = state.workspace
  const year = companySettingsFor(state).auditYear
  const unresolved = state.workspaceMigrationConflicts?.length ?? 0
  return `${year} 年度 · ${workspace.audits.length} 筆查檢 · ${unresolved} 項待覆核 · v${state.version}`
}

export function describeRestorePreview(sourceVersion: number | undefined, migrated: AppState): string {
  const targetVersion = migrated.version
  const migrationNote =
    sourceVersion != null && sourceVersion !== targetVersion
      ? `\n來源備份 v${sourceVersion}，還原後為 v${targetVersion}（已執行格式轉換）。`
      : `\n備份版本 v${targetVersion}。`
  return `${describeBackup(migrated)}${migrationNote}\n\n目前工作區資料將被覆寫。`
}

/** Demo fallback must remain valid after failed parse in loadState. */
export { createDemoState, buildDemoLegacySeed }
