import {
  createDemoState,
  migrateToV7,
  migrateV1State,
  STORAGE_KEY,
} from '../data/demoData'
import { shouldRefreshToCurrentDemo } from './demoRefresh'
import { migrateState } from './migrate'
import type { AppState } from '../types'

export const LEGACY_STORAGE_KEYS = [
  STORAGE_KEY,
  'qms-annual-internal-audit-v11',
  'qms-annual-internal-audit-v8',
  'qms-annual-internal-audit-v7',
  'qms-annual-internal-audit-v6',
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

  if ((parsed.version ?? 0) < 7 && shouldRefreshToCurrentDemo(parsed)) {
    const fresh = createDemoState()
    fresh.activeCompanyId = parsed.activeCompanyId ?? 'jiurun'
    return fresh
  }

  const upToV7 = (parsed.version ?? 0) >= 7 ? parsed : migrateToV7(parsed)
  return migrateState(upToV7)
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
      if (migrated) return { state: migrateState(migrated) }
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
