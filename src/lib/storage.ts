import { createDemoState, migrateV1State, STORAGE_KEY } from '../data/demoData'
import {
  LEGACY_STORAGE_KEY_V5,
  PRE_V6_BACKUP_KEY,
  normalizeToV6,
} from './migrateToV6'
import type { AppState } from '../types'

export const CORRUPT_BACKUP_KEY = `${STORAGE_KEY}-corrupt-backup`

export interface LoadStateResult {
  state: AppState
  warning?: string
}

export interface SaveStateResult {
  ok: boolean
  error?: string
}

function loadAndNormalize(raw: string): AppState {
  const parsed = JSON.parse(raw) as unknown
  return normalizeToV6(parsed)
}

export function loadStateFromStorage(): LoadStateResult {
  try {
    const rawV6 = localStorage.getItem(STORAGE_KEY)
    if (rawV6) {
      return { state: loadAndNormalize(rawV6) }
    }

    const rawV5 = localStorage.getItem(LEGACY_STORAGE_KEY_V5)
    if (rawV5) {
      try {
        localStorage.setItem(PRE_V6_BACKUP_KEY, rawV5)
      } catch {
        /* quota */
      }
      const state = loadAndNormalize(rawV5)
      return {
        state,
        warning:
          '已將 v5 雙公司資料合併為一份內稽底稿（兩證抬頭）。原始 v5 備份於 localStorage（v5-pre-v6 鍵）。',
      }
    }

    const legacy = localStorage.getItem('qms-annual-internal-audit-v1')
    if (legacy) {
      const migrated = migrateV1State(JSON.parse(legacy))
      if (migrated) return { state: normalizeToV6(migrated) }
    }
  } catch {
    const backup = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY_V5)
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
