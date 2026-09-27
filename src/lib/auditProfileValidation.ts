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

export function standardFieldErrors(profile: CompanyAuditProfile): {
  confirmation?: string
  evidenceByIndex: Record<number, string>
  certificateScope?: string
  certificateReference?: string
} {
  const confirmed = profile.applicableStandards.filter((s) => s.confirmationStatus === 'confirmed')
  const evidenceByIndex: Record<number, string> = {}
  profile.applicableStandards.forEach((standard, index) => {
    if (standard.confirmationStatus === 'confirmed' && !standard.evidenceReference.trim()) {
      evidenceByIndex[index] = '尚未填寫'
    }
  })
  return {
    confirmation: confirmed.length === 0 ? '至少一項適用標準須標為已確認' : undefined,
    evidenceByIndex,
    certificateScope: !profile.certificateScope.trim() ? '尚未填寫' : undefined,
    certificateReference: !profile.certificateReference.trim() ? '尚未填寫' : undefined,
  }
}
