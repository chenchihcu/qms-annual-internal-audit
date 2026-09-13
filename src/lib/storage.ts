import {
  createDemoState,
  migrateToV4,
  migrateToV6,
  migrateV1State,
  STORAGE_KEY,
} from '../data/demoData'
import type { AppState } from '../types'

export const LEGACY_STORAGE_KEYS = [
  STORAGE_KEY,
  'qms-annual-internal-audit-v5',
  'qms-annual-internal-audit-v4',
] as const

export const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}-corrupt-backup`

export interface LoadStateResult {
  state: AppState
  warning?: string
}

export interface SaveStateResult {
  ok: boolean
  error?: string
}

function parseStoredState(raw: string): AppState {
  const parsed = JSON.parse(raw) as AppState
  if (parsed.version >= 6) return migrateToV6(parsed)
  if (parsed.version >= 4 && parsed.externalAuditPrep) return migrateToV6(parsed)
  if (parsed.companies) return migrateToV4(parsed)
  return parsed
}

export function loadStateFromStorage(): LoadStateResult {
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const state = parseStoredState(raw)
      if (key !== STORAGE_KEY) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
          localStorage.removeItem(key)
        } catch {
          /* quota */
        }
      }
      return { state }
    }
    const legacy = localStorage.getItem('qms-annual-internal-audit-v1')
    if (legacy) {
      const migrated = migrateV1State(JSON.parse(legacy))
      if (migrated) return { state: migrated }
    }
  } catch {
    const backup = localStorage.getItem(STORAGE_KEY)
    if (backup) {
      try {
        localStorage.setItem(CORRUPT_BACKUP_KEY, backup)
      } catch {
        /* quota */
      }
    }
    return {
      state: createDemoState(),
      warning:
        '本機資料無法讀取，已載入示範資料。損壞的備份已保留於瀏覽器 localStorage（corrupt-backup 鍵）。',
    }
  }
  return { state: createDemoState() }
}

export function saveStateToStorage(state: AppState): SaveStateResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '儲存失敗'
    return { ok: false, error: message }
  }
}
