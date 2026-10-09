import type { ProcedureRiskOverride, ProcedureRiskRecord } from '../types'
import { buildRiskSnapshot, riskConfirmBlockers } from './risk'

export interface RiskRecordKey {
  qpCode: string
  departmentId: string
}

function sameKey(record: RiskRecordKey, key: RiskRecordKey): boolean {
  return record.qpCode === key.qpCode && record.departmentId === key.departmentId
}

function contentSignature(record: ProcedureRiskRecord): string {
  return JSON.stringify({
    snapshot: buildRiskSnapshot(record),
    basis: record.factorBasis ?? {},
    year: record.assessmentYear,
  })
}

export interface RiskSaveInput extends RiskRecordKey {
  patch: Partial<ProcedureRiskRecord>
  overrides?: ProcedureRiskOverride[]
  auditYear: number
  now: string
  newId: string
}

/**
 * 存檔一律寫入本年度並回到草稿（內容未變則保留原狀態）；
 * 已核准內容變更時舊快照已在 revisions，故只撤銷核准不刪歷史。
 */
export function applyRiskSave(records: ProcedureRiskRecord[], input: RiskSaveInput): ProcedureRiskRecord[] {
  const existing = records.find((record) => sameKey(record, input))
  const base: ProcedureRiskRecord = existing ?? {
    id: input.newId,
    qpCode: input.qpCode,
    departmentId: input.departmentId,
    inherentRisk: 3,
    evidenceReference: '',
    updatedAt: input.now,
  }
  const merged: ProcedureRiskRecord = {
    ...base,
    ...input.patch,
    id: base.id,
    qpCode: input.qpCode,
    departmentId: input.departmentId,
    assessmentYear: input.auditYear,
    updatedAt: input.now,
  }
  const changed = !existing || contentSignature(existing) !== contentSignature(merged)
  const next: ProcedureRiskRecord = changed
    ? { ...merged, status: 'draft', confirmedAt: undefined, approvedAt: undefined, approvedBy: undefined }
    : { ...merged, status: existing?.status ?? 'draft' }
  if (input.overrides?.length) {
    next.overrides = [...(base.overrides ?? []), ...input.overrides]
  }
  return existing
    ? records.map((record) => (record.id === existing.id ? next : record))
    : [...records, next]
}

/** 只確認本年度草稿且無阻擋項的紀錄；其餘原樣保留。 */
export function applyRiskConfirm(
  records: ProcedureRiskRecord[],
  keys: RiskRecordKey[],
  auditYear: number,
  now: string,
): ProcedureRiskRecord[] {
  return records.map((record) => {
    if (!keys.some((key) => sameKey(record, key))) return record
    if (record.assessmentYear !== auditYear) return record
    if ((record.status ?? 'draft') !== 'draft') return record
    if (riskConfirmBlockers(record).length > 0) return record
    return { ...record, status: 'confirmed', confirmedAt: now }
  })
}

/** 核准本年度所有已確認紀錄，並把核准當下快照寫入 revisions。 */
export function applyRiskApprove(
  records: ProcedureRiskRecord[],
  auditYear: number,
  approvedBy: string,
  now: string,
  revisionId: (record: ProcedureRiskRecord) => string,
): ProcedureRiskRecord[] {
  return records.map((record) => {
    if (record.assessmentYear !== auditYear || record.status !== 'confirmed') return record
    return {
      ...record,
      status: 'approved',
      approvedAt: now,
      approvedBy,
      revisions: [
        ...(record.revisions ?? []),
        {
          id: revisionId(record),
          changedAt: now,
          status: 'approved',
          assessmentYear: auditYear,
          approvedBy,
          snapshot: buildRiskSnapshot(record),
        },
      ],
    }
  })
}
