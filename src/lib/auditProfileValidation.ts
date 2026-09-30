import type { CompanyAuditProfile } from '../types'

export const PROFILE_SNAPSHOT_READY_MESSAGE =
  '已設定正式紀錄保存位置。開始稽核時將自動固定程序版本與保存位置。'

export function procedureFieldErrors(profile: CompanyAuditProfile): {
  formalRecordLocation?: string
} {
  const errors: {
    formalRecordLocation?: string
  } = {}
  if (!profile.formalRecordLocation?.trim()) {
    errors.formalRecordLocation = '尚未指定保存位置'
  }
  return errors
}

