import {
  createDemoState,
  migrateToV6,
  migrateV1State,
  STORAGE_KEY,
} from '../data/demoData'
import type { AppState, CompanyId } from '../types'
import { COMPANY_LABELS } from '../types'

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
  if (!isObject(raw.settings) || typeof raw.settings.auditYear !== 'number') return false
  if (!isObject(raw.companies)) return false
  for (const id of ['jiurun', 'zhenglongxing'] as CompanyId[]) {
    const co = raw.companies[id]
    if (!isObject(co)) return false
    if (!Array.isArray(co.departments) || !Array.isArray(co.planRows)) return false
    if (!Array.isArray(co.audits) || !Array.isArray(co.ncrs)) return false
  }
  if (raw.activeCompanyId !== 'jiurun' && raw.activeCompanyId !== 'zhenglongxing') return false
  return true
}

export function migrateImportedState(raw: AppState): AppState {
  if (raw.version > 6) throw new Error(`備份版本 v${raw.version} 較目前系統新，已拒絕降版還原`)
  if (raw.version >= 6 && raw.externalAuditPrep) {
    return migrateToV6(raw)
  }
  if (raw.version === 1) {
    const migrated = migrateV1State(raw)
    if (migrated) return migrateToV6(migrated)
  }
  return migrateToV6(raw)
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

  if (isObject(stateRaw) && stateRaw.version === 1) {
    const migrated = migrateV1State(stateRaw)
    if (!migrated) throw new Error('備份內容不完整或版本不支援')
    return migrateToV6(migrated)
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
  const year = state.settings.auditYear
  return `QMS備份_${year}_${new Date().toISOString().slice(0, 10)}.json`
}

/** Round-trip helper for tests — returns normalized migrated state. */
export function backupRoundTrip(state: AppState): AppState {
  return parseBackupJson(serializeBackup(state))
}

export function describeBackup(state: AppState): string {
  const companies = (['jiurun', 'zhenglongxing'] as CompanyId[])
    .map((id) => `${COMPANY_LABELS[id]}(${state.companies[id].audits.length}稽核)`)
    .join('、')
  return `${state.settings.auditYear} 年度 · ${companies} · v${state.version}`
}

/** Demo fallback must remain valid after failed parse in loadState. */
export { createDemoState }
