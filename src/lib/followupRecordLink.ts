import type { AppState, CompanyId, TabId } from '../types'
import { companySettingsFor } from '../types'
import { WORKSPACE_COMPANY_ID } from './singleWorkspaceMigration'
import { isRecordInTrash } from './trash'

export type FollowupRecordLinkStatus = 'found' | 'missing' | 'trash' | 'archived'

export interface FollowupRecordLinkResult {
  status: FollowupRecordLinkStatus
  message: string
  settingsTab?: TabId
}

function findInArchive(
  state: AppState,
  _companyId: CompanyId,
  recordId: string,
  kind: 'ncr' | 'observation' | 'suggestion',
): boolean {
  for (const archive of Object.values(state.yearArchives)) {
    const company = archive.workspace
    if (!company) continue
    if (kind === 'ncr' && company.ncrs.some((item) => item.id === recordId)) return true
    if (kind === 'observation' && company.observations.some((item) => item.id === recordId)) return true
    if (kind === 'suggestion' && company.suggestions.some((item) => item.id === recordId)) return true
  }
  return false
}

export function resolveFollowupRecordLink(
  state: AppState,
  recordId: string,
  listKind: 'ncr' | 'observation' | 'suggestion',
  companyId: CompanyId = WORKSPACE_COMPANY_ID,
): FollowupRecordLinkResult {
  const year = companySettingsFor(state, companyId).auditYear
  const company = state.workspace
  const trashKind = listKind === 'ncr' ? 'ncr' : listKind === 'observation' ? 'observation' : 'suggestion'
  const trashYear = listKind === 'ncr' ? undefined : year

  if (listKind === 'ncr' && company.ncrs.some((item) => item.id === recordId)) {
    return { status: 'found', message: '' }
  }
  if (listKind === 'observation' && company.observations.some((item) => item.id === recordId)) {
    return { status: 'found', message: '' }
  }
  if (listKind === 'suggestion' && company.suggestions.some((item) => item.id === recordId)) {
    return { status: 'found', message: '' }
  }

  if (isRecordInTrash(state.trash, trashKind, companyId, recordId, trashYear)) {
    return {
      status: 'trash',
      message: '連結的紀錄已在回收區；可至系統設定還原後再查閱。',
      settingsTab: 'system-settings',
    }
  }

  if (findInArchive(state, companyId, recordId, listKind)) {
    return {
      status: 'archived',
      message: '連結的紀錄在封存年度資料中；請切換內稽年度或自備份還原後查閱。',
    }
  }

  return {
    status: 'missing',
    message: '找不到連結的紀錄；可能已刪除、永久清除或不在目前公司／年度。',
    settingsTab: 'system-settings',
  }
}
