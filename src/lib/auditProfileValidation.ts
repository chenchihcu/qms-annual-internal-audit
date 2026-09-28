import type { CompanyAuditProfile } from '../types'

export const PROFILE_SNAPSHOT_READY_MESSAGE =
  '已寫入。開始稽核時會固定適用標準、程序代碼、版本與保存位置。'

export function procedureFieldErrors(profile: CompanyAuditProfile): {
  auditProcedureCode?: string
  auditProcedureVersion?: string
  formalRecordLocation?: string
} {
  const errors: {
    auditProcedureCode?: string
    auditProcedureVersion?: string
    formalRecordLocation?: string
  } = {}
  if (!profile.auditProcedureCode.trim()) {
    errors.auditProcedureCode = '尚未填寫'
  }
  if (!profile.auditProcedureVersion.trim() || profile.auditProcedureVersion === '待確認') {
    errors.auditProcedureVersion = '仍為待確認'
  }
  if (!profile.formalRecordLocation.trim()) {
    errors.formalRecordLocation = '尚未填寫'
  }
  return errors
}

