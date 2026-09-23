import { createDemoState, migrateToV4, migrateV1State, STORAGE_KEY } from '../data/demoData'
import type { AppState } from '../types'
import { hydrateSharedPlan } from './sharedPlan'

export const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}-corrupt-backup`

export interface LoadStateResult {
  state: AppState
  warning?: string
}

export interface SaveStateResult {
  ok: boolean
  error?: string
}

export function loadStateFromStorage(): LoadStateResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      if (parsed.version >= 4 && parsed.externalAuditPrep) return { state: hydrateSharedPlan(parsed) }
      if (parsed.companies) return { state: migrateToV4(parsed) }
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
